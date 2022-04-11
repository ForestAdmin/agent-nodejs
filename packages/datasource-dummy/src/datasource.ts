import { BaseDataSource, Logger } from '@forestadmin/datasource-toolkit';

import BooksCollection from './collections/books';
import LibrariesBooksCollection from './collections/libraries-books';
import LibrariesCollection from './collections/libraries';
import PersonsCollection from './collections/persons';

export default class DummyDataSource extends BaseDataSource {
  constructor(logger: Logger) {
    super(logger);

    this.addCollection(new BooksCollection(this));
    this.addCollection(new PersonsCollection(this));
    this.addCollection(new LibrariesCollection(this));
    this.addCollection(new LibrariesBooksCollection(this));
  }
}
