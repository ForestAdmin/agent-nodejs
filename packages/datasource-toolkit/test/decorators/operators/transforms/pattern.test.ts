import alternatives from '../../../../dist/decorators/operators/transforms/pattern';
import ConditionTreeLeaf, { Operator } from '../../../../dist/interfaces/query/condition-tree/leaf';

describe('ConditionTreeOperators > Pattern', () => {
  describe('Operator.Contains', () => {
    test('should be rewritten', () => {
      expect(
        alternatives[Operator.Contains][0].replacer(
          new ConditionTreeLeaf({
            field: 'column',
            operator: Operator.Contains,
            value: 'something',
          }),
          'Europe/Paris',
        ),
      ).toEqual({ field: 'column', operator: Operator.Like, value: '%something%' });
    });
  });

  describe('Operator.StartsWith', () => {
    test('should be rewritten', () => {
      expect(
        alternatives[Operator.StartsWith][0].replacer(
          new ConditionTreeLeaf({
            field: 'column',
            operator: Operator.StartsWith,
            value: 'something',
          }),
          'Europe/Paris',
        ),
      ).toEqual({ field: 'column', operator: Operator.Like, value: 'something%' });
    });
  });

  describe('Operator.EndsWith', () => {
    test('should be rewritten', () => {
      expect(
        alternatives[Operator.EndsWith][0].replacer(
          new ConditionTreeLeaf({
            field: 'column',
            operator: Operator.EndsWith,
            value: 'something',
          }),
          'Europe/Paris',
        ),
      ).toEqual({ field: 'column', operator: Operator.Like, value: '%something' });
    });
  });
});
