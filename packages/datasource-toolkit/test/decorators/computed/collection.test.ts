import ComputedCollection from '../../../dist/decorators/computed/collection';
import DataSourceDecorator from '../../../dist/decorators/datasource-decorator';
import { Collection, DataSource } from '../../../dist/interfaces/collection';
import Aggregation, { AggregationOperation } from '../../../dist/interfaces/query/aggregation';
import PaginatedFilter from '../../../dist/interfaces/query/filter/paginated';
import Projection from '../../../dist/interfaces/query/projection';
import { FieldTypes, PrimitiveTypes } from '../../../dist/interfaces/schema';
import * as factories from '../../__factories__';

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
      list: jest.fn().mockImplementation((_, projection: Projection) => projection.apply(records)),
      getById: jest
        .fn()
        .mockImplementation((_, projection: Projection) => projection.apply(records)[0]),
      aggregate: jest
        .fn()
        .mockImplementation((_, aggregate: Aggregation) =>
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

  test('should throw if defining a field with missing dependencies', () => {
    expect(() => {
      newBooks.registerComputed('newField', {
        columnType: PrimitiveTypes.String,
        dependencies: new Projection('__nonExisting__'),
        getValues: () => Promise.reject(),
      });
    }).toThrow("Column not found: 'books.__nonExisting__'");
  });

  test('should throw if defining a field with invalid dependencies', () => {
    expect(() => {
      newBooks.registerComputed('newField', {
        columnType: PrimitiveTypes.String,
        dependencies: new Projection('author'),
        getValues: () => Promise.reject(),
      });
    }).toThrow("Unexpected field type: 'books.author' (found 'ManyToOne' expected 'Column')");
  });

  test('should throw if defining a proxy with invalid dependency', () => {
    expect(() => {
      newBooks.registerProxy('newField', { path: 'author' });
    }).toThrow("Unexpected field type: 'books.author' (found 'ManyToOne' expected 'Column')");
  });

  describe('With a computed and a proxy which depend on it', () => {
    beforeEach(() => {
      newPersons.registerComputed('fullName', {
        columnType: PrimitiveTypes.String,
        dependencies: new Projection('firstName', 'lastName'),
        getValues: records => {
          return new Promise(resolve => {
            const result = records.map(record => `${record.firstName} ${record.lastName}`);
            setTimeout(() => resolve(result));
          });
        },
      });

      newBooks.registerProxy('authorFullName', { path: 'author:fullName' });
    });

    test('the schemas should contain the field', () => {
      expect(newBooks.schema.fields.authorFullName).toEqual({
        columnType: PrimitiveTypes.String,
        filterOperators: new Set(),
        isReadOnly: true,
        isSortable: false,
        isPrimaryKey: false,
        type: FieldTypes.Column,
      });
    });

    test('getById() result should contain the proxy', async () => {
      const record = await newBooks.getById([1], new Projection('title', 'authorFullName'));

      expect(record).toStrictEqual({ title: 'Foundation', authorFullName: 'Isaac Asimov' });
      expect(books.getById).toHaveBeenCalledWith(
        [1],
        ['title', 'author:firstName', 'author:lastName'],
      );
    });

    test('list() result should contain the proxy', async () => {
      const records = await newBooks.list(null, new Projection('title', 'authorFullName'));

      // Result should be ok
      expect(records).toStrictEqual([
        { title: 'Foundation', authorFullName: 'Isaac Asimov' },
        { title: 'Beat the dealer', authorFullName: 'Edward O. Thorp' },
      ]);

      // the parameters of the child list should not contain anything extra
      expect(books.list).toHaveBeenCalledWith(null, [
        'title',
        'author:firstName',
        'author:lastName',
      ]);
    });

    test('list() result should contain the computed', async () => {
      const records = await newBooks.list(null, new Projection('title', 'author:fullName'));

      expect(records).toStrictEqual([
        { title: 'Foundation', author: { fullName: 'Isaac Asimov' } },
        { title: 'Beat the dealer', author: { fullName: 'Edward O. Thorp' } },
      ]);

      expect(books.list).toHaveBeenCalledWith(null, [
        'title',
        'author:firstName',
        'author:lastName',
      ]);
    });

    test('aggregate() should use the child implementation when relevant', async () => {
      const rows = await newBooks.aggregate(
        new PaginatedFilter({ timezone: 'Europe/Paris' }),
        new Aggregation({ operation: AggregationOperation.Count }),
      );

      expect(rows).toEqual([{ value: 2, group: {} }]);
      expect(books.aggregate).toHaveBeenCalledTimes(1);
    });

    test('aggregate() should work with computed', async () => {
      const rows = await newBooks.aggregate(
        new PaginatedFilter({ timezone: 'Europe/Paris' }),
        new Aggregation({ operation: AggregationOperation.Min, field: 'author:fullName' }),
      );

      expect(rows).toEqual([{ value: 'Edward O. Thorp', group: {} }]);
      expect(books.aggregate).toHaveBeenCalledTimes(0);
    });
  });
});
