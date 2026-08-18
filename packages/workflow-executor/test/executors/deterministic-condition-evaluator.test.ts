import evaluateOperator from '../../src/executors/deterministic-condition-evaluator';

describe('evaluateOperator', () => {
  describe('null / missing actual value (never an error)', () => {
    it.each([
      'equal',
      'not_equal',
      'greater_than',
      'less_than',
      'greater_than_or_equal',
      'less_than_or_equal',
      'in',
      'not_in',
      'contains',
      'not_contains',
    ] as const)('returns null (not evaluable) for %s on a null actual', operator => {
      expect(evaluateOperator(operator, null, 'anything')).toBeNull();
      expect(evaluateOperator(operator, undefined, 'anything')).toBeNull();
    });
  });

  describe('equal', () => {
    it('matches identical scalars', () => {
      expect(evaluateOperator('equal', 'active', 'active')).toBe(true);
      expect(evaluateOperator('equal', 5, 5)).toBe(true);
      expect(evaluateOperator('equal', false, false)).toBe(true);
    });

    it('rejects different scalars', () => {
      expect(evaluateOperator('equal', 'active', 'inactive')).toBe(false);
    });

    it('rejects a type mismatch (no coercion)', () => {
      expect(evaluateOperator('equal', 5, '5')).toBe(false);
      expect(evaluateOperator('equal', true, 'true')).toBe(false);
    });

    it('matches ISO dates by timestamp, not by string', () => {
      expect(evaluateOperator('equal', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00.000Z')).toBe(
        true,
      );
      expect(evaluateOperator('equal', '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z')).toBe(false);
    });

    it('matches arrays elementwise in order', () => {
      expect(evaluateOperator('equal', [1, 2], [1, 2])).toBe(true);
      expect(evaluateOperator('equal', [1, 2], [2, 1])).toBe(false);
      expect(evaluateOperator('equal', [1, 2], [1, 2, 3])).toBe(false);
    });

    it('rejects an array compared to a scalar', () => {
      expect(evaluateOperator('equal', [1], 1)).toBe(false);
    });
  });

  describe('not_equal', () => {
    it('matches different values', () => {
      expect(evaluateOperator('not_equal', 'active', 'inactive')).toBe(true);
      expect(evaluateOperator('not_equal', 5, '5')).toBe(true);
    });

    it('rejects identical values', () => {
      expect(evaluateOperator('not_equal', 'active', 'active')).toBe(false);
      expect(
        evaluateOperator('not_equal', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00.000Z'),
      ).toBe(false);
    });
  });

  describe('present', () => {
    it('matches non-empty values', () => {
      expect(evaluateOperator('present', 'a', undefined)).toBe(true);
      expect(evaluateOperator('present', 0, undefined)).toBe(true);
      expect(evaluateOperator('present', false, undefined)).toBe(true);
      expect(evaluateOperator('present', [1], undefined)).toBe(true);
    });

    it('rejects null, undefined, empty string and empty array', () => {
      expect(evaluateOperator('present', null, undefined)).toBe(false);
      expect(evaluateOperator('present', undefined, undefined)).toBe(false);
      expect(evaluateOperator('present', '', undefined)).toBe(false);
      expect(evaluateOperator('present', [], undefined)).toBe(false);
    });
  });

  describe('blank', () => {
    it('matches null, undefined, empty string and empty array', () => {
      expect(evaluateOperator('blank', null, undefined)).toBe(true);
      expect(evaluateOperator('blank', undefined, undefined)).toBe(true);
      expect(evaluateOperator('blank', '', undefined)).toBe(true);
      expect(evaluateOperator('blank', [], undefined)).toBe(true);
    });

    it('rejects non-empty values including falsy ones', () => {
      expect(evaluateOperator('blank', 'a', undefined)).toBe(false);
      expect(evaluateOperator('blank', 0, undefined)).toBe(false);
      expect(evaluateOperator('blank', false, undefined)).toBe(false);
    });
  });

  describe('numeric comparisons', () => {
    it('greater_than compares numbers', () => {
      expect(evaluateOperator('greater_than', 5, 3)).toBe(true);
      expect(evaluateOperator('greater_than', 3, 5)).toBe(false);
      expect(evaluateOperator('greater_than', 5, 5)).toBe(false);
    });

    it('less_than compares numbers', () => {
      expect(evaluateOperator('less_than', 3, 5)).toBe(true);
      expect(evaluateOperator('less_than', 5, 3)).toBe(false);
      expect(evaluateOperator('less_than', 5, 5)).toBe(false);
    });

    it('greater_than_or_equal includes equality', () => {
      expect(evaluateOperator('greater_than_or_equal', 5, 5)).toBe(true);
      expect(evaluateOperator('greater_than_or_equal', 4, 5)).toBe(false);
    });

    it('less_than_or_equal includes equality', () => {
      expect(evaluateOperator('less_than_or_equal', 5, 5)).toBe(true);
      expect(evaluateOperator('less_than_or_equal', 6, 5)).toBe(false);
    });

    it('is not met on a type mismatch or non-comparable operands', () => {
      expect(evaluateOperator('greater_than', 5, '3')).toBe(false);
      expect(evaluateOperator('greater_than', '5', 3)).toBe(false);
      expect(evaluateOperator('greater_than', 'abc', 'abd')).toBe(false);
      expect(evaluateOperator('less_than', Number.NaN, 5)).toBe(false);
    });
  });

  describe('date comparisons', () => {
    it('compares ISO strings as timestamps when both sides parse', () => {
      expect(evaluateOperator('greater_than', '2026-02-01', '2026-01-01')).toBe(true);
      expect(evaluateOperator('less_than', '2026-01-01T10:00:00Z', '2026-01-01T12:00:00Z')).toBe(
        true,
      );
      expect(evaluateOperator('greater_than_or_equal', '2026-01-01T00:00:00Z', '2026-01-01')).toBe(
        true,
      );
      expect(evaluateOperator('less_than_or_equal', '2026-01-02', '2026-01-01')).toBe(false);
    });

    it('is not met when one side does not parse as an ISO date', () => {
      expect(evaluateOperator('greater_than', '2026-02-01', 'not a date')).toBe(false);
      expect(evaluateOperator('less_than', 'not a date', '2026-02-01')).toBe(false);
    });
  });

  describe('in', () => {
    it('matches when the value is in the list', () => {
      expect(evaluateOperator('in', 'b', ['a', 'b'])).toBe(true);
      expect(evaluateOperator('in', 2, [1, 2, 3])).toBe(true);
      expect(evaluateOperator('in', '2026-01-01T00:00:00Z', ['2026-01-01T00:00:00.000Z'])).toBe(
        true,
      );
    });

    it('rejects when the value is not in the list', () => {
      expect(evaluateOperator('in', 'c', ['a', 'b'])).toBe(false);
      expect(evaluateOperator('in', 2, ['2'])).toBe(false);
    });

    it('is not met when the expected value is not an array', () => {
      expect(evaluateOperator('in', 'a', 'a')).toBe(false);
    });
  });

  describe('not_in', () => {
    it('matches when the value is absent from the list', () => {
      expect(evaluateOperator('not_in', 'c', ['a', 'b'])).toBe(true);
    });

    it('rejects when the value is in the list', () => {
      expect(evaluateOperator('not_in', 'a', ['a', 'b'])).toBe(false);
    });

    it('is not met (never satisfied by mismatch) when the expected value is not an array', () => {
      expect(evaluateOperator('not_in', 'a', 'b')).toBe(false);
    });
  });

  describe('contains', () => {
    it('matches a substring on strings', () => {
      expect(evaluateOperator('contains', 'hello world', 'world')).toBe(true);
      expect(evaluateOperator('contains', 'hello', 'world')).toBe(false);
    });

    it('matches membership on arrays', () => {
      expect(evaluateOperator('contains', ['a', 'b'], 'b')).toBe(true);
      expect(evaluateOperator('contains', ['a', 'b'], 'c')).toBe(false);
    });

    it('is not met on a type mismatch', () => {
      expect(evaluateOperator('contains', 5, '5')).toBe(false);
      expect(evaluateOperator('contains', 'abc', 5)).toBe(false);
    });
  });

  describe('not_contains', () => {
    it('matches when the substring is absent', () => {
      expect(evaluateOperator('not_contains', 'hello', 'world')).toBe(true);
      expect(evaluateOperator('not_contains', 'hello world', 'world')).toBe(false);
    });

    it('matches when the array does not contain the value', () => {
      expect(evaluateOperator('not_contains', ['a'], 'b')).toBe(true);
      expect(evaluateOperator('not_contains', ['a'], 'a')).toBe(false);
    });

    it('is not met (never satisfied by mismatch) on a type mismatch', () => {
      expect(evaluateOperator('not_contains', 5, '5')).toBe(false);
      expect(evaluateOperator('not_contains', 'abc', 5)).toBe(false);
    });
  });
});
