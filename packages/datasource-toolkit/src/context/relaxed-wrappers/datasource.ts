import { Caller } from '../../interfaces/caller';
import { DataSource } from '../../interfaces/collection';
import { TCollectionName, TSchema } from '../../interfaces/templates';
import RelaxedCollection from './collection';

/** DataSource wrapper which accepts plain objects in all methods */
export default class RelaxedDataSource<S extends TSchema = TSchema> {
  private dataSource: DataSource;
  private caller: Caller;

  constructor(dataSource: DataSource, caller: Caller) {
    this.dataSource = dataSource;
    this.caller = caller;
  }

  getCollection<N extends TCollectionName<S>>(name: N): RelaxedCollection<S, N> {
    return new RelaxedCollection(this.dataSource.getCollection(name), this.caller);
  }
}
