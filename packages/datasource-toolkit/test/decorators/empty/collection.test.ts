import * as factories from '../../__factories__';
import { Collection, DataSource } from '../../../src/interfaces/collection';
import DataSourceDecorator from '../../../src/decorators/datasource-decorator';
import EmptyCollectionDecorator from '../../../src/decorators/empty/collection';

describe('EmptyCollectionDecorator', () => {
  let dataSource: DataSource;
  let decoratedDataSource: DataSourceDecorator<EmptyCollectionDecorator>;
  let books: Collection;
  let newBooks: EmptyCollectionDecorator;

  beforeEach(() => {
    books = factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.isPrimaryKey().build({}),
          title: factories.columnSchema.build({}),
        },
      }),
    });

    dataSource = factories.dataSource.buildWithCollections([books]);
    decoratedDataSource = new DataSourceDecorator(dataSource, EmptyCollectionDecorator);
    newBooks = decoratedDataSource.getCollection('books');
  });

  test('schema should not be changed', () => {
    expect(newBooks.schema).toStrictEqual(books.schema);
  });

  describe('valid queries', () => {
    test('list() should be called with overlapping Ins', async () => {
      (books.list as jest.Mock).mockResolvedValue([{ id: 2 }]);

      const records = await newBooks.list(
        factories.caller.build(),
        factories.filter.build({
          conditionTree: factories.conditionTreeBranch.build({
            aggregator: 'And',
            conditions: [
              factories.conditionTreeLeaf.build({
                field: 'id',
                operator: 'In',
                value: [1, 2],
              }),
              factories.conditionTreeLeaf.build({
                field: 'id',
                operator: 'In',
                value: [2, 3],
              }),
            ],
          }),
        }),
        factories.projection.build(),
      );

      expect(records).toStrictEqual([{ id: 2 }]);
      expect(books.list).toHaveBeenCalled();
    });

    test('update() should be called with overlapping Ored incompatible equals', async () => {
      await newBooks.update(
        factories.caller.build(),
        factories.filter.build({
          conditionTree: factories.conditionTreeBranch.build({
            aggregator: 'Or',
            conditions: [
              factories.conditionTreeLeaf.build({
                field: 'id',
                operator: 'Equal',
                value: 4,
              }),
              factories.conditionTreeLeaf.build({
                field: 'id',
                operator: 'Equal',
                value: 5,
              }),
            ],
          }),
        }),
        { title: 'new Title' },
      );

      expect(books.update).toHaveBeenCalled();
    });

    test('delete() should be called with null condition Tree', async () => {
      await newBooks.delete(
        factories.caller.build(),
        factories.filter.build({ conditionTree: null }),
      );

      expect(books.delete).toHaveBeenCalled();
    });

    test('aggregate() should be called with simple query', async () => {
      (books.aggregate as jest.Mock).mockResolvedValue([{ value: 2, group: {} }]);
      const records = await newBooks.aggregate(
        factories.caller.build(),
        factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build({
            field: 'id',
            operator: 'Equal',
            value: null,
          }),
        }),
        factories.aggregation.build(),
      );

      expect(records).toStrictEqual([{ value: 2, group: {} }]);
      expect(books.aggregate).toHaveBeenCalled();
    });
  });

  describe('Queries which target an impossible filter', () => {
    test('list() should not be called with empty In', async () => {
      const records = await newBooks.list(
        factories.caller.build(),
        factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build({
            field: 'id',
            operator: 'In',
            value: [],
          }),
        }),
        factories.projection.build(),
      );

      expect(records).toStrictEqual([]);
      expect(books.list).not.toHaveBeenCalled();
    });

    test('list() should not be called with nested empty In', async () => {
      const records = await newBooks.list(
        factories.caller.build(),
        factories.filter.build({
          conditionTree: factories.conditionTreeBranch.build({
            aggregator: 'And',
            conditions: [
              factories.conditionTreeBranch.build({
                aggregator: 'And',
                conditions: [
                  factories.conditionTreeBranch.build({
                    aggregator: 'Or',
                    conditions: [
                      factories.conditionTreeLeaf.build({
                        field: 'id',
                        operator: 'In',
                        value: [],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        }),
        factories.projection.build(),
      );

      expect(records).toStrictEqual([]);
      expect(books.list).not.toHaveBeenCalled();
    });

    test('delete() should not be called with incompatible Equals', async () => {
      await newBooks.delete(
        factories.caller.build(),
        factories.filter.build({
          conditionTree: factories.conditionTreeBranch.build({
            aggregator: 'And',
            conditions: [
              factories.conditionTreeLeaf.build({ field: 'id', operator: 'Equal', value: 12 }),
              factories.conditionTreeLeaf.build({ field: 'id', operator: 'Equal', value: 13 }),
            ],
          }),
        }),
      );

      expect(books.delete).not.toHaveBeenCalled();
    });

    test('update() should not be called with incompatible Equal/In', async () => {
      await newBooks.update(
        factories.caller.build(),
        factories.filter.build({
          conditionTree: factories.conditionTreeBranch.build({
            aggregator: 'And',
            conditions: [
              factories.conditionTreeLeaf.build({ field: 'id', operator: 'Equal', value: 12 }),
              factories.conditionTreeLeaf.build({ field: 'id', operator: 'In', value: [13] }),
            ],
          }),
        }),
        { title: 'something else' },
      );

      expect(books.update).not.toHaveBeenCalled();
    });

    test('aggregate() should not be called with incompatible Ins', async () => {
      const records = await newBooks.aggregate(
        factories.caller.build(),
        factories.filter.build({
          conditionTree: factories.conditionTreeBranch.build({
            aggregator: 'And',
            conditions: [
              factories.conditionTreeLeaf.build({ field: 'id', operator: 'In', value: [34, 32] }),
              factories.conditionTreeLeaf.build({ field: 'id', operator: 'In', value: [13] }),
            ],
          }),
        }),
        factories.aggregation.build(),
      );

      expect(records).toStrictEqual([]);
      expect(books.aggregate).not.toHaveBeenCalled();
    });
  });
});
