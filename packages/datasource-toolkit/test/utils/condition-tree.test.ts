import ConditionTreeBranch, { Aggregator } from '../../dist/interfaces/query/condition-tree/branch';
import ConditionTreeLeaf, { Operator } from '../../dist/interfaces/query/condition-tree/leaf';
import ConditionTreeUtils from '../../dist/utils/condition-tree';

describe('ConditionTreeUtils', () => {
  describe('intersect', () => {
    test('intersect() an empty list should return an empty And', () => {
      expect(ConditionTreeUtils.intersect()).toEqual({
        aggregator: Aggregator.And,
        conditions: [],
      });
    });

    test('intersect() should return the parameter when called with only one param', () => {
      expect(
        ConditionTreeUtils.intersect(
          new ConditionTreeLeaf({ field: 'column', operator: Operator.Equal, value: true }),
        ),
      ).toEqual({ field: 'column', operator: Operator.Equal, value: true });
    });

    test('intersect() should ignore null params', () => {
      expect(
        ConditionTreeUtils.intersect(
          null,
          new ConditionTreeLeaf({ field: 'column', operator: Operator.Equal, value: true }),
          null,
        ),
      ).toEqual({ field: 'column', operator: Operator.Equal, value: true });
    });

    test('intersect() multiple trees should return the tree', () => {
      expect(
        ConditionTreeUtils.intersect(
          new ConditionTreeLeaf({ field: 'column', operator: Operator.Equal, value: true }),
          new ConditionTreeLeaf({ field: 'otherColumn', operator: Operator.Equal, value: true }),
        ),
      ).toEqual({
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
          new ConditionTreeBranch(Aggregator.And, [
            new ConditionTreeLeaf({ field: 'column', operator: Operator.Equal, value: true }),
          ]),
          new ConditionTreeBranch(Aggregator.And, [
            new ConditionTreeLeaf({ field: 'otherColumn', operator: Operator.Equal, value: true }),
          ]),
        ),
      ).toEqual({
        aggregator: Aggregator.And,
        conditions: [
          { field: 'column', operator: Operator.Equal, value: true },
          { field: 'otherColumn', operator: Operator.Equal, value: true },
        ],
      });
    });
  });
});
