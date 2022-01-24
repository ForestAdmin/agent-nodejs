import alternatives from '../../../../src/decorators/condition-tree-operators/transforms/pattern';
import { Operator } from '../../../../src/interfaces/query/selection';

describe('ConditionTreeOperators > Pattern', () => {
  describe('Operator.Contains', () => {
    test('should be rewritten', () => {
      expect(
        alternatives[Operator.Contains][0].replacer(
          { field: 'column', operator: Operator.Contains, value: 'something' },
          'Europe/Paris',
        ),
      ).toStrictEqual({ field: 'column', operator: Operator.Like, value: '%something%' });
    });
  });

  describe('Operator.StartsWith', () => {
    test('should be rewritten', () => {
      expect(
        alternatives[Operator.StartsWith][0].replacer(
          { field: 'column', operator: Operator.StartsWith, value: 'something' },
          'Europe/Paris',
        ),
      ).toStrictEqual({ field: 'column', operator: Operator.Like, value: 'something%' });
    });
  });

  describe('Operator.EndsWith', () => {
    test('should be rewritten', () => {
      expect(
        alternatives[Operator.EndsWith][0].replacer(
          { field: 'column', operator: Operator.EndsWith, value: 'something' },
          'Europe/Paris',
        ),
      ).toStrictEqual({ field: 'column', operator: Operator.Like, value: '%something' });
    });
  });
});
