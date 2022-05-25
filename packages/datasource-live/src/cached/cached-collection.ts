import {
  ActionField,
  ActionResult,
  AggregateResult,
  Aggregation,
  Caller,
  Collection,
  CollectionSchema,
  ConditionTreeFactory,
  Filter,
  PaginatedFilter,
  Projection,
  ProjectionFactory,
  RecordData,
  RecordUtils,
} from '@forestadmin/datasource-toolkit';
import { CachedDataSourceOptions } from '../types';
import CachedDataSource from './cached-datasource';

export default class CachedCollection implements Collection {
  dataSource: CachedDataSource;

  private cache: Collection;
  private options: CachedDataSourceOptions;

  constructor(cache: Collection, dataSource: CachedDataSource, options: CachedDataSourceOptions) {
    this.dataSource = dataSource;
    this.cache = cache;
    this.options = options;
  }

  get name(): string {
    return this.cache.name;
  }

  get schema(): CollectionSchema {
    return this.cache.schema;
  }

  async create(caller: Caller, records: RecordData[]): Promise<RecordData[]> {
    const promises = records.map(record => this.options.createRecord(this.name, record));
    await Promise.all(promises);

    const projection = ProjectionFactory.columns(this);
    const filter = new PaginatedFilter({
      conditionTree: ConditionTreeFactory.matchRecords(this.schema, records),
    });

    return this.list(caller, filter, projection);
  }

  async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    await this.dataSource.sync();

    return this.cache.list(caller, filter, projection);
  }

  async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    const records = await this.list(caller, filter, new Projection().withPks(this));
    const promises = records
      .map(record => RecordUtils.getPrimaryKey(this.schema, record))
      .map(id => this.options.updateRecord(this.name, id, patch));

    await Promise.all(promises);
  }

  async delete(caller: Caller, filter: Filter): Promise<void> {
    const records = await this.list(caller, filter, new Projection().withPks(this));
    const promises = records
      .map(record => RecordUtils.getPrimaryKey(this.schema, record))
      .map(id => this.options.deleteRecord(this.name, id));

    await Promise.all(promises);
  }

  async aggregate(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    await this.dataSource.sync();

    return this.cache.aggregate(caller, filter, aggregation, limit);
  }

  execute(): Promise<ActionResult> {
    throw new Error('Method not implemented.');
  }

  getForm(): Promise<ActionField[]> {
    throw new Error('Method not implemented.');
  }
}
