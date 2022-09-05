import * as factories from '../../__factories__';
import { Collection, DataSource } from '../../../src/interfaces/collection';
import { ColumnSchema } from '../../../src/interfaces/schema';
import { RecordData } from '../../../src/interfaces/record';
import DataSourceDecorator from '../../../src/decorators/datasource-decorator';
import Page from '../../../src/interfaces/query/page';
import PaginatedFilter from '../../../src/interfaces/query/filter/paginated';
import Projection from '../../../src/interfaces/query/projection';
import Sort from '../../../src/interfaces/query/sort';
import SortEmulationDecorator from '../../../src/decorators/sort-emulate/collection';

describe('SortEmulationDecoratorCollection', () => {
  // State
  let dataSource: DataSource;
  let decoratedDataSource: DataSourceDecorator<SortEmulationDecorator>;

  // Convenience: Direct access to collections before and after decoration
  let books: Collection;
  let newBooks: SortEmulationDecorator;

  // Build datasource
  beforeEach(() => {
    books = factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.isPrimaryKey().build(),
          title: factories.columnSchema.build({ isSortable: false }),
        },
      }),
    });

    dataSource = factories.dataSource.buildWithCollections([books]);
  });

  // Build decorator
  beforeEach(() => {
    decoratedDataSource = new DataSourceDecorator(dataSource, SortEmulationDecorator);

    newBooks = decoratedDataSource.getCollection('books');
  });

  test('emulateFieldSorting() should throw if the field does not exists', () => {
    expect(() => newBooks.emulateFieldSorting('__dontExist')).toThrow(
      "Column not found: 'books.__dontExist'",
    );
  });

  test('emulateFieldSorting() should throw if the field is a relation', () => {
    expect(() => newBooks.emulateFieldSorting('author')).toThrow(
      "Unexpected field type: 'books.author' (found 'ManyToOne' expected 'Column')",
    );
  });

  test('emulateFieldSorting() should throw if the field is in a relation', () => {
    expect(() => newBooks.emulateFieldSorting('author:firstName')).toThrow(
      'Cannot replace sort on relation',
    );
  });

  describe('when emulating sort on book.title (no relations)', () => {
    beforeEach(() => {
      newBooks.emulateFieldSorting('title');
    });

    test('schema should be updated', () => {
      const schema = newBooks.schema.fields.title as ColumnSchema;
      expect(schema.isSortable).toBeTruthy();
    });

    test('should work in ascending order', async () => {
      const records = await newBooks.list(
        factories.caller.build(),
        new PaginatedFilter({ sort: new Sort({ field: 'title', ascending: true }) }),
        new Projection('id', 'title'),
      );

      expect(records).toStrictEqual([
        { id: 2, title: 'Beat the dealer' },
        { id: 1, title: 'Foundation' },
        { id: 3, title: 'Gomorrah' },
      ]);
    });

    test('should work in descending order', async () => {
      const records = await newBooks.list(
        factories.caller.build(),
        new PaginatedFilter({ sort: new Sort({ field: 'title', ascending: false }) }),
        new Projection('id', 'title'),
      );

      expect(records).toStrictEqual([
        { id: 3, title: 'Gomorrah' },
        { id: 1, title: 'Foundation' },
        { id: 2, title: 'Beat the dealer' },
      ]);
    });

    test('should work with pagination', async () => {
      const records = await newBooks.list(
        factories.caller.build(),
        new PaginatedFilter({
          page: new Page(2, 1),
          sort: new Sort({ field: 'title', ascending: false }),
        }),
        new Projection('id', 'title'),
      );

      expect(records).toStrictEqual([{ id: 2, title: 'Beat the dealer' }]);
    });
  });

  describe('when emulating sort on book.author.lastName (relation)', () => {
    beforeEach(() => {
      newPersons.emulateFieldSorting('lastName');
    });

    test('schema should be updated', () => {
      const schema = newPersons.schema.fields.lastName as ColumnSchema;
      expect(schema.isSortable).toBeTruthy();
    });

    test('should work in ascending order', async () => {
      const records = await newBooks.list(
        factories.caller.build(),
        new PaginatedFilter({ sort: new Sort({ field: 'author:lastName', ascending: true }) }),
        new Projection('id', 'title', 'author:lastName'),
      );

      expect(records).toStrictEqual([
        { id: 1, title: 'Foundation', author: { lastName: 'Asimov' } },
        { id: 3, title: 'Gomorrah', author: { lastName: 'Saviano' } },
        { id: 2, title: 'Beat the dealer', author: { lastName: 'Thorp' } },
      ]);
    });

    test('should work in descending order', async () => {
      const records = await newBooks.list(
        factories.caller.build(),
        new PaginatedFilter({ sort: new Sort({ field: 'author:lastName', ascending: false }) }),
        new Projection('id', 'title', 'author:lastName'),
      );

      expect(records).toStrictEqual([
        { id: 2, title: 'Beat the dealer', author: { lastName: 'Thorp' } },
        { id: 3, title: 'Gomorrah', author: { lastName: 'Saviano' } },
        { id: 1, title: 'Foundation', author: { lastName: 'Asimov' } },
      ]);
    });
  });

  describe('when telling that sort(book.title) = sort(book.author.lastName)', () => {
    beforeEach(() => {
      newBooks.replaceFieldSorting(
        'title',
        new Sort({ field: 'author:lastName', ascending: true }),
      );
    });

    test('schema should be updated', () => {
      const schema = newBooks.schema.fields.title as ColumnSchema;
      expect(schema.isSortable).toBeTruthy();
    });

    test('should work in ascending order', async () => {
      const records = await newBooks.list(
        factories.caller.build(),
        new PaginatedFilter({ sort: new Sort({ field: 'title', ascending: true }) }),
        new Projection('id', 'title', 'author:lastName'),
      );

      expect(records).toStrictEqual([
        { id: 1, title: 'Foundation', author: { lastName: 'Asimov' } },
        { id: 3, title: 'Gomorrah', author: { lastName: 'Saviano' } },
        { id: 2, title: 'Beat the dealer', author: { lastName: 'Thorp' } },
      ]);
    });

    test('should work in descending order', async () => {
      const records = await newBooks.list(
        factories.caller.build(),
        new PaginatedFilter({ sort: new Sort({ field: 'title', ascending: false }) }),
        new Projection('id', 'title', 'author:lastName'),
      );

      expect(records).toStrictEqual([
        { id: 2, title: 'Beat the dealer', author: { lastName: 'Thorp' } },
        { id: 3, title: 'Gomorrah', author: { lastName: 'Saviano' } },
        { id: 1, title: 'Foundation', author: { lastName: 'Asimov' } },
      ]);
    });
  });
});
