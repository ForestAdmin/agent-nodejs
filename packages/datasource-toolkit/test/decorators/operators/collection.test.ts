import OperatorsDecorator from '../../../dist/decorators/operators/collection';
import { Collection } from '../../../dist/interfaces/collection';
import ConditionTreeLeaf, { Operator } from '../../../dist/interfaces/query/condition-tree/leaf';
import PaginatedFilter from '../../../dist/interfaces/query/filter/paginated';
import Projection from '../../../dist/interfaces/query/projection';
import { ColumnSchema, PrimitiveTypes } from '../../../dist/interfaces/schema';
import * as factories from '../../__factories__';

describe('ConditionTreeOperators', () => {
  describe('with a date field which support only "<", "==" and ">"', () => {
    let collectionList: jest.Mock;
    let collection: Collection;
    let decorator: OperatorsDecorator;

    beforeEach(() => {
      collectionList = jest.fn();
      collection = factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            col: factories.columnSchema.build({
              columnType: PrimitiveTypes.Date,
              filterOperators: new Set<Operator>([
                Operator.LessThan,
                Operator.Equal,
                Operator.GreaterThan,
              ]),
            }),
            rel: factories.manyToOneSchema.build({
              foreignCollection: 'author',
              foreignKey: 'col',
            }),
          },
        }),
        list: collectionList,
      });

      decorator = new OperatorsDecorator(collection, null);
    });

    test('schema should support more operators', () => {
      const schema = decorator.schema.fields.col as ColumnSchema;

      // We don't want this test to break when we support new operators by being too restrictive
      expect(schema.filterOperators.size).toBeGreaterThan(20);
    });

    test('schema should not have dropped relations', () => {
      const { schema } = decorator;

      expect(schema.fields).toHaveProperty('col');
      expect(schema.fields).toHaveProperty('rel');
    });

    test('list() should not modify supported operators', async () => {
      const tree = new ConditionTreeLeaf({
        field: 'col',
        operator: Operator.Equal,
        value: 'someDate',
      });

      await decorator.list(new PaginatedFilter({ conditionTree: tree }), new Projection('col'));
      expect(collectionList).toHaveBeenCalledWith(
        { conditionTree: { field: 'col', operator: Operator.Equal, value: 'someDate' } },
        ['col'],
      );
    });

    test('list() should transform "In -> Equal"', async () => {
      const tree = new ConditionTreeLeaf({
        field: 'col',
        operator: Operator.In,
        value: ['someDate'],
      });

      await decorator.list(new PaginatedFilter({ conditionTree: tree }), new Projection('col'));
      expect(collectionList).toHaveBeenCalledWith(
        { conditionTree: { field: 'col', operator: Operator.Equal, value: 'someDate' } },
        ['col'],
      );
    });

    test('list() should transform "Blank -> In -> Equal"', async () => {
      const tree = new ConditionTreeLeaf({ field: 'col', operator: Operator.Blank });

      await decorator.list(new PaginatedFilter({ conditionTree: tree }), new Projection('col'));
      expect(collectionList).toHaveBeenCalledWith(
        { conditionTree: { field: 'col', operator: Operator.Equal, value: null } },
        ['col'],
      );
    });
  });
});
