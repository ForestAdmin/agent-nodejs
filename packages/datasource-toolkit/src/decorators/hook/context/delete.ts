/* eslint-disable max-classes-per-file */
import { Caller } from '../../../interfaces/caller';
import { Collection } from '../../../interfaces/collection';
import { TCollectionName, TFilter, TSchema } from '../../../interfaces/templates';
import Filter from '../../../interfaces/query/filter/unpaginated';
import HookContext from './hook';

export class HookBeforeDeleteContext<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> extends HookContext<S, N> {
  protected _filter: Filter;

  constructor(collection: Collection, caller: Caller, filter: Filter) {
    super(collection, caller);

    this._filter = filter;
  }

  get filter() {
    return Object.freeze(this._filter as unknown as TFilter<S, N>);
  }
}

export class InternalHookBeforeDeleteContext extends HookBeforeDeleteContext {
  getFilter(): Filter {
    return this._filter;
  }
}

export class HookAfterDeleteContext<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> extends HookBeforeDeleteContext<S, N> {}
