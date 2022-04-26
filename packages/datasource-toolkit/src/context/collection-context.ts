import { Caller } from '../interfaces/caller';
import { Collection } from '../interfaces/collection';
import AgentCustomizationContext from './agent-context';
import RelaxedCollection from './relaxed-wrappers/collection';

export default class CollectionCustomizationContext extends AgentCustomizationContext {
  private realCollection: Collection;

  get collection(): RelaxedCollection {
    return new RelaxedCollection(this.realCollection, this.caller);
  }

  constructor(collection: Collection, caller: Caller) {
    super(collection.dataSource, caller);
    this.realCollection = collection;
  }
}
