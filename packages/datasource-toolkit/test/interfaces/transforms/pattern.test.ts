import ConditionTreeLeaf, {
  Operator,
} from '../../../src/interfaces/query/condition-tree/nodes/leaf';
import alternatives from '../../../src/interfaces/query/condition-tree/transforms/pattern';

describe('ConditionTreeOperators > Pattern', () => {
  describe('Operator.Contains', () => {
    test('should be rewritten', () => {
      expect(
        alternatives[Operator.Contains][0].replacer(
          new ConditionTreeLeaf('column', Operator.Contains, 'something'),
          'Europe/Paris',
        ),
      ).toEqual({ field: 'column', operator: Operator.Like, value: '%something%' });
    });
  });

  describe('Operator.StartsWith', () => {
    test('should be rewritten', () => {
      expect(
        alternatives[Operator.StartsWith][0].replacer(
          new ConditionTreeLeaf('column', Operator.StartsWith, 'something'),
          'Europe/Paris',
        ),
      ).toEqual({ field: 'column', operator: Operator.Like, value: 'something%' });
    });
  });

  describe('Operator.EndsWith', () => {
    test('should be rewritten', () => {
      expect(
        alternatives[Operator.EndsWith][0].replacer(
          new ConditionTreeLeaf('column', Operator.EndsWith, 'something'),
          'Europe/Paris',
        ),
      ).toEqual({ field: 'column', operator: Operator.Like, value: '%something' });
    });
  });
});
