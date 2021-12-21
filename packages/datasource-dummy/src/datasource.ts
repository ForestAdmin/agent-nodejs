import { Collection, DataSource } from '@forestadmin/datasource-toolkit';
import BookCollection from './collections/books';

export default class DummyDataSource implements DataSource {
  readonly collections: Collection[] = [new BookCollection(this)];

  getCollection(name: string): Collection {
    return name === 'book' ? this.collections[0] : null;
  }
}
