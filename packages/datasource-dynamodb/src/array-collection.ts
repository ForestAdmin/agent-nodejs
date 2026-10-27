import type DynamoDBCollection from './collection';
import type { AttributeSchema, TableModel } from './types';
import type {
  AggregateResult,
  Aggregation,
  Caller,
  ConditionTree,
  DataSource,
  Filter,
  PaginatedFilter,
  RecordData,
} from '@forestadmin/datasource-toolkit';

import {
  BaseCollection,
  ConditionTreeBranch,
  ConditionTreeFactory,
  ConditionTreeLeaf,
  Page,
  PaginatedFilter as PaginatedFilterClass,
  Projection,
  ValidationError,
} from '@forestadmin/datasource-toolkit';

import { ScanLimitExceededError } from './errors';
import convertModelToFields from './schema/schema-converter';
import StreamingAggregator from './utils/aggregator';
import ExpressionBuilder from './utils/expression-builder';
import Serializer, { CLEARED } from './utils/serializer';
import compareRecords from './utils/sort';

export const INDEX_FIELD = 'index';

/** Table items read at once when only the first elements of the array are needed. */
const PARENTS_PER_READ = 100;

/** Expressions are limited to 4 KB by DynamoDB, names and values apart. */
const MAX_EXPRESSION_LENGTH = 3000;

/** One array on the way from the item of the table to the records of a collection. */
type Level = { arrayField: string; indexColumn: string };

export type ArrayCollectionConfig = {
  name: string;
  /** Attribute of the parent holding the array, `a@@@b` for one inside a map. */
  arrayField: string;
  /** Attributes of an item, by flattened name. */
  itemSchema: Record<string, AttributeSchema>;
};

type Item = Record<string, unknown>;

function conjuncts(tree?: ConditionTree): ConditionTree[] {
  if (!tree) return [];

  if (tree instanceof ConditionTreeBranch && tree.aggregator === 'And') {
    return tree.conditions.flatMap(condition => conjuncts(condition));
  }

  return [tree];
}

/**
 * Exposes an array of maps stored in the items of another collection, or of another array
 * collection, as a collection of its own. A record is identified by the key of the table item and
 * its position in each array on the way, which is why positions move when an earlier element of
 * the same array is removed. The position in the parent array is named `<parent>Index`.
 */
export default class ArrayCollection extends BaseCollection {
  private readonly parent: DynamoDBCollection | ArrayCollection;
  private readonly root: DynamoDBCollection;
  private readonly chain: Level[];
  private readonly rootKeys: string[];
  private readonly itemFields: Set<string>;

  /** Attributes of an element, by flattened name, as declared or sampled. */
  readonly itemSchema: Record<string, AttributeSchema>;

  /** The columns identifying a record: the table keys, then one position per array. */
  readonly keyColumns: string[];

  constructor(
    datasource: DataSource,
    parent: DynamoDBCollection | ArrayCollection,
    config: ArrayCollectionConfig,
  ) {
    super(config.name, datasource, parent.nativeDriver);

    const nested = parent instanceof ArrayCollection;

    this.parent = parent;
    this.root = nested ? parent.root : parent;

    const { partitionKey, sortKey } = this.root.model;
    const keys = [partitionKey, sortKey].filter(Boolean);
    this.rootKeys = keys.map(key => key.name);

    const parentLevels = nested
      ? parent.chain.map((level, i, all) =>
          i === all.length - 1 ? { ...level, indexColumn: `${parent.name}Index` } : level,
        )
      : [];
    this.chain = [...parentLevels, { arrayField: config.arrayField, indexColumn: INDEX_FIELD }];
    this.keyColumns = [...this.rootKeys, ...this.chain.map(level => level.indexColumn)];

    // A key named like a position column would be overwritten by it, and so address another item.
    if (new Set(this.keyColumns).size !== this.keyColumns.length) {
      throw new ValidationError(`The key columns of '${config.name}' must have distinct names`);
    }

    const schema: Record<string, AttributeSchema> = {
      ...config.itemSchema,
      ...Object.fromEntries(
        keys.map(key => [key.name, { type: key.type === 'N' ? 'number' : 'string' }]),
      ),
      ...Object.fromEntries(this.chain.map(level => [level.indexColumn, { type: 'number' }])),
    };
    const model: TableModel = {
      ...this.root.model,
      name: config.name,
      indexes: [],
      schema,
      overrideTypeConverter: undefined,
    };
    const fields = convertModelToFields(model);
    const inMemory = this.root.settings.inMemoryProcessing;

    // The attributes of an element live inside the item: a filter on one reads every parent. Only
    // the keys of the item and the position of the element narrow what is read.
    for (const [name, field] of Object.entries(fields)) {
      if (!inMemory && field.type === 'Column') {
        const isKey = this.keyColumns.includes(name);

        field.filterOperators = new Set(isKey ? ['Equal', 'In'] : []);
        field.isSortable = false;
      }
    }

    for (const name of this.keyColumns) {
      Object.assign(fields[name], { isPrimaryKey: true, isReadOnly: true });
    }

    this.addFields(fields);
    this.enableCount();

    this.itemSchema = config.itemSchema;
    this.itemFields = new Set(Object.keys(config.itemSchema));
  }

