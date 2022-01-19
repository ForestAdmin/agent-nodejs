import { Aggregator, ConditionTreeLeaf, Operator } from '../../src/interfaces/query/selection';
import ConditionTreeUtils from '../../src/utils/condition-tree';

describe('ConditionTreeUtils', () => {
  describe('intersect', () => {
    test('intersect() an empty list should return an empty And', () => {
      expect(ConditionTreeUtils.intersect()).toStrictEqual({
        aggregator: Aggregator.And,
        conditions: [],
      });
    });

    test('intersect() should return the parameter when called with only one param', () => {
      expect(
        ConditionTreeUtils.intersect({ field: 'column', operator: Operator.Equal, value: true }),
      ).toStrictEqual({ field: 'column', operator: Operator.Equal, value: true });
    });

    test('intersect() should ignore null params', () => {
      expect(
        ConditionTreeUtils.intersect(
          null,
          { field: 'column', operator: Operator.Equal, value: true },
          null,
        ),
      ).toStrictEqual({ field: 'column', operator: Operator.Equal, value: true });
    });

    test('intersect() multiple trees should return the tree', () => {
      expect(
        ConditionTreeUtils.intersect(
          { field: 'column', operator: Operator.Equal, value: true },
          { field: 'otherColumn', operator: Operator.Equal, value: true },
        ),
      ).toStrictEqual({
        aggregator: Aggregator.And,
        conditions: [
          { field: 'column', operator: Operator.Equal, value: true },
          { field: 'otherColumn', operator: Operator.Equal, value: true },
        ],
      });
    });

    test('intersect() should merge And trees', () => {
      expect(
        ConditionTreeUtils.intersect(
          {
            aggregator: Aggregator.And,
            conditions: [{ field: 'column', operator: Operator.Equal, value: true }],
          },
          {
            aggregator: Aggregator.And,
            conditions: [{ field: 'otherColumn', operator: Operator.Equal, value: true }],
          },
        ),
      ).toStrictEqual({
        aggregator: Aggregator.And,
        conditions: [
          { field: 'column', operator: Operator.Equal, value: true },
          { field: 'otherColumn', operator: Operator.Equal, value: true },
        ],
      });
    });
  });

  describe('isBranch', () => {
    test('isBranch should return true for a branch', () => {
      expect(
        ConditionTreeUtils.isBranch({ aggregator: Aggregator.And, conditions: [] }),
      ).toStrictEqual(true);
    });

    test('isBranch should return false otherwise', () => {
      expect(
        ConditionTreeUtils.isBranch({ field: 'column', operator: Operator.Equal, value: true }),
      ).toStrictEqual(false);
    });
  });

  describe('replaceLeafs', () => {
    const handler = (leaf: ConditionTreeLeaf) => ({ ...leaf, field: `${leaf.field}2` });

    test('should not do anything on a null tree', () => {
      const result = ConditionTreeUtils.replaceLeafs(null, handler);

      expect(result).toStrictEqual(null);
    });

    test('should replace everything on a leaf', () => {
      const result = ConditionTreeUtils.replaceLeafs(
        { field: 'column', operator: Operator.Equal, value: true },
        handler,
      );

      expect(result).toStrictEqual({ field: 'column2', operator: Operator.Equal, value: true });
    });

    test('should replace leafs on a tree with branches', () => {
      const result = ConditionTreeUtils.replaceLeafs(
        {
          aggregator: Aggregator.And,
          conditions: [
            { field: 'column', operator: Operator.Equal, value: true },
            { field: 'otherColumn', operator: Operator.Equal, value: true },
          ],
        },
        handler,
      );

      expect(result).toStrictEqual({
        aggregator: Aggregator.And,
        conditions: [
          { field: 'column2', operator: Operator.Equal, value: true },
          { field: 'otherColumn2', operator: Operator.Equal, value: true },
        ],
      });
    });
  });
});
