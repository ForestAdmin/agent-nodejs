// eslint-disable-next-line max-classes-per-file
import type { TCollectionName, TFilter, TPartialSimpleRow, TSchema } from '../../templates';
import type { Caller, Collection, Filter } from '@forestadmin/datasource-toolkit';

import CollectionCustomizationContext from '../../context/collection-context';

export class CreateOverrideCustomizationContext<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> extends CollectionCustomizationContext<S, N> {
  readonly data: TPartialSimpleRow<S, N>[];

  constructor(collection: Collection, caller: Caller, data: TPartialSimpleRow<S, N>[]) {
    super(collection, caller);

    this.data = data;
  }
}

export class UpdateOverrideCustomizationContext<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> extends CollectionCustomizationContext<S, N> {
  readonly filter: TFilter<S, N>;
  readonly patch: TPartialSimpleRow<S, N>;

  constructor(
    collection: Collection,
    caller: Caller,
    filter: Filter,
    patch: TPartialSimpleRow<S, N>,
  ) {
    super(collection, caller);

    this.filter = filter as unknown as TFilter<S, N>;
    this.patch = patch;
  }
}

export class DeleteOverrideCustomizationContext<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> extends CollectionCustomizationContext<S, N> {
  readonly filter: TFilter<S, N>;

  constructor(collection: Collection, caller: Caller, filter: Filter) {
    super(collection, caller);

    this.filter = filter as unknown as TFilter<S, N>;
  }
}
