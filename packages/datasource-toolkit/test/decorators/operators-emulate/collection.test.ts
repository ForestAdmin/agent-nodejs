import DataSourceDecorator from '../../../src/decorators/datasource-decorator';
import OperatorEmulationDecorator from '../../../src/decorators/operators-emulate/collection';
import { Collection, DataSource } from '../../../src/interfaces/collection';
import ConditionTreeFactory from '../../../src/interfaces/query/condition-tree/factory';
import ConditionTreeLeaf, {
  Operator,
} from '../../../src/interfaces/query/condition-tree/nodes/leaf';
import PaginatedFilter from '../../../src/interfaces/query/filter/paginated';
import Projection from '../../../src/interfaces/query/projection';
import { RecordData } from '../../../src/interfaces/record';
import { ColumnSchema, PrimitiveTypes } from '../../../src/interfaces/schema';
import * as factories from '../../__factories__';

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
              columnType: PrimitiveTypes.Number,
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

    test('emulateOperator() should throw on any case', () => {
      expect(() => newBooks.emulateOperator('title', Operator.GreaterThan)).toThrow(
        "the primary key columns must support 'equal' and 'in' operators",
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
              columnType: PrimitiveTypes.Number,
              filterOperators: new Set([Operator.Equal, Operator.In]),
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
              columnType: PrimitiveTypes.Number,
              filterOperators: new Set([Operator.Equal, Operator.In]),
            }),
            firstName: factories.columnSchema.build({ filterOperators: new Set([Operator.Equal]) }),
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

    test('emulateOperator() should throw if the field does not exists', () => {
      expect(() => newBooks.emulateOperator('__dontExist', Operator.Equal)).toThrow(
        "Column not found: 'books.__dontExist'",
      );
    });

    test('emulateOperator() should throw if the field is a relation', () => {
      expect(() => newBooks.emulateOperator('author', Operator.Equal)).toThrow(
        "Unexpected field type: 'books.author' (found 'ManyToOne' expected 'Column')",
      );
    });

    test('emulateOperator() should throw if the field is in a relation', () => {
      expect(() => newBooks.emulateOperator('author:firstName', Operator.Equal)).toThrow(
        'Cannot replace operator for relation',
      );
    });

    describe('when implementing an operator from an unsupported one', () => {
      beforeEach(() => {
        newBooks.implementOperator(
          'title',
          Operator.StartsWith,
          async value => new ConditionTreeLeaf('title', Operator.Like, `${value}%`),
        );
      });

      test('list() should crash', async () => {
        const projection = new Projection('id', 'title');
        const filter = factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build({
            field: 'title',
            operator: Operator.StartsWith,
            value: 'Found',
          }),
        });

        await expect(newBooks.list(filter, projection)).rejects.toThrow(
          "The given operator 'like' is not supported",
        );
        expect(books.list).not.toHaveBeenCalled();
      });
    });

    describe('when creating a cycle in the replacements graph', () => {
      beforeEach(() => {
        newBooks.implementOperator(
          'title',
          Operator.StartsWith,
          async value => new ConditionTreeLeaf('title', Operator.Like, `${value}%`),
        );

        newBooks.implementOperator(
          'title',
          Operator.Like,
          async value => new ConditionTreeLeaf('title', Operator.StartsWith, `${value}%`),
        );
      });

      test('list() should crash', async () => {
        const projection = new Projection('id', 'title');
        const filter = factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build({
            field: 'title',
            operator: Operator.StartsWith,
            value: 'Found',
          }),
        });

        await expect(newBooks.list(filter, projection)).rejects.toThrow(
          'Operator replacement cycle: ' +
            'books.title[starts_with] -> books.title[like] -> books.title[starts_with]',
        );
        expect(books.list).not.toHaveBeenCalled();
      });
    });

    describe('when emulating an operator', () => {
      beforeEach(() => {
        newPersons.emulateOperator('firstName', Operator.StartsWith);
      });

      test('schema() should support StartWith operator', () => {
        expect(newPersons.schema.fields.firstName).toHaveProperty(
          'filterOperators',
          new Set([Operator.Equal, Operator.StartsWith]),
        );
      });

      test('list() should not rewrite the condition tree with another operator', async () => {
        (books.list as jest.Mock).mockResolvedValueOnce([{ id: 2, title: 'Foundation' }]);

        const projection = new Projection('id', 'title');
        const filter = factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build({
            field: 'author:firstName',
            operator: Operator.Equal,
            value: 'Isaac',
          }),
        });

        const records = await newBooks.list(filter, projection);
        expect(records).toStrictEqual([{ id: 2, title: 'Foundation' }]);

        expect(persons.list).toHaveBeenCalledTimes(0);
        expect(books.list).toHaveBeenCalledTimes(1);
        expect(books.list).toHaveBeenCalledWith(filter, projection);
      });

      test('list() should find books from author:firstname prefix', async () => {
        (books.list as jest.Mock).mockResolvedValueOnce([{ id: 2, title: 'Foundation' }]);
        (persons.list as jest.Mock).mockResolvedValueOnce([
          { id: 1, firstName: 'Edward' },
          { id: 2, firstName: 'Isaac' },
        ]);

        const projection = new Projection('id', 'title');
        const filter = factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build({
            field: 'author:firstName',
            operator: Operator.StartsWith,
            value: 'Isaa',
          }),
        });

        const records = await newBooks.list(filter, projection);
        expect(records).toStrictEqual([{ id: 2, title: 'Foundation' }]);

        expect(persons.list).toHaveBeenCalledTimes(1);
        expect(persons.list).toHaveBeenCalledWith(undefined, ['firstName', 'id']);

        expect(books.list).toHaveBeenCalledTimes(1);
        expect(books.list).toHaveBeenCalledWith(
          { conditionTree: { field: 'author:id', operator: Operator.Equal, value: 2 } },
          projection,
        );
      });
    });

    describe('when() implementing an operator in the least efficient way ever', () => {
      beforeEach(() => {
        // Emulate title 'ShorterThan' and 'Contains'
        newBooks.emulateOperator('title', Operator.ShorterThan);
        newBooks.emulateOperator('title', Operator.Contains);

        // Define 'Equal(x)' to be 'Contains(x) && ShorterThan(x.length + 1)'
        newBooks.implementOperator('title', Operator.Equal, async value =>
          ConditionTreeFactory.intersect(
            new ConditionTreeLeaf('title', Operator.Contains, value),
            new ConditionTreeLeaf('title', Operator.ShorterThan, (value as string).length + 1),
          ),
        );
      });

      test('list() should find books where title = Foundation', async () => {
        // Mock book list() implementation.
        (books.list as jest.Mock).mockImplementation(
          (filter: PaginatedFilter, projection: Projection) => {
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
          conditionTree: new ConditionTreeLeaf('title', Operator.Equal, 'Foundation'),
        });

        const records = await newBooks.list(filter, new Projection('id', 'title'));
        expect(records).toStrictEqual([{ id: 2, title: 'Foundation' }]);

        // Not checking the calls to the underlying collection, as current implementation is quite
        // naive and could be greatly improved if there is a need.
      });
    });
  });
});
