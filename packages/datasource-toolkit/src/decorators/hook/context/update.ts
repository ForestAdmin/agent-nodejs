/* eslint-disable max-classes-per-file */
import { Caller } from '../../../interfaces/caller';
import { Collection } from '../../../interfaces/collection';
import { RecordData } from '../../../interfaces/record';
import { TCollectionName, TRow, TSchema } from '../../../interfaces/templates';
import Filter, { PlainFilter } from '../../../interfaces/query/filter/unpaginated';
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
    return Object.freeze(this._filter as unknown as PlainFilter<S, N>);
  }

  get patch() {
    return Object.freeze(this._patch as unknown as TRow<S, N>);
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
