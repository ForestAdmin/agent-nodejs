/* eslint-disable @typescript-eslint/no-non-null-assertion */
import ConditionTreeLeaf from '../../../src/interfaces/query/condition-tree/nodes/leaf';
import makeAlternatives from '../../../src/interfaces/query/condition-tree/transforms/pattern';

describe('ConditionTreeOperators > Pattern', () => {
  const alternatives = makeAlternatives();

  describe.each([
    ['Contains', 'a.b_c%(', 'a\\.b_c%\\(', '', 'Like', '%a.b_c%(%'],
    ['StartsWith', 'a.b_c%(', '^a\\.b_c%\\(', '', 'Like', 'a.b_c%(%'],
    ['EndsWith', 'a.b_c%(', 'a\\.b_c%\\($', '', 'Like', '%a.b_c%('],
    ['IContains', 'a.b_c%(', 'a\\.b_c%\\(', 'i', 'ILike', '%a.b_c%(%'],
    ['IStartsWith', 'a.b_c%(', '^a\\.b_c%\\(', 'i', 'ILike', 'a.b_c%(%'],
    ['IEndsWith', 'a.b_c%(', 'a\\.b_c%\\($', 'i', 'ILike', '%a.b_c%('],
  ] as const)('%s', (operator, value, source, flags, likeOperator, likePattern) => {
    test('should be rewritten as a literal match when Match is supported', () => {
      const leaf = alternatives[operator]![0].replacer(
        new ConditionTreeLeaf('column', operator, value),
        'Europe/Paris',
      ) as ConditionTreeLeaf;

      expect(leaf.field).toBe('column');
      expect(leaf.operator).toBe('Match');
      expect((leaf.value as RegExp).source).toBe(source);
      expect((leaf.value as RegExp).flags).toBe(flags);
    });

    test('should be rewritten as a like otherwise', () => {
      expect(
        alternatives[operator]![1].replacer(
          new ConditionTreeLeaf('column', operator, value),
          'Europe/Paris',
        ),
      ).toEqual({ field: 'column', operator: likeOperator, value: likePattern });
    });
  });
});
