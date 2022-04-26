import { ActionField, ActionResult } from '../../interfaces/action';
import { Caller } from '../../interfaces/caller';
import { Collection } from '../../interfaces/collection';
import { CollectionSchema } from '../../interfaces/schema';
import { RecordData } from '../../interfaces/record';
import Aggregation, { AggregateResult, PlainAggregation } from '../../interfaces/query/aggregation';
import ConditionTreeFactory from '../../interfaces/query/condition-tree/factory';
import Filter, { PlainFilter } from '../../interfaces/query/filter/unpaginated';
import Page from '../../interfaces/query/page';
import PaginatedFilter, { PlainPaginatedFilter } from '../../interfaces/query/filter/paginated';
import Projection from '../../interfaces/query/projection';
import RelaxedDataSource from './datasource';
import Sort from '../../interfaces/query/sort';

/** Collection wrapper which accepts plain objects in all methods */
export default class RelaxedCollection {
  private collection: Collection;
  private caller: Caller;

  get dataSource(): RelaxedDataSource {
    return new RelaxedDataSource(this.collection.dataSource, this.caller);
  }

  /** @internal */
  get rawCollection(): Collection {
    return this.collection;
  }

  get name(): string {
    return this.collection.name;
  }

  get schema(): CollectionSchema {
    return this.collection.schema;
  }

  constructor(collection: Collection, caller: Caller) {
    this.collection = collection;
    this.caller = caller;
  }

  execute(
    name: string,
    formValues: RecordData,
    filter?: Filter | PlainFilter,
  ): Promise<ActionResult> {
    const filterInstance = this.buildFilter(filter);

    return this.collection.execute(this.caller, name, formValues, filterInstance);
  }

  getForm(
    name: string,
    formValues?: RecordData,
    filter?: Filter | PlainFilter,
  ): Promise<ActionField[]> {
    const filterInstance = this.buildFilter(filter);

    return this.collection.getForm(this.caller, name, formValues, filterInstance);
  }

  create(data: RecordData[]): Promise<RecordData[]> {
    return this.collection.create(this.caller, data);
  }

  list(
    filter: PaginatedFilter | PlainPaginatedFilter,
    projection: Projection | string[],
  ): Promise<RecordData[]> {
    const filterInstance = this.buildPaginatedFilter(filter);
    const projectionInstance = this.buildProjection(projection);

    return this.collection.list(this.caller, filterInstance, projectionInstance);
  }

  update(filter: Filter | PlainFilter, patch: RecordData): Promise<void> {
    const filterInstance = this.buildFilter(filter);

    return this.collection.update(this.caller, filterInstance, patch);
  }

  delete(filter: Filter | PlainFilter): Promise<void> {
    const filterInstance = this.buildFilter(filter);

    return this.collection.delete(this.caller, filterInstance);
  }

  aggregate(
    filter: Filter | PlainFilter,
    aggregation: Aggregation | PlainAggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    const filterInstance = this.buildFilter(filter);
    const aggregationInstance = this.buildAggregation(aggregation);

    return this.collection.aggregate(this.caller, filterInstance, aggregationInstance, limit);
  }

  private buildFilter(filter: Filter | PlainFilter): Filter {
    if (!filter) return null;
    if (filter instanceof Filter) return filter;

    return new Filter({
      ...filter,
      conditionTree: filter.conditionTree
        ? ConditionTreeFactory.fromPlainObject(filter.conditionTree)
        : undefined,
    });
  }

  private buildPaginatedFilter(filter: PaginatedFilter | PlainPaginatedFilter): PaginatedFilter {
    if (filter instanceof PaginatedFilter) return filter;

    return new PaginatedFilter({
      ...filter,
      conditionTree: filter?.conditionTree
        ? ConditionTreeFactory.fromPlainObject(filter.conditionTree)
        : undefined,
      sort: filter.sort ? new Sort(...filter.sort) : undefined,
      page: filter.page ? new Page(filter.page.skip, filter.page.limit) : undefined,
    });
  }

  private buildProjection(projection: Projection | string[]): Projection {
    if (projection instanceof Projection) return projection;

    return new Projection(...projection);
  }

  private buildAggregation(aggregation: Aggregation | PlainAggregation): Aggregation {
    if (aggregation instanceof Aggregation) return aggregation;

    return new Aggregation(aggregation);
  }
}
