import {
  AggregateResult,
  Aggregation,
  Caller,
  CollectionDecorator,
  Filter,
  PaginatedFilter,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';

import FullLoadDataSourceDecorator from './data-source';

export default class FullLoadCollectionDecorator extends CollectionDecorator {
  override dataSource: FullLoadDataSourceDecorator;

  override async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    return super.list(caller, filter, projection);
  }

  override async aggregate(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    return super.aggregate(caller, filter, aggregation, limit);
  }

  private get options() {
    return this.dataSource.options;
  }
}
