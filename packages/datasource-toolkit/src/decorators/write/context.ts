import { Collection } from '../../interfaces/collection';
import { QueryRecipient } from '../../interfaces/user';
import { RecordData } from '../../interfaces/record';
import CollectionCustomizationContext from '../../context/collection-context';

export default class WriteCustomizationContext extends CollectionCustomizationContext {
  readonly action: 'update' | 'create';
  readonly record: RecordData;

  constructor(
    collection: Collection,
    recipient: QueryRecipient,
    action: 'update' | 'create',
    record: RecordData,
  ) {
    super(collection, recipient);

    this.action = action;
    this.record = record;
  }
}
