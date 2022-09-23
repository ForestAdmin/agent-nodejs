/* eslint-disable max-classes-per-file */
import { Caller } from '../../../interfaces/caller';
import { Collection } from '../../../interfaces/collection';
import {
  TAggregateResult,
  TAggregation,
  TCollectionName,
  TFilter,
  TSchema,
} from '../../../interfaces/templates';
import Aggregation from '../../../interfaces/query/aggregation';
import Filter from '../../../interfaces/query/filter/unpaginated';
import HookContext from './hook';

export class HookBeforeAggregateContext<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> extends HookContext<S, N> {
  protected _filter: Filter;
  protected _aggregation: Aggregation;
  protected _limit: number;

  constructor(
    collection: Collection,
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ) {
    super(collection, caller);

    this._filter = filter;
    this._aggregation = aggregation;
    this._limit = limit;
  }

  get filter() {
    return Object.freeze(this._filter as unknown as TFilter<S, N>);
  }

  get aggregation() {
    return Object.freeze(this._aggregation as unknown as TAggregation<S, N>);
  }

  get limit() {
    return this._limit;
  }
}

export class InternalHookBeforeAggregateContext extends HookBeforeAggregateContext {
  getFilter(): Filter {
    return this._filter;
  }

  getAggregation(): Aggregation {
    return this._aggregation;
  }
}

export class HookAfterAggregateContext<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> extends HookBeforeAggregateContext<S, N> {
  private _aggregateResult: TAggregateResult<S, N>[];

  constructor(
    collection: Collection,
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    aggregateResult: TAggregateResult<S, N>[],
    limit?: number,
  ) {
    super(collection, caller, filter, aggregation, limit);

    this._aggregateResult = aggregateResult;
  }

  get aggregateResult() {
    return Object.freeze(this._aggregateResult);
  }
}
