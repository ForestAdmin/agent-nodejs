import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import {
  Collection,
  ColumnSchema,
  ConditionTreeLeaf,
  DataSource,
  PaginatedFilter,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';
import DataSourceDecorator from '../../../src/decorators/datasource-decorator';
import OperatorEmulationDecorator from '../../../src/decorators/operators-emulate/collection';

describe('OperatorsEmulate', () => {
  describe('when the collection pk does not supports == or in operators', () => {
    // State
    let dataSource: DataSource;
    let decoratedDataSource: DataSourceDecorator<OperatorEmulationDecorator>;

    // Convenience: Direct access to collections before and after decoration
    let books: Collection;
    let newBooks: OperatorEmulationDecorator;

    // Build datasource
    beforeEach(() => {
      books = factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.isPrimaryKey().build({
              columnType: 'Number',
              filterOperators: new Set(), // note that 'id' does not support filtering
            }),
            title: factories.columnSchema.build(),
          },
        }),
      });

      dataSource = factories.dataSource.buildWithCollections([books]);
    });

    // Build decorator
    beforeEach(() => {
      decoratedDataSource = new DataSourceDecorator(dataSource, OperatorEmulationDecorator);
      newBooks = decoratedDataSource.getCollection('books');
    });

    test('emulateFieldOperator() should throw on any case', () => {
      expect(() => newBooks.emulateFieldOperator('title', 'GreaterThan')).toThrow(
        "the primary key columns must support 'Equal' and 'In' operators",
      );
    });
  });

  describe('when the collection pk supports the == and in operators', () => {
    // State
    let dataSource: DataSource;
    let decoratedDataSource: DataSourceDecorator<OperatorEmulationDecorator>;

    // Convenience: Direct access to collections before and after decoration
    let books: Collection;
    let persons: Collection;
    let newBooks: OperatorEmulationDecorator;
    let newPersons: OperatorEmulationDecorator;

    // Build datasource
    beforeEach(() => {
      books = factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.isPrimaryKey().build({
              columnType: 'Number',
              filterOperators: new Set(['Equal', 'In']),
            }),
            authorId: factories.columnSchema.build(),
            author: factories.manyToOneSchema.build({
              foreignCollection: 'persons',
              foreignKey: 'authorId',
            }),
            title: factories.columnSchema.build({ filterOperators: undefined }),
          },
        }),
      });

      persons = factories.collection.build({
        name: 'persons',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.isPrimaryKey().build({
              columnType: 'Number',
              filterOperators: new Set(['Equal', 'In']),
            }),
            firstName: factories.columnSchema.build({ filterOperators: new Set(['Equal']) }),
            lastName: factories.columnSchema.build(),
          },
        }),
      });

      dataSource = factories.dataSource.buildWithCollections([persons, books]);
    });

    // Build decorator
    beforeEach(() => {
      decoratedDataSource = new DataSourceDecorator(dataSource, OperatorEmulationDecorator);

      newBooks = decoratedDataSource.getCollection('books');
      newPersons = decoratedDataSource.getCollection('persons');
    });

    test('emulateFieldOperator() should throw if the field does not exists', () => {
      expect(() => newBooks.emulateFieldOperator('__dontExist', 'Equal')).toThrow(
        "Column not found: 'books.__dontExist'",
      );
    });

    test('emulateFieldOperator() should throw if the field is a relation', () => {
      expect(() => newBooks.emulateFieldOperator('author', 'Equal')).toThrow(
        "Unexpected field type: 'books.author' (found 'ManyToOne' expected 'Column')",
      );
    });

    test('emulateFieldOperator() should throw if the field is in a relation', () => {
      expect(() => newBooks.emulateFieldOperator('author:firstName', 'Equal')).toThrow(
        'Cannot replace operator for relation',
      );
    });

    describe('when implementing an operator from an unsupported one', () => {
      beforeEach(() => {
        newBooks.replaceFieldOperator('title', 'StartsWith', () => ({
          field: 'title',
          operator: 'Like',
          value: 'aTitleValue',
        }));
      });

      test('list() should crash', async () => {
        const projection = new Projection('id', 'title');
        const filter = factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build({
            field: 'title',
            operator: 'StartsWith',
            value: 'Found',
          }),
        });

        await expect(newBooks.list(factories.caller.build(), filter, projection)).rejects.toThrow(
          "The given operator 'Like' is not supported",
        );
        expect(books.list).not.toHaveBeenCalled();
      });
    });

    describe('when creating a cycle in the replacements graph', () => {
      beforeEach(() => {
        newBooks.replaceFieldOperator('title', 'StartsWith', async value => ({
          field: 'title',
          operator: 'Like',
          value: `${value}%`,
        }));

        newBooks.replaceFieldOperator('title', 'Like', async value => ({
          field: 'title',
          operator: 'StartsWith',
          value: `${value}%`,
        }));
      });

      test('list() should crash', async () => {
        const projection = new Projection('id', 'title');
        const filter = factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build({
            field: 'title',
            operator: 'StartsWith',
            value: 'Found',
          }),
        });

        await expect(newBooks.list(factories.caller.build(), filter, projection)).rejects.toThrow(
          'Operator replacement cycle: ' +
            'books.title[StartsWith] -> books.title[Like] -> books.title[StartsWith]',
        );
        expect(books.list).not.toHaveBeenCalled();
      });
    });

    describe('when emulating an operator', () => {
      beforeEach(() => {
        newPersons.emulateFieldOperator('firstName', 'StartsWith');
      });

      test('schema() should support StartWith operator', () => {
        expect(newPersons.schema.fields.firstName).toHaveProperty(
          'filterOperators',
          new Set(['Equal', 'StartsWith']),
        );
      });

      test('list() should not rewrite the condition tree with another operator', async () => {
        (books.list as jest.Mock).mockResolvedValueOnce([{ id: 2, title: 'Foundation' }]);

        const projection = new Projection('id', 'title');
        const caller = factories.caller.build();
        const filter = factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build({
            field: 'author:firstName',
            operator: 'Equal',
            value: 'Isaac',
          }),
        });

        const records = await newBooks.list(caller, filter, projection);
        expect(records).toStrictEqual([{ id: 2, title: 'Foundation' }]);

        expect(persons.list).toHaveBeenCalledTimes(0);
        expect(books.list).toHaveBeenCalledTimes(1);
        expect(books.list).toHaveBeenCalledWith(caller, filter, projection);
      });

      test('list() should find books from author:firstname prefix', async () => {
        (books.list as jest.Mock).mockResolvedValueOnce([{ id: 2, title: 'Foundation' }]);
        (persons.list as jest.Mock).mockResolvedValueOnce([
          { id: 1, firstName: 'Edward' },
          { id: 2, firstName: 'Isaac' },
        ]);

        const caller = factories.caller.build();
        const projection = new Projection('id', 'title');
        const filter = factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build({
            field: 'author:firstName',
            operator: 'StartsWith',
            value: 'Isaa',
          }),
        });

        const records = await newBooks.list(caller, filter, projection);
        expect(records).toStrictEqual([{ id: 2, title: 'Foundation' }]);

        expect(persons.list).toHaveBeenCalledTimes(1);
        expect(persons.list).toHaveBeenCalledWith(caller, {}, ['firstName', 'id']);

        expect(books.list).toHaveBeenCalledTimes(1);
        expect(books.list).toHaveBeenCalledWith(
          caller,
          { conditionTree: { field: 'author:id', operator: 'Equal', value: 2 } },
          projection,
        );
      });
    });

    describe('when() implementing an operator in the least efficient way ever', () => {
      beforeEach(() => {
        // Emulate title 'ShorterThan' and 'Contains'
        newBooks.emulateFieldOperator('title', 'ShorterThan');
        newBooks.emulateFieldOperator('title', 'Contains');

        // Define 'Equal(x)' to be 'Contains(x) && ShorterThan(x.length + 1)'
        newBooks.replaceFieldOperator('title', 'Equal', async value => ({
          aggregator: 'And',
          conditions: [
            { field: 'title', operator: 'Contains', value },
            { field: 'title', operator: 'ShorterThan', value: (value as string).length + 1 },
          ],
        }));
      });

      test('list() should find books where title = Foundation', async () => {
        // Mock book list() implementation.
        (books.list as jest.Mock).mockImplementation(
          (_, filter: PaginatedFilter, projection: Projection) => {
            // Ensure no forbideen operator is used
            const usingForbiddenOperator = filter?.conditionTree?.someLeaf(
              ({ field, operator }) =>
                field !== 'id' &&
                !(books.schema.fields.id as ColumnSchema).filterOperators.has(operator),
            );

            expect(usingForbiddenOperator).toBeFalsy();

            // Perform request
            let childRecords: RecordData[] = [
              { id: 1, title: 'Beat the dealer' },
              { id: 2, title: 'Foundation' },
              { id: 3, title: 'Papillon' },
            ];

            if (filter?.conditionTree) {
              childRecords = filter.conditionTree.apply(childRecords, books, 'Europe/Paris');
            }

            return projection.apply(childRecords);
          },
        );

        const filter = new PaginatedFilter({
          conditionTree: new ConditionTreeLeaf('title', 'Equal', 'Foundation'),
        });

        const records = await newBooks.list(
          factories.caller.build(),
          filter,
          new Projection('id', 'title'),
        );
        expect(records).toStrictEqual([{ id: 2, title: 'Foundation' }]);

        // Not checking the calls to the underlying collection, as current implementation is quite
        // naive and could be greatly improved if there is a need.
      });
    });
  });
});
