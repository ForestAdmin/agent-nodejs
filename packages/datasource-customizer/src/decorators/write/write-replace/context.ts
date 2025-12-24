import type { TCollectionName, TFilter, TPartialSimpleRow, TSchema } from '../../../templates';
import type { Caller, Collection, Filter } from '@forestadmin/datasource-toolkit';

import CollectionCustomizationContext from '../../../context/collection-context';

export default class WriteCustomizationContext<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> extends CollectionCustomizationContext<S, N> {
  readonly action: 'update' | 'create';
  readonly record: TPartialSimpleRow<S, N>;
  readonly filter?: TFilter<S, N>;

  constructor(
    collection: Collection,
    caller: Caller,
    action: 'update' | 'create',
    record: TPartialSimpleRow<S, N>,
    filter?: Filter,
  ) {
    super(collection, caller);

    this.action = action;
    this.filter = filter as unknown as TFilter<S, N>;
    this.record = Object.freeze({ ...record });
  }
}
