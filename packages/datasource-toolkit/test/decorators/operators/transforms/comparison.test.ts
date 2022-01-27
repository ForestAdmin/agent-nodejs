// eslint-disable-next-line max-len
import alternatives from '../../../../dist/decorators/operators-replace/transforms/comparison';
import { Aggregator } from '../../../../dist/interfaces/query/condition-tree/branch';
import ConditionTreeLeaf, { Operator } from '../../../../dist/interfaces/query/condition-tree/leaf';

describe('ConditionTreeOperators > Comparison', () => {
  describe('Operator.Blank', () => {
    test('should be rewritten for strings', () => {
      expect(
        alternatives[Operator.Blank][0].replacer(
          new ConditionTreeLeaf({ field: 'column', operator: Operator.Blank }),
          'Europe/Paris',
        ),
      ).toEqual({ field: 'column', operator: Operator.In, value: [null, ''] });
    });

    test('should be rewritten for other types', () => {
      expect(
        alternatives[Operator.Blank][1].replacer(
          new ConditionTreeLeaf({ field: 'column', operator: Operator.Blank }),
          'Europe/Paris',
        ),
      ).toEqual({ field: 'column', operator: Operator.Equal, value: null });
    });
  });

  describe('Operator.Present', () => {
    test('should be rewritten for strings', () => {
      expect(
        alternatives[Operator.Present][0].replacer(
          new ConditionTreeLeaf({ field: 'column', operator: Operator.Present }),
          'Europe/Paris',
        ),
      ).toEqual({ field: 'column', operator: Operator.NotIn, value: [null, ''] });
    });

    test('should be rewritten for other types', () => {
      expect(
        alternatives[Operator.Present][1].replacer(
          new ConditionTreeLeaf({ field: 'column', operator: Operator.Present }),
          'Europe/Paris',
        ),
      ).toEqual({ field: 'column', operator: Operator.NotEqual, value: null });
    });
  });

  describe('Operator.Equal', () => {
    test('should be rewritten', () => {
      expect(
        alternatives[Operator.Equal][0].replacer(
          new ConditionTreeLeaf({ field: 'column', operator: Operator.Equal, value: 'something' }),
          'Europe/Paris',
        ),
      ).toEqual({ field: 'column', operator: Operator.In, value: ['something'] });
    });
  });

  describe('Operator.In', () => {
    test('should be rewritten with one element', () => {
      expect(
        alternatives[Operator.In][0].replacer(
          new ConditionTreeLeaf({ field: 'column', operator: Operator.In, value: ['something'] }),
          'Europe/Paris',
        ),
      ).toEqual({ field: 'column', operator: Operator.Equal, value: 'something' });
    });

    test('should be rewritten with multiple elements', () => {
      expect(
        alternatives[Operator.In][0].replacer(
          new ConditionTreeLeaf({
            field: 'column',
            operator: Operator.In,
            value: ['something', 'else'],
          }),
          'Europe/Paris',
        ),
      ).toEqual({
        aggregator: Aggregator.Or,
        conditions: [
          { field: 'column', operator: Operator.Equal, value: 'something' },
          { field: 'column', operator: Operator.Equal, value: 'else' },
        ],
      });
    });
  });

  describe('Operator.NotEqual', () => {
    test('should be rewritten', () => {
      expect(
        alternatives[Operator.NotEqual][0].replacer(
          new ConditionTreeLeaf({
            field: 'column',
            operator: Operator.NotEqual,
            value: 'something',
          }),
          'Europe/Paris',
        ),
      ).toEqual({ field: 'column', operator: Operator.NotIn, value: ['something'] });
    });
  });

  describe('Operator.NotIn', () => {
    test('should be rewritten with one element', () => {
      expect(
        alternatives[Operator.NotIn][0].replacer(
          new ConditionTreeLeaf({
            field: 'column',
            operator: Operator.NotIn,
            value: ['something'],
          }),
          'Europe/Paris',
        ),
      ).toEqual({ field: 'column', operator: Operator.NotEqual, value: 'something' });
    });

    test('should be rewritten with multiple elements', () => {
      expect(
        alternatives[Operator.NotIn][0].replacer(
          new ConditionTreeLeaf({
            field: 'column',
            operator: Operator.NotIn,
            value: ['something', 'else'],
          }),
          'Europe/Paris',
        ),
      ).toEqual({
        aggregator: Aggregator.And,
        conditions: [
          { field: 'column', operator: Operator.NotEqual, value: 'something' },
          { field: 'column', operator: Operator.NotEqual, value: 'else' },
        ],
      });
    });
  });
});
