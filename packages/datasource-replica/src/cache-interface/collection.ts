import type {
  TAggregateResult,
  TAggregation,
  TFilter,
  TPaginatedFilter,
  TRow,
} from '@forestadmin/datasource-customizer';
import type { Caller, Collection } from '@forestadmin/datasource-toolkit';

import {
  Aggregation,
  ConditionTreeFactory,
  Filter,
  Page,
  PaginatedFilter,
  Projection,
  Sort,
} from '@forestadmin/datasource-toolkit';

export default class CacheCollectionInterface {
  private collection: Collection;
  private caller: Caller;

  constructor(collection: Collection, caller: Caller) {
    this.caller = caller;
    this.collection = collection;
  }

  /**
   * List multiple records
   * @param filter the filter used to select the records to list
   * @param projection an array of fields name representing the data to select
   * @example
   * .list({
   *    conditionTree: {
   *      aggregator: 'And',
   *      conditions: [{
   *        field: 'amountInEur',
   *        operator: 'GreaterThan',
   *        value: 1000
   *      }, {
   *        field: 'description',
   *        operator: 'Contains',
   *        value: 'Refund',
   *      }],
   *      page: { limit: 10, skip: 0 },
   *      sort: [{ field: 'id', ascending: true }]
   *   }
   * }, ['id', 'amountInEur', 'description']);
   */
  list(filter: TPaginatedFilter, projection: string[]): Promise<TRow[]> {
    const filterInstance = this.buildPaginatedFilter(filter);
    const projectionInstance = this.buildProjection(projection);
    const rows = this.collection.list(this.caller, filterInstance, projectionInstance);

    return rows as Promise<TRow[]>;
  }

  /**
   * Aggregate a list of records
   * @param filter the filter used to list the records to aggregate
   * @param aggregation the aggregation to apply
   * @param limit the maximum number of result to return
   * @example
   * .aggregate({
   *    conditionTree: {
   *      field: "user:company:id",
   *      operator: "In",
   *      value: records.map((r) => r.id),
   *    },
   * }, {
   *    operation: "Sum",
   *    field: "amountInEur",
   *    groups: [{ field: "user:company:id" }],
   * }, 10);
   */
  async aggregate(
    filter: TFilter,
    aggregation: TAggregation,
    limit?: number,
  ): Promise<TAggregateResult[]> {
    const filterInstance = this.buildFilter(filter);
    const aggregationInstance = this.buildAggregation(aggregation);
    const result = await this.collection.aggregate(
      this.caller,
      filterInstance,
      aggregationInstance,
      limit,
    );

    return result as TAggregateResult[];
  }

  private buildFilter(filter: TFilter): Filter {
    return filter
      ? new Filter({
          ...filter,
          conditionTree: filter.conditionTree
            ? ConditionTreeFactory.fromPlainObject(filter.conditionTree)
            : undefined,
        })
      : null;
  }

  private buildPaginatedFilter(filter: TPaginatedFilter): PaginatedFilter {
    return new PaginatedFilter({
      ...filter,
      conditionTree: filter?.conditionTree
        ? ConditionTreeFactory.fromPlainObject(filter.conditionTree)
        : undefined,
      sort: filter.sort ? new Sort(...filter.sort) : undefined,
      page: filter.page ? new Page(filter.page.skip, filter.page.limit) : undefined,
    });
  }

  private buildProjection(projection: string[]): Projection {
    return new Projection(...projection);
  }

  private buildAggregation(aggregation: TAggregation): Aggregation {
    return new Aggregation(aggregation);
  }
}
