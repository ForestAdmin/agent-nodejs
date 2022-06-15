/* eslint-disable */
import {
  AggregateResult,
  Aggregation,
  BaseCollection,
  Caller,
  DataSource,
  Filter,
  PaginatedFilter,
  Projection,
  RecordData,
  SchemaUtils,
  TSchema,
} from '@forestadmin/datasource-toolkit';
import { Model } from 'dynamoose/dist/Model';
import ConditionBuilder from './utils/condition-builder';
import SchemaBuilder from './utils/schema-builder';

export default class DynamooseCollection extends BaseCollection {
  private model: Model<any>;

  constructor(dataSource: DataSource, model: Model<any>) {
    super(model.originalName, dataSource);

    this.model = model;
    this.addFields(SchemaBuilder.convert(model.schemas[0].schemaObject));
  }

  async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    await this.model.batchPut(data);
    return data;
  }

  async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    // Convert filter
    const condition = ConditionBuilder.fromTree(filter.conditionTree);

    // Handle pagination
    const limit = filter.page?.limit ?? undefined;
    const startAt = filter.page?.cursor
      ? SchemaUtils.getPrimaryKeys(this.schema).reduce(
          (memo, key, idx) => ({ ...memo, [key]: filter.page?.cursor[idx] }),
          {},
        )
      : undefined;

    // Make requests satisfy the pagination settings.
    let scanSize = limit ?? 1000;
    let scannedCount = null;
    let lastKey = startAt;
    let records = [];

    while ((!limit || records.length < limit) && (scannedCount === null || lastKey)) {
      // Try to query, resort to scan if dynamoose can't find an index on its own.
      let result;
      for (const method of [this.model.query, this.model.scan]) {
        try {
          result = await method(condition)
            .attributes(projection)
            .startAt(lastKey)
            .limit(scanSize)
            .exec();

          break;
        } catch (e) {
          // If the scan failed, rethrow the error
          if (method === this.model.scan) throw e;
        }
      }

      // Update counters
      records.push(...result);
      lastKey = result.lastKey;
      scannedCount = result.queriedCount ?? result.scannedCount;

      // Increase scanSize to save time if user is filtering.
      scanSize = Math.min(1000, scanSize * 2);
    }

    return records.slice(0, limit);
  }

  async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    const columns = new Projection(...Object.keys(this.schema.fields));
    const records = await this.list(caller, filter, columns);

    for (const record of records) Object.assign(record, patch);

    await this.model.batchPut(records);
  }

  async delete(caller: Caller, filter: Filter): Promise<void> {
    const columns = new Projection().withPks(this);
    const records = await this.list(caller, filter, columns);

    await this.model.batchDelete(records);
  }

  async aggregate(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult<TSchema, string>[]> {
    // There is no aggregation in dynamodb, so we emulate everything (count is disabled).
    return aggregation.apply(
      await this.list(caller, filter, aggregation.projection),
      caller.timezone,
      limit,
    );
  }
}
