import { allOperators } from '@forestadmin/datasource-toolkit';

import {
  normalizeOperator,
  toCanonicalOperatorSet,
  toSnakeCaseOperator,
} from '../../src/validation/operator-normalizer';

describe('operator-normalizer', () => {
  describe('normalizeOperator', () => {
    it('maps a snake_case operator back to its PascalCase form', () => {
      expect(normalizeOperator('less_than_or_equal')).toBe('LessThanOrEqual');
    });

    it('maps a single-word operator', () => {
      expect(normalizeOperator('blank')).toBe('Blank');
    });

    it('maps a leading-initialism operator', () => {
      expect(normalizeOperator('i_contains')).toBe('IContains');
      expect(normalizeOperator('not_i_contains')).toBe('NotIContains');
      expect(normalizeOperator('i_like')).toBe('ILike');
    });

    it('maps an operator that embeds a single letter and a word', () => {
      expect(normalizeOperator('after_x_hours_ago')).toBe('AfterXHoursAgo');
      expect(normalizeOperator('previous_x_days_to_date')).toBe('PreviousXDaysToDate');
    });

    it('round-trips every canonical operator through snake_case', () => {
      allOperators.forEach(operator => {
        expect(normalizeOperator(toSnakeCaseOperator(operator))).toBe(operator);
      });
    });

    it('returns undefined for an operator absent from the canonical set', () => {
      expect(normalizeOperator('made_up_operator')).toBeUndefined();
    });

    it.each(['constructor', 'toString', '__proto__', 'valueOf', 'hasOwnProperty'])(
      'returns undefined for the inherited object key %s',
      key => {
        expect(normalizeOperator(key)).toBeUndefined();
      },
    );
  });

  describe('toCanonicalOperatorSet', () => {
    it('reorders an operator set to the canonical order', () => {
      expect(toCanonicalOperatorSet(['Contains', 'In', 'Equal'])).toEqual([
        'Equal',
        'In',
        'Contains',
      ]);
    });

    it('gives two sets listing the same operators the same result', () => {
      expect(toCanonicalOperatorSet(['Blank', 'Present'])).toEqual(
        toCanonicalOperatorSet(['Present', 'Blank']),
      );
    });

    it('drops a duplicate, which an enum must not carry twice', () => {
      expect(toCanonicalOperatorSet(['Equal', 'Equal', 'In'])).toEqual(['Equal', 'In']);
    });

    it('keeps every canonical operator in the toolkit order', () => {
      expect(toCanonicalOperatorSet([...allOperators].reverse())).toEqual([...allOperators]);
    });
  });
});
