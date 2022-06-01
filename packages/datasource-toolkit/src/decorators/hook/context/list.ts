/* eslint-disable max-classes-per-file */
import { Caller } from '../../../interfaces/caller';
import { Collection } from '../../../interfaces/collection';
import { RecordData } from '../../../interfaces/record';
import { TCollectionName, TFieldName, TRow, TSchema } from '../../../interfaces/templates';
import HookContext from './hook';
import PaginatedFilter, { PlainPaginatedFilter } from '../../../interfaces/query/filter/paginated';
import Projection from '../../../interfaces/query/projection';

export class HookBeforeListContext<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> extends HookContext<S, N> {
  readonly filter: PlainPaginatedFilter<S, N>;
  readonly projection: TFieldName<S, N>[];

  constructor(
    collection: Collection,
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ) {
    super(collection, caller);

    this.filter = filter as unknown as PlainPaginatedFilter<S, N>;
    this.projection = projection as unknown as TFieldName<S, N>[];
  }
}

export class HookAfterListContext<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> extends HookBeforeListContext<S, N> {
  readonly records: TRow<S, N>[];

  constructor(
    collection: Collection,
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
    records: RecordData[],
  ) {
    super(collection, caller, filter, projection);

    this.records = records as TRow<S, N>[];
  }
}
