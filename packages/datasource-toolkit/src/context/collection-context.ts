import { Collection } from '../interfaces/collection';
import { QueryRecipient } from '../interfaces/user';
import AgentCustomizationContext from './agent-context';
import RelaxedCollection from './relaxed-wrappers/collection';

export default class CollectionCustomizationContext extends AgentCustomizationContext {
  private realCollection: Collection;

  get collection(): RelaxedCollection {
    return new RelaxedCollection(this.realCollection, this.recipient);
  }

  constructor(collection: Collection, recipient: QueryRecipient) {
    super(collection.dataSource, recipient);
    this.realCollection = collection;
  }
}