  async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    const created: RecordData[] = [];

    try {
      // Appended one after the other: each append reads the length the previous one left.
      for (const record of data) {
        // eslint-disable-next-line no-await-in-loop
        created.push(await this.append(record));
      }
    } finally {
      this.root.invalidateCaches();
    }

    return created;
  }

  async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    const sort = filter.sort?.length ? filter.sort : undefined;
    const skip = filter.page?.skip ?? 0;
    const limit = filter.page?.limit || undefined;
    // Without a sort the first records are the first elements: parents are read only as far as
    // the page needs, instead of the whole table.
    const wanted = !sort && limit !== undefined ? skip + limit : undefined;
    const records = await this.readRecords(caller, filter.conditionTree, wanted);
    const { columns } = projection;

    if (sort) records.sort((a, b) => compareRecords(a, b, sort));

    return records
      .slice(skip, limit === undefined ? undefined : skip + limit)
      .map(record =>
        Object.fromEntries(columns.filter(field => field in record).map(f => [f, record[f]])),
      );
  }

  async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    for (const field of Object.keys(patch)) {
      if (this.keyColumns.includes(field)) {
        throw new ValidationError(`The attribute '${field}' of '${this.name}' cannot be updated`);
      }
    }

    const entries: Array<[string, unknown]> = Object.entries(patch)
      .filter(([, value]) => value !== undefined)
      .map(([field, value]) => [field, this.toStored(field, value)]);
    const assigned = entries.filter(([, value]) => value !== CLEARED);
    const cleared = entries.filter(([, value]) => value === CLEARED);

    if (assigned.length) {
      await this.writePerTableItem(caller, filter, {
        keyword: 'SET',
        clauses: (builder, position, state) => {
          state.values ??= assigned.map(([, value]) => builder.value(value));

          return assigned.map(
            ([field], index) =>
              `${this.elementPath(builder, position)}.${builder.attribute(field)} = ${
                state.values[index]
              }`,
          );
        },
        fallback: (key, positions) => this.replaceElements(key, positions, assigned),
      });
    }

    if (cleared.length) {
      await this.writePerTableItem(caller, filter, {
        keyword: 'REMOVE',
        clauses: (builder, position) =>
          cleared.map(
            ([field]) => `${this.elementPath(builder, position)}.${builder.attribute(field)}`,
          ),
        fallback: (key, positions) => this.replaceElements(key, positions, cleared),
      });
    }
  }

  async delete(caller: Caller, filter: Filter): Promise<void> {
    await this.writePerTableItem(caller, filter, {
      keyword: 'REMOVE',
      // Highest positions first, so that removing one does not shift those still to remove.
      descending: true,
      clauses: (builder, position) => [this.elementPath(builder, position)],
    });
  }

  async aggregate(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    const aggregator = new StreamingAggregator(aggregation, caller.timezone);

    for (const record of await this.readRecords(caller, filter.conditionTree)) {
      aggregator.add(record);
    }

    return aggregator.result(limit);
  }

  /** The path of an element: each array of the chain followed by the position taken in it. */
  private elementPath(
    builder: ExpressionBuilder,
    positions: number[],
    levels = this.chain.length,
  ): string {
    return this.chain
      .slice(0, levels)
      .map((level, i) => `${builder.attribute(level.arrayField)}[${positions[i]}]`)
      .join('.');
  }

  /** Gives back the DynamoDB type Forest cannot send: bytes for base64 text, a set for an array. */
  private toStored(field: string, value: unknown): unknown {
    const attribute = this.itemSchema[field];

    if (attribute?.type === 'binary' && typeof value === 'string') {
      return Uint8Array.from(Buffer.from(value, 'base64'));
    }

    if (attribute?.set && Array.isArray(value)) return value.length ? new Set(value) : CLEARED;

    return value;
  }

  /** Reads an attribute the element does not have as a null, as the collection of a table does. */
  private itemColumns(record: RecordData): RecordData {
    for (const column of this.itemFields) record[column] ??= null;

    return record;
  }

  /** The columns identifying the parent element, as named by the parent. */
  private parentColumns(): string[] {
    return this.parent instanceof ArrayCollection ? this.parent.keyColumns : this.rootKeys;
  }

  /** Reads the parents, then turns each array element into a record and applies the filter. */
  private async readRecords(
    caller: Caller,
    tree?: ConditionTree,
    wanted?: number,
  ): Promise<RecordData[]> {
    // Conditions on the table key narrow the parents read; the rest applies to the elements.
    const onTableKey = conjuncts(tree).filter(
      condition =>
        condition instanceof ConditionTreeLeaf && this.rootKeys.includes(condition.field),
    );
    const { arrayField } = this.chain[this.chain.length - 1];
    const parentColumns = this.parentColumns();
    const ownKeyColumns = this.keyColumns.slice(0, -1);
    const parentFilter = onTableKey.length
      ? ConditionTreeFactory.intersect(...onTableKey)
      : undefined;
    const parentProjection = new Projection(...parentColumns, arrayField);
    const records: RecordData[] = [];
    let parentsRead = 0;

    for (let offset = 0; ; offset += PARENTS_PER_READ) {
      // eslint-disable-next-line no-await-in-loop
      const parents = await this.parent.list(
        caller,
        new PaginatedFilterClass({
          conditionTree: parentFilter,
          ...(wanted === undefined ? {} : { page: new Page(offset, PARENTS_PER_READ) }),
        }),
        parentProjection,
      );

      for (const parent of parents) {
        const elements = parent[arrayField];

        if (Array.isArray(elements)) {
          elements.forEach((element, index) => {
            if (element && typeof element === 'object') {
              const record = {
                // The identity comes last: an element's own `index` must not take its place.
                ...this.itemColumns(Serializer.flatten(element as Item, this.itemFields)),
                ...Object.fromEntries(
                  ownKeyColumns.map((name, i) => [name, parent[parentColumns[i]]]),
                ),
                [INDEX_FIELD]: index,
              };

              if (!tree || tree.match(record, this, caller.timezone)) records.push(record);
            }
          });
        }
      }

      if (wanted === undefined || records.length >= wanted || parents.length < PARENTS_PER_READ) {
        return records;
      }

      // Each page of parents is read with a budget of its own: this one is shared by all of them.
      parentsRead += parents.length;

      if (parentsRead > this.root.executor.maxScannedItems) {
        throw new ScanLimitExceededError(
          `Reading the parents of '${this.name}' stopped after ${parentsRead} items of table ` +
            `'${this.root.model.tableName}': maxScannedItems is ${this.root.executor.maxScannedItems}. ` +
            `Narrow the results with filters.`,
        );
      }
    }
  }

  private async append(record: RecordData): Promise<RecordData> {
    const parentKeyColumns = this.keyColumns.slice(0, -1);

    for (const name of parentKeyColumns) {
      if (record[name] === undefined || record[name] === null) {
        throw new ValidationError(
          `The key attribute '${name}' of the parent '${this.parent.name}' is required to create ` +
            `a record in '${this.name}'`,
        );
      }
    }

    const key = Object.fromEntries(this.rootKeys.map(name => [name, record[name]]));
    const parentPositions = parentKeyColumns.slice(this.rootKeys.length).map(name => record[name]);
    const fields = Object.fromEntries(
      Object.entries(record).filter(([name]) => !this.keyColumns.includes(name)),
    );
    const stored = Object.fromEntries(
      Object.entries(fields)
        .map(([name, value]) => [name, this.toStored(name, value)])
        .filter(([, value]) => value !== CLEARED),
    );
    const builder = new ExpressionBuilder();
    const keyBuilder = new ExpressionBuilder('k', 'kv');
    const parentPath = this.elementPath(
      builder,
      parentPositions as number[],
      this.chain.length - 1,
    );
    const { arrayField } = this.chain[this.chain.length - 1];
    const arrayPath = [parentPath, builder.attribute(arrayField)].filter(Boolean).join('.');
    const emptyList = builder.value([]);
    const appended = builder.value([Serializer.unflatten(stored)]);
    const conditions = [`attribute_exists(${keyBuilder.attribute(this.rootKeys[0])})`];

    if (parentPath) conditions.push(`attribute_exists(${parentPath})`);

    const entity = this.entityCondition(builder);

    if (entity) conditions.push(entity);

    let attributes: Item;

    try {
      attributes = await this.root.executor.update({
        Key: key,
        UpdateExpression: `SET ${arrayPath} = list_append(if_not_exists(${arrayPath}, ${emptyList}), ${appended})`,
        ConditionExpression: conditions.join(' AND '),
        ExpressionAttributeNames: { ...builder.names, ...keyBuilder.names },
        ExpressionAttributeValues: builder.values,
        ReturnValues: 'UPDATED_NEW',
      });
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') throw this.missingParent();

      // The array sits under a map the item does not have yet, which SET cannot create.
      if (error.name === 'ValidationException' && /document path/i.test(error.message)) {
        const index = await this.appendByRewriting(key, parentPositions as number[], stored);

        return {
          ...key,
          ...Object.fromEntries(
            parentKeyColumns
              .slice(this.rootKeys.length)
              .map((name, i) => [name, parentPositions[i]]),
          ),
          [INDEX_FIELD]: index,
          ...fields,
        };
      }

      throw error;
    }

    const length = this.appendedLength(attributes);

    return {
      ...key,
      ...Object.fromEntries(
        parentKeyColumns.slice(this.rootKeys.length).map((name, i) => [name, parentPositions[i]]),
      ),
      [INDEX_FIELD]: length - 1,
      ...fields,
    };
  }

  private missingParent(): ValidationError {
    return new ValidationError(
      `The parent record of '${this.name}' does not exist in '${this.parent.name}'`,
    );
  }

  /** Appends in the item itself, creating the maps on the way, for when DynamoDB cannot. */
  private async appendByRewriting(
    key: Item,
    parentPositions: number[],
    fields: Record<string, unknown>,
  ): Promise<number> {
    const item = await this.root.executor.get(key);

    if (!item) throw this.missingParent();

    let container: Item = item;
    let index = -1;

    this.chain.forEach((level, depth) => {
      const segments = Serializer.toPathSegments(level.arrayField);
      const holder = segments.slice(0, -1).reduce<Item>((value, segment) => {
        if (!value[segment]) value[segment] = {};

        return value[segment] as Item;
      }, container);
      const last = segments[segments.length - 1];

      if (depth === this.chain.length - 1) {
        holder[last] ??= [];
        (holder[last] as unknown[]).push(Serializer.unflatten(fields));
        index = (holder[last] as unknown[]).length - 1;
      } else {
        container = (holder[last] as Item[] | undefined)?.[parentPositions[depth]];

        if (!container) throw this.missingParent();
      }
    });

    const keyBuilder = new ExpressionBuilder('k', 'kv');
    const builder = new ExpressionBuilder();
    const conditions = [`attribute_exists(${keyBuilder.attribute(this.rootKeys[0])})`];
    const entity = this.entityCondition(builder);

    if (entity) conditions.push(entity);

    try {
      await this.root.executor.put({
        Item: item,
        ConditionExpression: conditions.join(' AND '),
        ExpressionAttributeNames: { ...builder.names, ...keyBuilder.names },
        ...(Object.keys(builder.values).length
          ? { ExpressionAttributeValues: builder.values }
          : {}),
      });
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') throw this.missingParent();

      throw error;
    }

    return index;
  }

  /** UPDATED_NEW answers with only the arrays on the path, each holding just the updated element. */
  private appendedLength(attributes: Item): number {
    let value: unknown = attributes;

    this.chain.forEach((level, i) => {
      for (const segment of Serializer.toPathSegments(level.arrayField)) {
        value = (value as Item)?.[segment];
      }

      if (i < this.chain.length - 1 && Array.isArray(value)) [value] = value;
    });

    return (value as unknown[]).length;
  }

  /** Restricts a write to the items of the entity the parent collection stands for. */
  private entityCondition(builder: ExpressionBuilder): string | undefined {
    const { entity, sortKey } = this.root.model;

    if (entity?.sortKeyPrefix !== undefined && sortKey) {
      return `begins_with(${builder.attribute(sortKey.name)}, ${builder.value(
        entity.sortKeyPrefix,
      )})`;
    }

    if (entity?.attribute !== undefined) {
      return `${builder.attribute(entity.attribute)} = ${builder.value(entity.value)}`;
    }

    return undefined;
  }

  private async writeExpression(
    key: Item,
    expression: string,
    builder: ExpressionBuilder,
  ): Promise<void> {
    const keyBuilder = new ExpressionBuilder('k', 'kv');
    const conditions = [`attribute_exists(${keyBuilder.attribute(this.rootKeys[0])})`];
    const entity = this.entityCondition(builder);

    if (entity) conditions.push(entity);

    try {
      await this.root.executor.update({
        Key: key,
        UpdateExpression: expression,
        ConditionExpression: conditions.join(' AND '),
        ExpressionAttributeNames: { ...builder.names, ...keyBuilder.names },
        ...(Object.keys(builder.values).length
          ? { ExpressionAttributeValues: builder.values }
          : {}),
      });
    } catch (error) {
      if (error.name !== 'ConditionalCheckFailedException') throw error;
    }
  }

  /** Sets attributes of elements one by one in the item itself, for when DynamoDB cannot. */
  private async replaceElements(
    key: Item,
    positions: number[][],
    entries: Array<[string, unknown]>,
  ): Promise<void> {
    const item = await this.root.executor.get(key);

    if (!item) return;

    for (const position of positions) {
      let container: Item = item;

      this.chain.forEach((level, depth) => {
        const segments = Serializer.toPathSegments(level.arrayField);
        const holder = segments
          .slice(0, -1)
          .reduce<Item>((value, segment) => value[segment] as Item, container);
        const array = holder[segments[segments.length - 1]] as Item[];

        if (depth === this.chain.length - 1) {
          // Each attribute of the patch replaces what it names, as SET does, and nothing else.
          for (const [field, value] of entries) {
            const path = Serializer.toPathSegments(field);

            if (value === CLEARED) Serializer.removePath(array[position[depth]], path);
            else Serializer.setPath(array[position[depth]], path, value);
          }
        } else {
          container = array[position[depth]];
        }
      });
    }

    const keyBuilder = new ExpressionBuilder('k', 'kv');
    const builder = new ExpressionBuilder();
    const conditions = [`attribute_exists(${keyBuilder.attribute(this.rootKeys[0])})`];
    const entity = this.entityCondition(builder);

    if (entity) conditions.push(entity);

    try {
      await this.root.executor.put({
        Item: item,
        ConditionExpression: conditions.join(' AND '),
        ExpressionAttributeNames: { ...builder.names, ...keyBuilder.names },
        ...(Object.keys(builder.values).length
          ? { ExpressionAttributeValues: builder.values }
          : {}),
      });
    } catch (error) {
      if (error.name !== 'ConditionalCheckFailedException') throw error;
    }
  }

  /** Finds the matching elements, then writes once per table item whatever they need. */
  private async writePerTableItem(
    caller: Caller,
    filter: Filter,
    write: {
      keyword: 'SET' | 'REMOVE';
      descending?: boolean;
      clauses: (
        builder: ExpressionBuilder,
        position: number[],
        state: { values?: string[] },
      ) => string[];
      /** What to do when DynamoDB refuses the path, for instance under a map that is missing. */
      fallback?: (key: Item, positions: number[][]) => Promise<void>;
    },
  ): Promise<void> {
    const records = await this.list(
      caller,
      new PaginatedFilterClass({ conditionTree: filter.conditionTree }),
      new Projection(...this.keyColumns),
    );
    const perItem = new Map<string, { key: Item; positions: number[][] }>();
    const positionColumns = this.chain.map(level => level.indexColumn);

    for (const record of records) {
      const key = Object.fromEntries(this.rootKeys.map(name => [name, record[name]]));
      const id = JSON.stringify(key);
      const entry = perItem.get(id) ?? { key, positions: [] };
      entry.positions.push(positionColumns.map(name => record[name] as number));
      perItem.set(id, entry);
    }

    try {
      await this.root.executor.mapWrites([...perItem.values()], async ({ key, positions }) => {
        const ordered = [...positions].sort((a, b) => {
          const different = a.findIndex((index, depth) => index !== b[depth]);

          return different === -1 ? 0 : (a[different] - b[different]) * (write.descending ? -1 : 1);
        });
        let builder = new ExpressionBuilder();
        let state: { values?: string[] } = {};
        let clauses: string[] = [];

        const flush = async () => {
          if (clauses.length) {
            await this.writeExpression(key, `${write.keyword} ${clauses.join(', ')}`, builder);
          }

          builder = new ExpressionBuilder();
          state = {};
          clauses = [];
        };

        try {
          for (const position of ordered) {
            clauses.push(...write.clauses(builder, position, state));

            // An expression is limited to 4 KB: past a safe size, what is left goes in the next.
            // eslint-disable-next-line no-await-in-loop
            if (clauses.join(', ').length > MAX_EXPRESSION_LENGTH) await flush();
          }

          await flush();
        } catch (error) {
          if (!write.fallback || !/document path/i.test(error.message)) throw error;

          await write.fallback(key, ordered);
        }
      });
    } finally {
      this.root.invalidateCaches();
    }
  }
}
