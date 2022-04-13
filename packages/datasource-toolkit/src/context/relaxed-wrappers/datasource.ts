import { DataSource } from '../../interfaces/collection';
import RelaxedCollection from './collection';

/** DataSource wrapper which accepts plain objects in all methods */
export default class RelaxedDataSource implements DataSource {
  private dataSource: DataSource;

  get collections(): RelaxedCollection[] {
    return this.dataSource.collections.map(c => new RelaxedCollection(c));
  }

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
  }

  getCollection(name: string): RelaxedCollection {
    return new RelaxedCollection(this.dataSource.getCollection(name));
  }

  addCollection(): void {
    throw new Error('Cannot modify existing datasources.');
  }
}
