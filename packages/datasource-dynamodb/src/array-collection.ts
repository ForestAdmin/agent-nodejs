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

export type ArrayCollectionConfig = {
  name: string;
  /** Attribute of the parent holding the array, `a->b` for a nested one. */
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
 * Exposes an array of maps stored in the items of another collection as a collection of its own.
 * A record is identified by the key of its parent and its position in the array, which is why
 * those positions move when an earlier item of the same array is removed.
 */
export default class ArrayCollection extends BaseCollection {
  private readonly parent: DynamoDBCollection;
  private readonly arrayField: string;
  private readonly parentKeys: string[];
  private readonly itemFields: Set<string>;

  constructor(datasource: DataSource, parent: DynamoDBCollection, config: ArrayCollectionConfig) {
    super(config.name, datasource, parent.nativeDriver);

    this.parent = parent;
    this.arrayField = config.arrayField;

    const { partitionKey, sortKey } = parent.model;
    const keys = [partitionKey, sortKey].filter(Boolean);
    this.parentKeys = keys.map(key => key.name);

    const schema: Record<string, AttributeSchema> = {
      ...config.itemSchema,
      ...Object.fromEntries(
        keys.map(key => [key.name, { type: key.type === 'N' ? 'number' : 'string' }]),
      ),
      [INDEX_FIELD]: { type: 'number' },
    };
    const model: TableModel = {
      ...parent.model,
      name: config.name,
      indexes: [],
      schema,
      overrideTypeConverter: undefined,
    };
    const fields = convertModelToFields(model);

    for (const name of [...this.parentKeys, INDEX_FIELD]) {
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

    this.parent.invalidateCaches();

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
      if (field === INDEX_FIELD || this.parentKeys.includes(field)) {
        throw new ValidationError(`The attribute '${field}' of '${this.name}' cannot be updated`);
      }
    }

    const entries = Object.entries(patch).filter(([, value]) => value !== undefined);

    if (entries.length === 0) return;

    await this.writePerParent(caller, filter, (builder, indexes) => {
      const values = entries.map(([, value]) => builder.value(value));
      const array = builder.attribute(this.arrayField);

      return {
        UpdateExpression: `SET ${indexes
          .flatMap(index =>
            entries.map(
              ([field], position) =>
                `${array}[${index}].${builder.attribute(field)} = ${values[position]}`,
            ),
          )
          .join(', ')}`,
      };
    });
  }

  async delete(caller: Caller, filter: Filter): Promise<void> {
    await this.writePerParent(caller, filter, (builder, indexes) => {
      const array = builder.attribute(this.arrayField);
      const descending = [...indexes].sort((a, b) => b - a);

      return { UpdateExpression: `REMOVE ${descending.map(i => `${array}[${i}]`).join(', ')}` };
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

  /** Reads the parents, then turns each array item into a record and applies the filter to it. */
  private async readRecords(caller: Caller, tree?: ConditionTree): Promise<RecordData[]> {
    // Conditions on the parent key narrow the parents read; the rest applies to the items.
    const onParentKey = conjuncts(tree).filter(
      condition =>
        condition instanceof ConditionTreeLeaf && this.parentKeys.includes(condition.field),
    );
    const parents = await this.parent.list(
      caller,
      new PaginatedFilterClass({
        conditionTree: onParentKey.length
          ? ConditionTreeFactory.intersect(...onParentKey)
          : undefined,
      }),
      new Projection(...this.parentKeys, this.arrayField),
    );

    const records: RecordData[] = [];

    for (const parent of parents) {
      const items = parent[this.arrayField];

      if (Array.isArray(items)) {
        items.forEach((item, index) => {
          if (item && typeof item === 'object') {
            records.push({
              ...Object.fromEntries(this.parentKeys.map(key => [key, parent[key]])),
              [INDEX_FIELD]: index,
              ...Serializer.flatten(item as Item, this.itemFields),
            });
          }
        });
      }
    }

    return tree ? records.filter(record => tree.match(record, this, caller.timezone)) : records;
  }

  private async append(record: RecordData): Promise<RecordData> {
    const key: Item = {};

    for (const name of this.parentKeys) {
      if (record[name] === undefined || record[name] === null) {
        throw new ValidationError(
          `The key attribute '${name}' of the parent '${this.parent.name}' is required to create ` +
            `a record in '${this.name}'`,
        );
      }

      key[name] = record[name];
    }

    const fields = Object.fromEntries(
      Object.entries(record).filter(
        ([name]) => !this.parentKeys.includes(name) && name !== INDEX_FIELD,
      ),
    );
    const builder = new ExpressionBuilder();
    const keyBuilder = new ExpressionBuilder('k', 'kv');
    const arrayAlias = builder.attribute(this.arrayField);
    const emptyList = builder.value([]);
    const appended = builder.value([Serializer.unflatten(fields)]);
    const expression = `SET ${arrayAlias} = list_append(if_not_exists(${arrayAlias}, ${emptyList}), ${appended})`;

    let attributes: Item;

    try {
      attributes = await this.parent.executor.update({
        Key: key,
        UpdateExpression: expression,
        ConditionExpression: `attribute_exists(${keyBuilder.attribute(this.parentKeys[0])})`,
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

    const array = Serializer.toPathSegments(this.arrayField).reduce<unknown>(
      (value, segment) => (value as Item)?.[segment],
      attributes,
    ) as unknown[];

    return { ...key, [INDEX_FIELD]: array.length - 1, ...fields };
  }

  /** Finds the matching items, then writes once per parent whatever the items need. */
  private async writePerParent(
    caller: Caller,
    filter: Filter,
    build: (builder: ExpressionBuilder, indexes: number[]) => { UpdateExpression: string },
  ): Promise<void> {
    const records = await this.list(
      caller,
      new PaginatedFilterClass({ conditionTree: filter.conditionTree }),
      new Projection(...this.parentKeys, INDEX_FIELD),
    );
    const perParent = new Map<string, { key: Item; indexes: number[] }>();

    for (const record of records) {
      const key = Object.fromEntries(this.parentKeys.map(name => [name, record[name]]));
      const id = JSON.stringify(key);
      const entry = perParent.get(id) ?? { key, indexes: [] };
      entry.indexes.push(record[INDEX_FIELD] as number);
      perParent.set(id, entry);
    }

    await this.parent.executor.mapWrites([...perParent.values()], async ({ key, indexes }) => {
      const builder = new ExpressionBuilder();
      const keyBuilder = new ExpressionBuilder('k', 'kv');
      const { UpdateExpression } = build(
        builder,
        [...indexes].sort((a, b) => a - b),
      );

      try {
        await this.parent.executor.update({
          Key: key,
          UpdateExpression,
          ConditionExpression: `attribute_exists(${keyBuilder.attribute(this.parentKeys[0])})`,
          ExpressionAttributeNames: { ...builder.names, ...keyBuilder.names },
          ...(Object.keys(builder.values).length
            ? { ExpressionAttributeValues: builder.values }
            : {}),
        });
      } catch (error) {
        if (error.name !== 'ConditionalCheckFailedException') throw error;
      }
    });

    this.parent.invalidateCaches();
  }
}
