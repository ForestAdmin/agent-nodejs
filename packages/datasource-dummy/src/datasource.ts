import { BaseDatasource, Collection } from '@forestadmin/datasource-toolkit';
import BookCollection from './collections/books';

export default class DummyDataSource extends BaseDatasource<Collection> {
  constructor() {
    super();

    this.collections.push(new BookCollection(this));
  }
}
