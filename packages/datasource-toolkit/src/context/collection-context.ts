import { Caller } from '../interfaces/caller';
import { Collection } from '../interfaces/collection';
import { TCollectionName, TSchema } from '../interfaces/templates';
import AgentCustomizationContext from './agent-context';
import RelaxedCollection from './relaxed-wrappers/collection';

export default class CollectionCustomizationContext<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> extends AgentCustomizationContext<S> {
  protected realCollection: Collection;

  get collection(): RelaxedCollection<S, N> {
    return new RelaxedCollection(this.realCollection, this.caller);
  }

  constructor(collection: Collection, caller: Caller) {
    super(collection.dataSource, caller);
    this.realCollection = collection;
  }
}
