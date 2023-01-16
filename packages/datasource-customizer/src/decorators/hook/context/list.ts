/* eslint-disable max-classes-per-file */

import {
  Caller,
  Collection,
  PaginatedFilter,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';

import HookContext from './hook';
import { TCollectionName, TFieldName, TPaginatedFilter, TRow, TSchema } from '../../../templates';

export class HookBeforeListContext<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> extends HookContext<S, N> {
  protected _filter: PaginatedFilter;
  protected _projection: Projection;

  constructor(
    collection: Collection,
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ) {
    super(collection, caller);

    this._filter = filter;
    this._projection = projection;
  }

  get filter() {
    return Object.freeze(this._filter as unknown as TPaginatedFilter<S, N>);
  }

  get projection() {
    return Object.freeze(this._projection as unknown as TFieldName<S, N>[]);
  }
}

export class InternalHookBeforeListContext extends HookBeforeListContext {
  getFilter(): PaginatedFilter {
    return this._filter;
  }

  getProjection(): Projection {
    return this._projection;
  }
}

export class HookAfterListContext<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> extends HookBeforeListContext<S, N> {
  private _records: TRow<S, N>[];

  constructor(
    collection: Collection,
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
    records: RecordData[],
  ) {
    super(collection, caller, filter, projection);

    this._records = records as TRow<S, N>[];
  }

  get records() {
    return Object.freeze(this._records);
  }
}
