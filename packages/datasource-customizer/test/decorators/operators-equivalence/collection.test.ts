import {
  Collection,
  ColumnSchema,
  ConditionTreeLeaf,
  PaginatedFilter,
  Projection,
} from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import OperatorsDecorator from '../../../src/decorators/operators-equivalence/collection';

describe('OperatorsEquivalenceCollectionDecorator', () => {
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
              columnType: 'Date',
              filterOperators: new Set(['LessThan', 'Equal', 'GreaterThan']),
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

    test('list() should work with a null condition tree', async () => {
      const caller = factories.caller.build();

      await decorator.list(caller, new PaginatedFilter({}), new Projection('col'));
      expect(collectionList).toHaveBeenCalledWith(caller, {}, ['col']);
    });

    test('list() should not modify supported operators', async () => {
      const tree = new ConditionTreeLeaf('col', 'Equal', 'someDate');
      const caller = factories.caller.build();

      await decorator.list(
        caller,
        new PaginatedFilter({ conditionTree: tree }),
        new Projection('col'),
      );
      expect(collectionList).toHaveBeenCalledWith(
        caller,
        { conditionTree: { field: 'col', operator: 'Equal', value: 'someDate' } },
        ['col'],
      );
    });

    test('list() should transform "In -> Equal"', async () => {
      const tree = new ConditionTreeLeaf('col', 'In', ['someDate']);
      const caller = factories.caller.build();

      await decorator.list(
        caller,
        new PaginatedFilter({ conditionTree: tree }),
        new Projection('col'),
      );
      expect(collectionList).toHaveBeenCalledWith(
        caller,
        { conditionTree: { field: 'col', operator: 'Equal', value: 'someDate' } },
        ['col'],
      );
    });

    test('list() should transform "Blank -> In -> Equal"', async () => {
      const tree = new ConditionTreeLeaf('col', 'Blank');
      const caller = factories.caller.build();

      await decorator.list(
        caller,
        new PaginatedFilter({ conditionTree: tree }),
        new Projection('col'),
      );
      expect(collectionList).toHaveBeenCalledWith(
        caller,
        { conditionTree: { field: 'col', operator: 'Equal', value: null } },
        ['col'],
      );
    });
  });
});
