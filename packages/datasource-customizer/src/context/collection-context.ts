import { Caller, Collection } from '@forestadmin/datasource-toolkit';

import AgentCustomizationContext from './agent-context';
import RelaxedCollection from './relaxed-wrappers/collection';
import { TCollectionName, TSchema } from '../templates';

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
