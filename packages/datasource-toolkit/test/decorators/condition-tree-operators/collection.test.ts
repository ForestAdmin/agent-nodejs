import OperatorsDecorator from '../../../src/decorators/condition-tree-operators/collection';
import { Collection } from '../../../src/interfaces/collection';
import { Operator } from '../../../src/interfaces/query/selection';
import { ColumnSchema, PrimitiveTypes } from '../../../src/interfaces/schema';
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

    test('list() should not modify supported operators', () => {
      const tree = { field: 'col', operator: Operator.Equal, value: 'someDate' };

      decorator.list({ conditionTree: tree }, ['col']);
      expect(collectionList).toHaveBeenCalledWith(
        { conditionTree: { field: 'col', operator: Operator.Equal, value: 'someDate' } },
        ['col'],
      );
    });

    test('list() should transform "In -> Equal"', () => {
      const tree = { field: 'col', operator: Operator.In, value: ['someDate'] };

      decorator.list({ conditionTree: tree }, ['col']);
      expect(collectionList).toHaveBeenCalledWith(
        { conditionTree: { field: 'col', operator: Operator.Equal, value: 'someDate' } },
        ['col'],
      );
    });

    test('list() should transform "Blank -> In -> Equal"', () => {
      const tree = { field: 'col', operator: Operator.Blank };

      decorator.list({ conditionTree: tree }, ['col']);
      expect(collectionList).toHaveBeenCalledWith(
        { conditionTree: { field: 'col', operator: Operator.Equal, value: null } },
        ['col'],
      );
    });
  });
});
