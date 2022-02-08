import ConditionTreeBranch, { Aggregator } from '../../src/interfaces/query/condition-tree/branch';
import ConditionTreeLeaf, { Operator } from '../../src/interfaces/query/condition-tree/leaf';
import ConditionTreeUtils from '../../src/utils/condition-tree';
import * as factories from '../__factories__';

describe('ConditionTreeUtils', () => {
  describe('intersect', () => {
    test('intersect() an empty list should return an empty And', () => {
      expect(ConditionTreeUtils.intersect()).toEqual({
        aggregator: Aggregator.And,
        conditions: [],
      });
    });

    test('intersect() should return the parameter when called with only one param', () => {
      const tree = ConditionTreeUtils.intersect(
        new ConditionTreeLeaf('column', Operator.Equal, true),
      );

      expect(tree).toEqual({ field: 'column', operator: Operator.Equal, value: true });
    });

    test('intersect() should ignore null params', () => {
      const tree = ConditionTreeUtils.intersect(
        null,
        new ConditionTreeLeaf('column', Operator.Equal, true),
        null,
      );

      expect(tree).toEqual({ field: 'column', operator: Operator.Equal, value: true });
    });

    test('intersect() multiple trees should return the tree', () => {
      const tree = ConditionTreeUtils.intersect(
        new ConditionTreeLeaf('column', Operator.Equal, true),
        new ConditionTreeLeaf('otherColumn', Operator.Equal, true),
      );

      expect(tree).toEqual({
        aggregator: Aggregator.And,
        conditions: [
          { field: 'column', operator: Operator.Equal, value: true },
          { field: 'otherColumn', operator: Operator.Equal, value: true },
        ],
      });
    });

    test('intersect() should merge And trees', () => {
      const tree = ConditionTreeUtils.intersect(
        new ConditionTreeBranch(Aggregator.And, [
          new ConditionTreeLeaf('column', Operator.Equal, true),
        ]),
        new ConditionTreeBranch(Aggregator.And, [
          new ConditionTreeLeaf('otherColumn', Operator.Equal, true),
        ]),
      );

      expect(tree).toEqual({
        aggregator: Aggregator.And,
        conditions: [
          { field: 'column', operator: Operator.Equal, value: true },
          { field: 'otherColumn', operator: Operator.Equal, value: true },
        ],
      });
    });
  });

  describe('matchRecords / matchIds', () => {
    describe('with a simple pk', () => {
      const collection = factories.collection.build({
        schema: factories.collectionSchema.build({
          fields: {
            col1: factories.columnSchema.isPrimaryKey().build(),
          },
        }),
      });

      test('should generate equal', () => {
        const condition = ConditionTreeUtils.matchRecords(collection.schema, [{ col1: 1 }]);

        expect(condition).toEqual({ field: 'col1', operator: Operator.Equal, value: 1 });
      });

      test('should generate in', () => {
        const condition = ConditionTreeUtils.matchRecords(collection.schema, [
          { col1: 1 },
          { col1: 2 },
        ]);

        expect(condition).toEqual({ field: 'col1', operator: Operator.In, value: [1, 2] });
      });
    });

    describe('with a composite pk', () => {
      const collection = factories.collection.build({
        schema: factories.collectionSchema.build({
          fields: {
            col1: factories.columnSchema.isPrimaryKey().build(),
            col2: factories.columnSchema.isPrimaryKey().build(),
            col3: factories.columnSchema.isPrimaryKey().build(),
          },
        }),
      });

      test('should generate a simple and', () => {
        const condition = ConditionTreeUtils.matchRecords(collection.schema, [
          { col1: 1, col2: 1, col3: 1 },
        ]);

        expect(condition).toEqual({
          aggregator: Aggregator.And,
          conditions: [
            { field: 'col1', operator: Operator.Equal, value: 1 },
            { field: 'col2', operator: Operator.Equal, value: 1 },
            { field: 'col3', operator: Operator.Equal, value: 1 },
          ],
        });
      });

      test('should factorize', () => {
        const condition = ConditionTreeUtils.matchRecords(collection.schema, [
          { col1: 1, col2: 1, col3: 1 },
          { col1: 1, col2: 1, col3: 2 },
        ]);

        expect(condition).toEqual({
          aggregator: Aggregator.And,
          conditions: [
            { field: 'col1', operator: Operator.Equal, value: 1 },
            { field: 'col2', operator: Operator.Equal, value: 1 },
            { field: 'col3', operator: Operator.In, value: [1, 2] },
          ],
        });
      });

      test('should not factorize', () => {
        const condition = ConditionTreeUtils.matchRecords(collection.schema, [
          { col1: 1, col2: 1, col3: 1 },
          { col1: 2, col2: 2, col3: 2 },
        ]);

        expect(condition).toEqual({
          aggregator: Aggregator.Or,
          conditions: [
            {
              aggregator: Aggregator.And,
              conditions: [
                { field: 'col1', operator: Operator.Equal, value: 1 },
                { field: 'col2', operator: Operator.Equal, value: 1 },
                { field: 'col3', operator: Operator.Equal, value: 1 },
              ],
            },
            {
              aggregator: Aggregator.And,
              conditions: [
                { field: 'col1', operator: Operator.Equal, value: 2 },
                { field: 'col2', operator: Operator.Equal, value: 2 },
                { field: 'col3', operator: Operator.Equal, value: 2 },
              ],
            },
          ],
        });
      });
    });
  });
});
