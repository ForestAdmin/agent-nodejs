import { Caller } from '../../interfaces/caller';
import { DataSource } from '../../interfaces/collection';
import RelaxedCollection from './collection';

/** DataSource wrapper which accepts plain objects in all methods */
export default class RelaxedDataSource {
  private dataSource: DataSource;
  private caller: Caller;

  constructor(dataSource: DataSource, caller: Caller) {
    this.dataSource = dataSource;
    this.caller = caller;
  }

  getCollection(name: string): RelaxedCollection {
    return new RelaxedCollection(this.dataSource.getCollection(name), this.caller);
  }
}
