import { DataSource } from '../../interfaces/collection';
import { QueryRecipient } from '../../interfaces/user';
import RelaxedCollection from './collection';

/** DataSource wrapper which accepts plain objects in all methods */
export default class RelaxedDataSource {
  private dataSource: DataSource;
  private recipient: QueryRecipient;

  get collections(): RelaxedCollection[] {
    return this.dataSource.collections.map(c => new RelaxedCollection(c, this.recipient));
  }

  constructor(dataSource: DataSource, recipient: QueryRecipient) {
    this.dataSource = dataSource;
    this.recipient = recipient;
  }

  getCollection(name: string): RelaxedCollection {
    return new RelaxedCollection(this.dataSource.getCollection(name), this.recipient);
  }

  addCollection(): void {
    throw new Error('Cannot modify existing datasources.');
  }
}
