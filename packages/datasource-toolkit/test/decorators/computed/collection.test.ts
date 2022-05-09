import * as factories from '../../__factories__';
import { Collection, DataSource } from '../../../src/interfaces/collection';
import Aggregation from '../../../src/interfaces/query/aggregation';
import ComputedCollection from '../../../src/decorators/computed/collection';
import DataSourceDecorator from '../../../src/decorators/datasource-decorator';
import PaginatedFilter from '../../../src/interfaces/query/filter/paginated';
import Projection from '../../../src/interfaces/query/projection';

describe('ComputedDecorator', () => {
  // State
  let dataSource: DataSource;
  let decoratedDataSource: DataSourceDecorator<ComputedCollection>;

  // Convenience: Direct access to collections before and after decoration
  let persons: Collection;
  let books: Collection;

  let newPersons: ComputedCollection;
  let newBooks: ComputedCollection;

  // Build datasource
  beforeEach(() => {
    const records = [
      {
        id: 1,
        authorId: 1,
        author: { id: 1, firstName: 'Isaac', lastName: 'Asimov' },
        title: 'Foundation',
      },
      {
        id: 2,
        authorId: 2,
        author: { id: 2, firstName: 'Edward O.', lastName: 'Thorp' },
        title: 'Beat the dealer',
      },
    ];

    books = factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.build({ isPrimaryKey: true }),
          authorId: factories.columnSchema.build(),
          author: factories.manyToOneSchema.build({
            foreignCollection: 'persons',
            foreignKey: 'authorId',
          }),
          title: factories.columnSchema.build(),
        },
      }),
      list: jest
        .fn()
        .mockImplementation((_1, _2, projection: Projection) => projection.apply(records)),
      aggregate: jest
        .fn()
        .mockImplementation((_1, _2, aggregate: Aggregation) =>
          aggregate.apply(records, 'Europe/Paris'),
        ),
    });

    persons = factories.collection.build({
      name: 'persons',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.build({ isPrimaryKey: true }),
          firstName: factories.columnSchema.build(),
          lastName: factories.columnSchema.build(),
        },
      }),
    });

    dataSource = factories.dataSource.buildWithCollections([persons, books]);
  });

  // Build decorator
  beforeEach(() => {
    decoratedDataSource = new DataSourceDecorator(dataSource, ComputedCollection);

    newBooks = decoratedDataSource.getCollection('books');
    newPersons = decoratedDataSource.getCollection('persons');
  });

  test('should throw if defining a field with no dependencies', () => {
    expect(() => {
      newBooks.registerComputed('newField', {
        columnType: 'String',
        dependencies: [],
        getValues: () => Promise.reject(),
      });
    }).toThrow(`Computed field 'books.newField' must have at least one dependency`);
  });

  test('should throw if defining a field with missing dependencies', () => {
    expect(() => {
      newBooks.registerComputed('newField', {
        columnType: 'String',
        dependencies: ['__nonExisting__'],
        getValues: () => Promise.reject(),
      });
    }).toThrow("Column not found: 'books.__nonExisting__'");
  });

  test('should throw if defining a field with invalid dependencies', () => {
    expect(() => {
      newBooks.registerComputed('newField', {
        columnType: 'String',
        dependencies: ['author'],
        getValues: () => Promise.reject(),
      });
    }).toThrow("Unexpected field type: 'books.author' (found 'ManyToOne' expected 'Column')");
  });

  describe('With a computed', () => {
    beforeEach(() => {
      newPersons.registerComputed('fullName', {
        columnType: 'String',
        dependencies: ['firstName', 'lastName'],
        getValues: records => {
          return new Promise(resolve => {
            const result = records.map(record => `${record.firstName} ${record.lastName}`);
            setTimeout(() => resolve(result));
          });
        },
      });
    });

    test('the schemas should contain the field', () => {
      expect(newPersons.schema.fields.fullName).toEqual({
        columnType: 'String',
        filterOperators: new Set(),
        isReadOnly: true,
        isSortable: false,
        isPrimaryKey: false,
        type: 'Column',
      });
    });

    test('list() result should contain the computed', async () => {
      const caller = factories.caller.build();
      const records = await newBooks.list(
        caller,
        new PaginatedFilter({}),
        new Projection('title', 'author:fullName'),
      );

      expect(records).toStrictEqual([
        { title: 'Foundation', author: { fullName: 'Isaac Asimov' } },
        { title: 'Beat the dealer', author: { fullName: 'Edward O. Thorp' } },
      ]);

      expect(books.list).toHaveBeenCalledWith(caller, {}, [
        'title',
        'author:firstName',
        'author:lastName',
      ]);
    });

    test('aggregate() should use the child implementation when relevant', async () => {
      const rows = await newBooks.aggregate(
        factories.caller.build(),
        new PaginatedFilter({}),
        new Aggregation({ operation: 'Count' }),
      );

      expect(rows).toEqual([{ value: 2, group: {} }]);
      expect(books.aggregate).toHaveBeenCalledTimes(1);
    });

    test('aggregate() should work with computed', async () => {
      const rows = await newBooks.aggregate(
        factories.caller.build(),
        new PaginatedFilter({}),
        new Aggregation({ operation: 'Min', field: 'author:fullName' }),
      );

      expect(rows).toEqual([{ value: 'Edward O. Thorp', group: {} }]);
      expect(books.aggregate).toHaveBeenCalledTimes(0);
    });
  });
});
