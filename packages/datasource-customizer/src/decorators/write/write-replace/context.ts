import { Caller, Collection } from '@forestadmin/datasource-toolkit';

import CollectionCustomizationContext from '../../../context/collection-context';
import { TCollectionName, TPartialSimpleRow, TSchema } from '../../../templates';

export default class WriteCustomizationContext<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> extends CollectionCustomizationContext<S, N> {
  readonly action: 'update' | 'create';
  readonly record: TPartialSimpleRow<S, N>;

  constructor(
    collection: Collection,
    caller: Caller,
    action: 'update' | 'create',
    record: TPartialSimpleRow<S, N>,
  ) {
    super(collection, caller);

    this.action = action;
    this.record = Object.freeze({ ...record });
  }
}
