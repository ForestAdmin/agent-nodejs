/* eslint-disable max-classes-per-file */
import { Caller, Collection, Filter, RecordData } from '@forestadmin/datasource-toolkit';

import { TCollectionName, TFilter, TRow, TSchema } from '../../../templates';
import HookContext from './hook';

export class HookBeforeUpdateContext<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> extends HookContext<S, N> {
  protected _filter: Filter;
  protected _patch: RecordData;

  constructor(collection: Collection, caller: Caller, filter: Filter, patch: RecordData) {
    super(collection, caller);

    this._filter = filter;
    this._patch = patch;
  }

  get filter() {
    return Object.freeze(this._filter as unknown as TFilter<S, N>);
  }

  get patch(): TRow<S, N> {
    return this._patch;
  }
}

export class InternalHookBeforeUpdateContext extends HookBeforeUpdateContext {
  getFilter(): Filter {
    return this._filter;
  }
}

export class HookAfterUpdateContext<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> extends HookBeforeUpdateContext<S, N> {}
