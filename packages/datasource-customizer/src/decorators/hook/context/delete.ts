/* eslint-disable max-classes-per-file */

import { Caller, Collection, Filter } from '@forestadmin/datasource-toolkit';
import { TCollectionName, TFilter, TSchema } from '../../../templates';
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
