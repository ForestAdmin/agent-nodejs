import { Caller } from '../../interfaces/caller';
import { Collection } from '../../interfaces/collection';
import { RecordData } from '../../interfaces/record';
import CollectionCustomizationContext from '../../context/collection-context';

export default class WriteCustomizationContext extends CollectionCustomizationContext {
  readonly action: 'update' | 'create';
  readonly record: RecordData;

  constructor(
    collection: Collection,
    caller: Caller,
    action: 'update' | 'create',
    record: RecordData,
  ) {
    super(collection, caller);

    this.action = action;
    this.record = record;
  }
}
