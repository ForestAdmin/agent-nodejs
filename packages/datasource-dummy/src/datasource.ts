import { BaseDataSource, Collection } from '@forestadmin/datasource-toolkit';
import BooksCollection from './collections/books';
import PersonsCollection from './collections/persons';

export default class DummyDataSource extends BaseDataSource<Collection> {
  constructor() {
    super();

    this.addCollection(new BooksCollection(this));
    this.addCollection(new PersonsCollection(this));
  }
}
