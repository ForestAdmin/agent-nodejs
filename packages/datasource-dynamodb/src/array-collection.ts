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
  PaginatedFilter as PaginatedFilterClass,
  Projection,
  ValidationError,
} from '@forestadmin/datasource-toolkit';

import convertModelToFields from './schema/schema-converter';
import StreamingAggregator from './utils/aggregator';
import ExpressionBuilder from './utils/expression-builder';
import Serializer from './utils/serializer';
import compareRecords from './utils/sort';

export const INDEX_FIELD = 'index';

/** One array on the way from the item of the table to the records of a collection. */
type Level = { arrayField: string; indexColumn: string };

export type ArrayCollectionConfig = {
  name: string;
  /** Attribute of the parent holding the array, `a->b` for one inside a map. */
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

    for (const name of this.keyColumns) {
      Object.assign(fields[name], { isPrimaryKey: true, isReadOnly: true });
    }

    this.addFields(fields);
    this.enableCount();

    this.itemFields = new Set(Object.keys(config.itemSchema));
  }

  async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    const created: RecordData[] = [];

    // Appended one after the other: each append reads the length the previous one left.
    for (const record of data) {
      // eslint-disable-next-line no-await-in-loop
      created.push(await this.append(record));
    }

    this.root.invalidateCaches();

    return created;
  }

  async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    const records = await this.readRecords(caller, filter.conditionTree);
    const sort = filter.sort?.length ? filter.sort : undefined;

    if (sort) records.sort((a, b) => compareRecords(a, b, sort));

    const skip = filter.page?.skip ?? 0;
    const limit = filter.page?.limit || undefined;
    const { columns } = projection;

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

    const entries = Object.entries(patch).filter(([, value]) => value !== undefined);

    if (entries.length === 0) return;

    await this.writePerTableItem(caller, filter, (builder, positions) => {
      const values = entries.map(([, value]) => builder.value(value));

      return {
        UpdateExpression: `SET ${positions
          .flatMap(position =>
            entries.map(
              ([field], index) =>
                `${this.elementPath(builder, position)}.${builder.attribute(field)} = ${
                  values[index]
                }`,
            ),
          )
          .join(', ')}`,
      };
    });
  }

  async delete(caller: Caller, filter: Filter): Promise<void> {
    await this.writePerTableItem(caller, filter, (builder, positions) => {
      const descending = [...positions].sort((a, b) => {
        const different = a.findIndex((index, level) => index !== b[level]);

        return different === -1 ? 0 : b[different] - a[different];
      });

      return {
        UpdateExpression: `REMOVE ${descending
          .map(position => this.elementPath(builder, position))
          .join(', ')}`,
      };
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

  /** The columns identifying the parent element, as named by the parent. */
  private parentColumns(): string[] {
    return this.parent instanceof ArrayCollection ? this.parent.keyColumns : this.rootKeys;
  }

  /** Reads the parents, then turns each array element into a record and applies the filter. */
  private async readRecords(caller: Caller, tree?: ConditionTree): Promise<RecordData[]> {
    // Conditions on the table key narrow the parents read; the rest applies to the elements.
    const onTableKey = conjuncts(tree).filter(
      condition =>
        condition instanceof ConditionTreeLeaf && this.rootKeys.includes(condition.field),
    );
    const { arrayField } = this.chain[this.chain.length - 1];
    const parentColumns = this.parentColumns();
    const ownKeyColumns = this.keyColumns.slice(0, -1);
    const parents = await this.parent.list(
      caller,
      new PaginatedFilterClass({
        conditionTree: onTableKey.length
          ? ConditionTreeFactory.intersect(...onTableKey)
          : undefined,
      }),
      new Projection(...parentColumns, arrayField),
    );

    const records: RecordData[] = [];

    for (const parent of parents) {
      const elements = parent[arrayField];

      if (Array.isArray(elements)) {
        elements.forEach((element, index) => {
          if (element && typeof element === 'object') {
            records.push({
              ...Object.fromEntries(
                ownKeyColumns.map((name, i) => [name, parent[parentColumns[i]]]),
              ),
              [INDEX_FIELD]: index,
              ...Serializer.flatten(element as Item, this.itemFields),
            });
          }
        });
      }
    }

    return tree ? records.filter(record => tree.match(record, this, caller.timezone)) : records;
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
    const appended = builder.value([Serializer.unflatten(fields)]);
    const conditions = [`attribute_exists(${keyBuilder.attribute(this.rootKeys[0])})`];

    if (parentPath) conditions.push(`attribute_exists(${parentPath})`);

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
      if (error.name === 'ConditionalCheckFailedException') {
        throw new ValidationError(
          `The parent record of '${this.name}' does not exist in '${this.parent.name}'`,
        );
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

  /** Finds the matching elements, then writes once per table item whatever they need. */
  private async writePerTableItem(
    caller: Caller,
    filter: Filter,
    build: (builder: ExpressionBuilder, positions: number[][]) => { UpdateExpression: string },
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

    await this.root.executor.mapWrites([...perItem.values()], async ({ key, positions }) => {
      const builder = new ExpressionBuilder();
      const keyBuilder = new ExpressionBuilder('k', 'kv');
      const { UpdateExpression } = build(builder, positions);

      try {
        await this.root.executor.update({
          Key: key,
          UpdateExpression,
          ConditionExpression: `attribute_exists(${keyBuilder.attribute(this.rootKeys[0])})`,
          ExpressionAttributeNames: { ...builder.names, ...keyBuilder.names },
          ...(Object.keys(builder.values).length
            ? { ExpressionAttributeValues: builder.values }
            : {}),
        });
      } catch (error) {
        if (error.name !== 'ConditionalCheckFailedException') throw error;
      }
    });

    this.root.invalidateCaches();
  }
}
