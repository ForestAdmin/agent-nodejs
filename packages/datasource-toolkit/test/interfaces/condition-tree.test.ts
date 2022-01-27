import ConditionTreeBranch, { Aggregator } from '../../dist/interfaces/query/condition-tree/branch';
import ConditionTreeLeaf, { Operator } from '../../dist/interfaces/query/condition-tree/leaf';

describe('ConditionTree', () => {
  describe('replaceLeafs', () => {
    const handler = (leaf: ConditionTreeLeaf) => ({ ...leaf, field: `${leaf.field}2` });

    test('should replace everything on a leaf', () => {
      const result = new ConditionTreeLeaf({
        field: 'column',
        operator: Operator.Equal,
        value: true,
      }).replaceLeafs(handler);

      expect(result).toEqual({ field: 'column2', operator: Operator.Equal, value: true });
    });

    test('should replace leafs on a tree with branches', () => {
      const result = new ConditionTreeBranch(Aggregator.And, [
        new ConditionTreeLeaf({ field: 'column', operator: Operator.Equal, value: true }),
        new ConditionTreeLeaf({ field: 'otherColumn', operator: Operator.Equal, value: true }),
      ]).replaceLeafs(handler);

      expect(result).toEqual({
        aggregator: Aggregator.And,
        conditions: [
          { field: 'column2', operator: Operator.Equal, value: true },
          { field: 'otherColumn2', operator: Operator.Equal, value: true },
        ],
      });
    });
  });
});
