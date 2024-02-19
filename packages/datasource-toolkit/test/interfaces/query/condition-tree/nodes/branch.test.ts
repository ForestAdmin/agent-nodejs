import {
  ConditionTreeBranch,
  ConditionTreeFactory,
  ConditionTreeLeaf,
} from '../../../../../src/index';

describe('Condition tree branch', () => {
  describe('toPlainObject', () => {
    it('should return a plain object representation of the branch', () => {
      const conditionTree = new ConditionTreeBranch('And', [
        new ConditionTreeLeaf('field', 'Equal', 'value'),
      ]);

      expect(conditionTree.toPlainObject()).toEqual({
        aggregator: 'And',
        conditions: [
          {
            field: 'field',
            operator: 'Equal',
            value: 'value',
          },
        ],
      });
    });

    it('should recreate the same object when transformed to plain object and back', () => {
      const conditionTree = new ConditionTreeBranch('And', [
        new ConditionTreeLeaf('field', 'Equal', 'value'),
        new ConditionTreeLeaf('field2', 'NotEqual', 'value2'),
      ]);

      const plain = conditionTree.toPlainObject();

      const recreated = ConditionTreeFactory.fromPlainObject(plain);

      expect(recreated).toEqual(conditionTree);
    });
  });
});
