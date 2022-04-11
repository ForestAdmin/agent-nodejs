import { Collection } from '../interfaces/collection';
import AgentCustomizationContext from './agent-context';
import RelaxedCollection from './relaxed-wrappers/collection';

export default class CollectionCustomizationContext extends AgentCustomizationContext {
  private realCollection: Collection;

  get collection(): RelaxedCollection {
    return new RelaxedCollection(this.realCollection);
  }

  constructor(collection: Collection, timezone: string = null) {
    super(collection.dataSource, timezone);
    this.realCollection = collection;
  }
}
