import ConditionTreeLeaf from '../../../src/interfaces/query/condition-tree/nodes/leaf';
import makeAlternatives from '../../../src/interfaces/query/condition-tree/transforms/pattern';

describe('ConditionTreeOperators > Pattern', () => {
  const alternatives = makeAlternatives();

  describe('Contains', () => {
    test('should be rewritten', () => {
      expect(
        alternatives.Contains[0].replacer(
          new ConditionTreeLeaf('column', 'Contains', 'something'),
          'Europe/Paris',
        ),
      ).toEqual({ field: 'column', operator: 'Like', value: '%something%' });
    });
  });

  describe('StartsWith', () => {
    test('should be rewritten', () => {
      expect(
        alternatives.StartsWith[0].replacer(
          new ConditionTreeLeaf('column', 'StartsWith', 'something'),
          'Europe/Paris',
        ),
      ).toEqual({ field: 'column', operator: 'Like', value: 'something%' });
    });
  });

  describe('EndsWith', () => {
    test('should be rewritten', () => {
      expect(
        alternatives.EndsWith[0].replacer(
          new ConditionTreeLeaf('column', 'EndsWith', 'something'),
          'Europe/Paris',
        ),
      ).toEqual({ field: 'column', operator: 'Like', value: '%something' });
    });
  });
});
