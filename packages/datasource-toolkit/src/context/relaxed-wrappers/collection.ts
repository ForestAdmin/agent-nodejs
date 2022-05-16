import { ActionField, ActionResult } from '../../interfaces/action';
import { Caller } from '../../interfaces/caller';
import { Collection } from '../../interfaces/collection';
import { RecordData } from '../../interfaces/record';
import {
  TCollectionName,
  TFieldName,
  TPartialSimpleRow,
  TRow,
  TSchema,
  TSimpleRow,
} from '../../interfaces/templates';
import Aggregation, { AggregateResult, PlainAggregation } from '../../interfaces/query/aggregation';
import ConditionTreeFactory from '../../interfaces/query/condition-tree/factory';
import Filter, { PlainFilter } from '../../interfaces/query/filter/unpaginated';
import Page from '../../interfaces/query/page';
import PaginatedFilter, { PlainPaginatedFilter } from '../../interfaces/query/filter/paginated';
import Projection from '../../interfaces/query/projection';
import Sort from '../../interfaces/query/sort';

/** Collection wrapper which accepts plain objects in all methods */
export default class RelaxedCollection<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> {
  private collection: Collection;
  private caller: Caller;

  constructor(collection: Collection, caller: Caller) {
    this.collection = collection;
    this.caller = caller;
  }

  execute(name: string, formValues: RecordData, filter?: PlainFilter<S, N>): Promise<ActionResult> {
    const filterInstance = this.buildFilter(filter);

    return this.collection.execute(this.caller, name, formValues, filterInstance);
  }

  getForm(
    name: string,
    formValues?: RecordData,
    filter?: PlainFilter<S, N>,
  ): Promise<ActionField[]> {
    const filterInstance = this.buildFilter(filter);

    return this.collection.getForm(this.caller, name, formValues, filterInstance);
  }

  create(data: TSimpleRow<S, N>[]): Promise<TSimpleRow<S, N>[]> {
    return this.collection.create(this.caller, data) as Promise<TSimpleRow<S, N>[]>;
  }

  list(filter: PlainPaginatedFilter<S, N>, projection: TFieldName<S, N>[]): Promise<TRow<S, N>[]> {
    const filterInstance = this.buildPaginatedFilter(filter);
    const projectionInstance = this.buildProjection(projection);
    const rows = this.collection.list(this.caller, filterInstance, projectionInstance);

    return rows as Promise<TRow<S, N>[]>;
  }

  update(filter: PlainFilter<S, N>, patch: TPartialSimpleRow<S, N>): Promise<void> {
    const filterInstance = this.buildFilter(filter);

    return this.collection.update(this.caller, filterInstance, patch);
  }

  delete(filter: PlainFilter<S, N>): Promise<void> {
    const filterInstance = this.buildFilter(filter);

    return this.collection.delete(this.caller, filterInstance);
  }

  aggregate(
    filter: PlainFilter<S, N>,
    aggregation: PlainAggregation<S, N>,
    limit?: number,
  ): Promise<AggregateResult<S, N>[]> {
    const filterInstance = this.buildFilter(filter);
    const aggregationInstance = this.buildAggregation(aggregation);

    return this.collection.aggregate(this.caller, filterInstance, aggregationInstance, limit);
  }

  private buildFilter(filter: PlainFilter<S, N>): Filter {
    return filter
      ? new Filter({
          ...filter,
          conditionTree: filter.conditionTree
            ? ConditionTreeFactory.fromPlainObject(filter.conditionTree)
            : undefined,
        })
      : null;
  }

  private buildPaginatedFilter(filter: PlainPaginatedFilter<S, N>): PaginatedFilter {
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

  private buildAggregation(aggregation: PlainAggregation<S, N>): Aggregation {
    return new Aggregation(aggregation);
  }
}
