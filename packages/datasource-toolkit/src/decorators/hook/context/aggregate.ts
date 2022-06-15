/* eslint-disable max-classes-per-file */
import { Caller } from '../../../interfaces/caller';
import { Collection } from '../../../interfaces/collection';
import { TCollectionName, TSchema } from '../../../interfaces/templates';
import Aggregation, {
  AggregateResult,
  PlainAggregation,
} from '../../../interfaces/query/aggregation';
import Filter, { PlainFilter } from '../../../interfaces/query/filter/unpaginated';
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
    return Object.freeze(this._filter as unknown as PlainFilter<S, N>);
  }

  get aggregation() {
    return Object.freeze(this._aggregation as unknown as PlainAggregation<S, N>);
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
  private _aggregateResult: AggregateResult<S, N>[];

  constructor(
    collection: Collection,
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    aggregateResult: AggregateResult<S, N>[],
    limit?: number,
  ) {
    super(collection, caller, filter, aggregation, limit);

    this._aggregateResult = aggregateResult;
  }

  get aggregateResult() {
    return Object.freeze(this._aggregateResult);
  }
}
