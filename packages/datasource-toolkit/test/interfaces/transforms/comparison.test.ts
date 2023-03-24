/* eslint-disable @typescript-eslint/no-non-null-assertion */
import ConditionTreeLeaf from '../../../src/interfaces/query/condition-tree/nodes/leaf';
import makeAlternatives from '../../../src/interfaces/query/condition-tree/transforms/comparison';

describe('ConditionTreeOperators > Comparison', () => {
  const alternatives = makeAlternatives();

  describe('Blank', () => {
    test('should be rewritten for strings', () => {
      expect(
        alternatives.Blank![0].replacer(new ConditionTreeLeaf('column', 'Blank'), 'Europe/Paris'),
      ).toEqual({ field: 'column', operator: 'In', value: [null, ''] });
    });

    test('should be rewritten for other types', () => {
      expect(
        alternatives.Blank![1].replacer(new ConditionTreeLeaf('column', 'Blank'), 'Europe/Paris'),
      ).toEqual({ field: 'column', operator: 'Missing' });
    });
  });

  describe('Missing', () => {
    test('should be rewritten', () => {
      expect(
        alternatives.Missing![0].replacer(
          new ConditionTreeLeaf('column', 'Missing'),
          'Europe/Paris',
        ),
      ).toEqual({ field: 'column', operator: 'Equal', value: null });
    });
  });

  describe('Present', () => {
    test('should be rewritten for strings', () => {
      expect(
        alternatives.Present![0].replacer(
          new ConditionTreeLeaf('column', 'Present'),
          'Europe/Paris',
        ),
      ).toEqual({ field: 'column', operator: 'NotIn', value: [null, ''] });
    });

    test('should be rewritten for other types', () => {
      expect(
        alternatives.Present![1].replacer(
          new ConditionTreeLeaf('column', 'Present'),
          'Europe/Paris',
        ),
      ).toEqual({ field: 'column', operator: 'NotEqual', value: null });
    });
  });

  describe('Equal', () => {
    test('should be rewritten', () => {
      expect(
        alternatives.Equal![0].replacer(
          new ConditionTreeLeaf('column', 'Equal', 'something'),
          'Europe/Paris',
        ),
      ).toEqual({ field: 'column', operator: 'In', value: ['something'] });
    });
  });

  describe('In => Match', () => {
    test('should be rewritten with one element', () => {
      expect(
        alternatives.In![0].replacer(
          new ConditionTreeLeaf('column', 'In', ['something', 'else']),
          'Europe/Paris',
        ),
      ).toEqual({ field: 'column', operator: 'Match', value: /^something|else$/g });
    });

    test('should be rewritten with multiple elements', () => {
      expect(
        alternatives.In![0].replacer(
          new ConditionTreeLeaf('column', 'In', [null, 'something', 'else']),
          'Europe/Paris',
        ),
      ).toEqual({
        aggregator: 'Or',
        conditions: [
          { field: 'column', operator: 'Equal', value: null },
          { field: 'column', operator: 'Match', value: /^something|else$/g },
        ],
      });
    });
  });

  describe('In => Equal', () => {
    test('should be rewritten with one element', () => {
      expect(
        alternatives.In![1].replacer(
          new ConditionTreeLeaf('column', 'In', ['something']),
          'Europe/Paris',
        ),
      ).toEqual({ field: 'column', operator: 'Equal', value: 'something' });
    });

    test('should be rewritten with multiple elements', () => {
      expect(
        alternatives.In![1].replacer(
          new ConditionTreeLeaf('column', 'In', ['something', 'else']),
          'Europe/Paris',
        ),
      ).toEqual({
        aggregator: 'Or',
        conditions: [
          { field: 'column', operator: 'Equal', value: 'something' },
          { field: 'column', operator: 'Equal', value: 'else' },
        ],
      });
    });
  });

  describe('NotEqual', () => {
    test('should be rewritten', () => {
      expect(
        alternatives.NotEqual![0].replacer(
          new ConditionTreeLeaf('column', 'NotEqual', 'something'),
          'Europe/Paris',
        ),
      ).toEqual({ field: 'column', operator: 'NotIn', value: ['something'] });
    });
  });

  describe('NotIn => Match', () => {
    test('should be rewritten with one element', () => {
      expect(
        alternatives.NotIn![0].replacer(
          new ConditionTreeLeaf('column', 'NotIn', ['something', 'else']),
          'Europe/Paris',
        ),
      ).toEqual({ field: 'column', operator: 'Match', value: /(?!something|else)/g });
    });

    test('should be rewritten with multiple elements', () => {
      expect(
        alternatives.NotIn![0].replacer(
          new ConditionTreeLeaf('column', 'NotIn', [null, 'something', 'else']),
          'Europe/Paris',
        ),
      ).toEqual({
        aggregator: 'And',
        conditions: [
          { field: 'column', operator: 'NotEqual', value: null },
          { field: 'column', operator: 'Match', value: /(?!something|else)/g },
        ],
      });
    });
  });

  describe('NotIn => NotEqual', () => {
    test('should be rewritten with one element', () => {
      expect(
        alternatives.NotIn![1].replacer(
          new ConditionTreeLeaf('column', 'NotIn', ['something']),
          'Europe/Paris',
        ),
      ).toEqual({ field: 'column', operator: 'NotEqual', value: 'something' });
    });

    test('should be rewritten with multiple elements', () => {
      expect(
        alternatives.NotIn![1].replacer(
          new ConditionTreeLeaf('column', 'NotIn', ['something', 'else']),
          'Europe/Paris',
        ),
      ).toEqual({
        aggregator: 'And',
        conditions: [
          { field: 'column', operator: 'NotEqual', value: 'something' },
          { field: 'column', operator: 'NotEqual', value: 'else' },
        ],
      });
    });
  });
});
