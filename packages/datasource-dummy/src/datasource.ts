import { BaseDataSource, Collection } from '@forestadmin/datasource-toolkit';
import BookCollection from './collections/books';

export default class DummyDataSource extends BaseDataSource<Collection> {
  constructor() {
    super();

    this.collections.push(new BookCollection(this));
  }
}
