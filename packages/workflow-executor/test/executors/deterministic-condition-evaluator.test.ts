import type { Clock } from '../../src/executors/deterministic-condition-evaluator';
import type { ConditionOperator } from '../../src/types/validated/step-definition';

import evaluateOperator from '../../src/executors/deterministic-condition-evaluator';

// A fixed instant in a non-UTC zone: 2026-09-04 12:30 in Paris (UTC+2 in September), so any
// operator that silently read the machine's clock or UTC's day would give itself away.
const CLOCK: Clock = { now: new Date('2026-09-04T10:30:00Z'), timezone: 'Europe/Paris' };

function ev(operator: ConditionOperator, actual: unknown, expected?: unknown, clock = CLOCK) {
  return evaluateOperator(operator, actual, expected, clock);
}

describe('evaluateOperator', () => {
  describe('null / missing actual value (never an error)', () => {
    it.each([
      'equal',
      'not_equal',
      'greater_than',
      'less_than',
      'in',
      'includes_all',
      'contains',
      'not_contains',
      'starts_with',
      'ends_with',
      'i_contains',
      'before',
      'after',
      'past',
      'future',
      'today',
      'yesterday',
      'previous_x_days',
      'previous_x_days_to_date',
      'before_x_hours_ago',
      'after_x_hours_ago',
    ] as const)('returns null (not evaluable) for %s on a null actual', operator => {
      expect(ev(operator, null, 'anything')).toBeNull();
      expect(ev(operator, undefined, 'anything')).toBeNull();
    });
  });

  describe('equal', () => {
    it('matches identical scalars', () => {
      expect(ev('equal', 'active', 'active')).toBe(true);
      expect(ev('equal', 5, 5)).toBe(true);
      expect(ev('equal', false, false)).toBe(true);
    });

    it('rejects different scalars', () => {
      expect(ev('equal', 'active', 'inactive')).toBe(false);
    });

    it('rejects a type mismatch', () => {
      expect(ev('equal', true, 'true')).toBe(false);
      expect(ev('equal', 'abc', 100)).toBe(false);
    });

    it('matches ISO dates by timestamp, not by string', () => {
      expect(ev('equal', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00.000Z')).toBe(true);
      expect(ev('equal', '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z')).toBe(false);
    });

    it('matches arrays elementwise in order', () => {
      expect(ev('equal', [1, 2], [1, 2])).toBe(true);
      expect(ev('equal', [1, 2], [2, 1])).toBe(false);
      expect(ev('equal', [1, 2], [1, 2, 3])).toBe(false);
    });

    it('rejects an array compared to a scalar', () => {
      expect(ev('equal', [1], 1)).toBe(false);
    });
  });

  describe('not_equal', () => {
    it('matches different values', () => {
      expect(ev('not_equal', 'active', 'inactive')).toBe(true);
      expect(ev('not_equal', 5, 6)).toBe(true);
    });

    it('rejects identical values', () => {
      expect(ev('not_equal', 'active', 'active')).toBe(false);
      expect(ev('not_equal', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00.000Z')).toBe(false);
    });

    it('is not satisfied by a type mismatch, like every other operator', () => {
      expect(ev('not_equal', true, 'true')).toBe(false);
      expect(ev('not_equal', 5, 'abc')).toBe(false);
      expect(ev('not_equal', ['a'], 'a')).toBe(false);
    });
  });

  describe('numeric strings (decimal/bigint columns come back as strings)', () => {
    it('compares a numeric string against a number', () => {
      expect(ev('greater_than', '150.00', 100)).toBe(true);
      expect(ev('greater_than', '50.00', 100)).toBe(false);
      expect(ev('less_than', 100, '150.00')).toBe(true);
      expect(ev('greater_than', '100', 99)).toBe(true);
      expect(ev('less_than', '-3', 0)).toBe(true);
    });

    it('equates a numeric string with a number', () => {
      expect(ev('equal', '42', 42)).toBe(true);
      expect(ev('equal', 42, '42.0')).toBe(true);
      expect(ev('not_equal', '42', 42)).toBe(false);
      expect(ev('in', '150.00', [100, 150])).toBe(true);
    });

    it('leaves a non-numeric string uncoerced', () => {
      expect(ev('greater_than', 'abc', 100)).toBe(false);
      expect(ev('greater_than', '12abc', 100)).toBe(false);
      expect(ev('equal', '', 0)).toBe(false);
    });

    it('does not coerce when neither side is a number', () => {
      expect(ev('greater_than', '5', '3')).toBe(false);
    });
  });

  describe('present', () => {
    it('matches non-empty values', () => {
      expect(ev('present', 'a', undefined)).toBe(true);
      expect(ev('present', 0, undefined)).toBe(true);
      expect(ev('present', false, undefined)).toBe(true);
      expect(ev('present', [1], undefined)).toBe(true);
    });

    it('rejects null, undefined, empty string and empty array', () => {
      expect(ev('present', null, undefined)).toBe(false);
      expect(ev('present', undefined, undefined)).toBe(false);
      expect(ev('present', '', undefined)).toBe(false);
      expect(ev('present', [], undefined)).toBe(false);
    });
  });

  describe('blank', () => {
    it('matches null, undefined, empty string and empty array', () => {
      expect(ev('blank', null, undefined)).toBe(true);
      expect(ev('blank', undefined, undefined)).toBe(true);
      expect(ev('blank', '', undefined)).toBe(true);
      expect(ev('blank', [], undefined)).toBe(true);
    });

    it('rejects non-empty values including falsy ones', () => {
      expect(ev('blank', 'a', undefined)).toBe(false);
      expect(ev('blank', 0, undefined)).toBe(false);
      expect(ev('blank', false, undefined)).toBe(false);
    });
  });

  describe('numeric comparisons', () => {
    it('greater_than compares numbers', () => {
      expect(ev('greater_than', 5, 3)).toBe(true);
      expect(ev('greater_than', 3, 5)).toBe(false);
      expect(ev('greater_than', 5, 5)).toBe(false);
    });

    it('less_than compares numbers', () => {
      expect(ev('less_than', 3, 5)).toBe(true);
      expect(ev('less_than', 5, 3)).toBe(false);
      expect(ev('less_than', 5, 5)).toBe(false);
    });

    it('is not met on a type mismatch or non-comparable operands', () => {
      expect(ev('greater_than', 'abc', 'abd')).toBe(false);
      expect(ev('greater_than', true, 3)).toBe(false);
      expect(ev('less_than', Number.NaN, 5)).toBe(false);
    });
  });

  describe('date comparisons', () => {
    it('compares ISO strings as timestamps when both sides parse', () => {
      expect(ev('greater_than', '2026-02-01', '2026-01-01')).toBe(true);
      expect(ev('less_than', '2026-01-01T10:00:00Z', '2026-01-01T12:00:00Z')).toBe(true);
      expect(ev('greater_than', '2026-01-02T00:00:00Z', '2026-01-01')).toBe(true);
      expect(ev('less_than', '2026-01-02', '2026-01-01')).toBe(false);
    });

    it('is not met when one side does not parse as an ISO date', () => {
      expect(ev('greater_than', '2026-02-01', 'not a date')).toBe(false);
      expect(ev('less_than', 'not a date', '2026-02-01')).toBe(false);
    });

    it('treats an impossible calendar date as not a date instead of rolling it over', () => {
      expect(ev('equal', '2026-03-02', '2026-02-30')).toBe(false);
      expect(ev('equal', '2026-05-01', '2026-04-31')).toBe(false);
      expect(ev('equal', '2025-03-01', '2025-02-29')).toBe(false);
      expect(ev('greater_than', '2026-02-30', '2026-01-01')).toBe(false);
      expect(ev('less_than', '2026-01-01', '2026-02-30')).toBe(false);
      expect(ev('in', '2026-03-02', ['2026-02-30'])).toBe(false);
    });

    it('still accepts a leap day that exists', () => {
      expect(ev('equal', '2024-02-29', '2024-02-29T00:00:00.000Z')).toBe(true);
    });

    describe('on a host whose timezone is not UTC', () => {
      const originalTz = process.env.TZ;

      beforeAll(() => {
        process.env.TZ = 'Pacific/Kiritimati';
      });

      afterAll(() => {
        process.env.TZ = originalTz;
      });

      it('reads a datetime without an offset as UTC, not as host-local time', () => {
        expect(ev('equal', '2026-01-01T10:00:00', '2026-01-01T10:00:00Z')).toBe(true);
        expect(ev('greater_than', '2026-01-01T12:00:00', '2026-01-01T11:00:00Z')).toBe(true);
        expect(ev('less_than', '2026-01-01T10:00:00', '2026-01-01T11:00:00+00:00')).toBe(true);
      });
    });
  });

  // A bigint column comes back as a string while its threshold is a JSON number, so Number() would
  // round the column and let it satisfy a condition the data does not meet. Reported by Macroscope
  // on PR #1837.
  describe('whole numbers beyond 2^53', () => {
    const justAbove = '9007199254740993';
    const twoPow53 = 9007199254740992;

    it('does not read a bigint string as equal to the number it rounds to', () => {
      expect(ev('equal', justAbove, twoPow53)).toBe(false);
      expect(ev('not_equal', justAbove, twoPow53)).toBe(true);
    });

    it('orders a bigint string against a threshold it exceeds by one', () => {
      expect(ev('greater_than', justAbove, twoPow53)).toBe(true);
      expect(ev('less_than', justAbove, twoPow53)).toBe(false);
    });

    it('excludes it from a list it rounds into', () => {
      expect(ev('in', justAbove, [twoPow53])).toBe(false);
    });

    // Decimals have no BigInt to be read as, so they keep the Number path.
    it('leaves decimals on the number path', () => {
      expect(ev('equal', '150.00', 150)).toBe(true);
      expect(ev('greater_than', '150.50', 150)).toBe(true);
      expect(ev('equal', 1.5, 1.5)).toBe(true);
    });

    it('still compares ordinary whole numbers', () => {
      expect(ev('equal', '150', 150)).toBe(true);
      expect(ev('greater_than', 150, 100)).toBe(true);
      expect(ev('less_than', '-20', 0)).toBe(true);
    });
  });

  describe('in', () => {
    it('matches when the value is in the list', () => {
      expect(ev('in', 'b', ['a', 'b'])).toBe(true);
      expect(ev('in', 2, [1, 2, 3])).toBe(true);
      expect(ev('in', '2026-01-01T00:00:00Z', ['2026-01-01T00:00:00.000Z'])).toBe(true);
    });

    it('rejects when the value is not in the list', () => {
      expect(ev('in', 'c', ['a', 'b'])).toBe(false);
      expect(ev('in', 2, ['3'])).toBe(false);
    });

    it('is not met when the expected value is not an array', () => {
      expect(ev('in', 'a', 'a')).toBe(false);
    });

    it('is not met when no member of the list is comparable to the value', () => {
      expect(ev('in', true, ['true'])).toBe(false);
    });
  });

  describe('contains', () => {
    it('matches a substring on strings', () => {
      expect(ev('contains', 'hello world', 'world')).toBe(true);
      expect(ev('contains', 'hello', 'world')).toBe(false);
    });

    it('is not met on anything but two strings (contract: String fields only)', () => {
      expect(ev('contains', ['a', 'b'], 'b')).toBe(false);
      expect(ev('contains', 5, '5')).toBe(false);
      expect(ev('contains', 'abc', 5)).toBe(false);
    });
  });

  describe('not_contains', () => {
    it('matches when the substring is absent', () => {
      expect(ev('not_contains', 'hello', 'world')).toBe(true);
      expect(ev('not_contains', 'hello world', 'world')).toBe(false);
    });

    it('is not met (never satisfied by mismatch) on anything but two strings', () => {
      expect(ev('not_contains', ['a'], 'b')).toBe(false);
      expect(ev('not_contains', 5, '5')).toBe(false);
      expect(ev('not_contains', 'abc', 5)).toBe(false);
    });
  });

  describe('string operators', () => {
    it('starts_with and ends_with are case sensitive', () => {
      expect(ev('starts_with', 'active', 'act')).toBe(true);
      expect(ev('starts_with', 'active', 'Act')).toBe(false);
      expect(ev('ends_with', 'active', 'ive')).toBe(true);
      expect(ev('ends_with', 'active', 'IVE')).toBe(false);
    });

    // What Postgres ILIKE does, measured on an en_US.utf8 database: 'É' ILIKE '%é%' holds,
    // 'é' ILIKE '%e%' does not. Case is folded, accents are letters of their own.
    it('i_contains folds case but keeps accents, like Postgres ILIKE', () => {
      expect(ev('i_contains', 'ACTIVE', 'act')).toBe(true);
      expect(ev('i_contains', 'É', 'é')).toBe(true);
      expect(ev('i_contains', 'é', 'e')).toBe(false);
    });

    it('never coerces a non-string into text', () => {
      expect(ev('starts_with', 150, '15')).toBe(false);
      expect(ev('i_contains', 'abc', 1)).toBe(false);
    });
  });

  describe('includes_all', () => {
    it('matches when every wanted value is a member', () => {
      expect(ev('includes_all', ['a', 'b', 'c'], ['a', 'c'])).toBe(true);
      expect(ev('includes_all', ['a', 'b'], 'a')).toBe(true);
    });

    it('rejects when one wanted value is missing, or the actual is not a list', () => {
      expect(ev('includes_all', ['a'], ['a', 'b'])).toBe(false);
      expect(ev('includes_all', 'a', ['a'])).toBe(false);
    });

    // every() on an empty list is vacuously true, which would make a blank widget match every
    // record instead of none.
    it('is not met on an empty wanted list', () => {
      expect(ev('includes_all', ['a'], [])).toBe(false);
    });
  });

  describe('before / after', () => {
    it('orders two instants strictly', () => {
      expect(ev('before', '2026-01-01T00:00:00Z', '2026-06-01T00:00:00Z')).toBe(true);
      expect(ev('after', '2026-01-01T00:00:00Z', '2026-06-01T00:00:00Z')).toBe(false);
      expect(ev('before', '2026-06-01T00:00:00Z', '2026-06-01T00:00:00Z')).toBe(false);
      expect(ev('after', '2026-06-01T00:00:00Z', '2026-06-01T00:00:00Z')).toBe(false);
    });

    it('orders two calendar dates', () => {
      expect(ev('before', '2026-03-01', '2026-03-02')).toBe(true);
      expect(ev('after', '2026-03-01', '2026-03-02')).toBe(false);
    });

    it('is not met on a non-date or an impossible date', () => {
      expect(ev('before', 'soon', '2026-06-01T00:00:00Z')).toBe(false);
      expect(ev('before', '2026-02-30', '2026-06-01T00:00:00Z')).toBe(false);
    });
  });

  describe('past / future (relative to the clock)', () => {
    it('compares against the injected instant, not the machine clock', () => {
      expect(ev('past', '2026-09-04T10:00:00Z')).toBe(true);
      expect(ev('past', '2026-09-04T11:00:00Z')).toBe(false);
      expect(ev('future', '2026-09-04T11:00:00Z')).toBe(true);
      expect(ev('future', '2026-09-04T10:00:00Z')).toBe(false);
    });

    it('is neither past nor future at the exact instant', () => {
      expect(ev('past', '2026-09-04T10:30:00Z')).toBe(false);
      expect(ev('future', '2026-09-04T10:30:00Z')).toBe(false);
    });
  });

  describe('before_x_hours_ago / after_x_hours_ago', () => {
    it('measures from the injected instant', () => {
      expect(ev('before_x_hours_ago', '2026-09-04T08:00:00Z', 2)).toBe(true);
      expect(ev('before_x_hours_ago', '2026-09-04T09:00:00Z', 2)).toBe(false);
      expect(ev('after_x_hours_ago', '2026-09-04T09:00:00Z', 2)).toBe(true);
      expect(ev('after_x_hours_ago', '2026-09-04T08:00:00Z', 2)).toBe(false);
    });

    it('accepts zero and fractional hours, like the list filter widget', () => {
      expect(ev('before_x_hours_ago', '2026-09-04T10:00:00Z', 0)).toBe(true);
      expect(ev('before_x_hours_ago', '2026-09-04T11:00:00Z', 0)).toBe(false);
      expect(ev('before_x_hours_ago', '2026-09-04T08:59:00Z', 1.5)).toBe(true);
      expect(ev('before_x_hours_ago', '2026-09-04T09:01:00Z', 1.5)).toBe(false);
    });

    it('is not met on a count that is not a non-negative number', () => {
      expect(ev('before_x_hours_ago', '2026-09-04T08:00:00Z', -1)).toBe(false);
      expect(ev('before_x_hours_ago', '2026-09-04T08:00:00Z', 'two')).toBe(false);
    });
  });

  describe('day windows (today, yesterday, previous_x_days)', () => {
    // Paris is UTC+2 here: its 4 September runs from 2026-09-03T22:00Z to 2026-09-04T22:00Z.
    it('reads "today" in the clock timezone, not in UTC', () => {
      expect(ev('today', '2026-09-03T23:00:00Z')).toBe(true);
      expect(ev('today', '2026-09-03T21:00:00Z')).toBe(false);
      expect(ev('today', '2026-09-04T21:59:59Z')).toBe(true);
      expect(ev('today', '2026-09-04T22:00:00Z')).toBe(false);
    });

    it('reads "yesterday" as the previous project day', () => {
      expect(ev('yesterday', '2026-09-03T21:00:00Z')).toBe(true);
      expect(ev('yesterday', '2026-09-03T23:00:00Z')).toBe(false);
    });

    // The toolkit's transforms emit GreaterThan for a datetime and GreaterThanOrEqual for a
    // calendar date: a record stamped exactly at midnight is "today" in a list filter only when
    // the column is a Dateonly, and the Decision must not say otherwise.
    it('treats the very start of the window like the list filter does', () => {
      expect(ev('today', '2026-09-03T22:00:00Z')).toBe(false);
      expect(ev('today', '2026-09-03T22:00:00.001Z')).toBe(true);
      expect(ev('today', '2026-09-04')).toBe(true);
      expect(ev('yesterday', '2026-09-03')).toBe(true);
    });

    it('reads the SQL datetime form with a space as UTC too', () => {
      expect(ev('today', '2026-09-04 08:00:00')).toBe(true);
      expect(ev('today', '2026-09-04 23:00:00')).toBe(false);
    });

    // Paris switched to summer time on 2026-03-29 at 02:00: that day is 23 hours long, and a
    // window built from wall-clock arithmetic instead of zone-aware startOf would drift by an hour.
    it('keeps the day bounds right across a DST change', () => {
      const afterSwitch: Clock = {
        now: new Date('2026-03-30T08:00:00Z'),
        timezone: 'Europe/Paris',
      };

      expect(ev('yesterday', '2026-03-28T23:00:01Z', undefined, afterSwitch)).toBe(true);
      expect(ev('yesterday', '2026-03-28T22:59:59Z', undefined, afterSwitch)).toBe(false);
      expect(ev('yesterday', '2026-03-29T21:59:59Z', undefined, afterSwitch)).toBe(true);
      expect(ev('yesterday', '2026-03-29T22:00:00Z', undefined, afterSwitch)).toBe(false);
    });

    it('previous_x_days excludes today, previous_x_days_to_date includes it up to the instant', () => {
      expect(ev('previous_x_days', '2026-09-01T12:00:00Z', 7)).toBe(true);
      expect(ev('previous_x_days', '2026-09-04T09:00:00Z', 7)).toBe(false);
      expect(ev('previous_x_days', '2026-08-27T21:00:00Z', 7)).toBe(false);
      expect(ev('previous_x_days_to_date', '2026-09-04T09:00:00Z', 7)).toBe(true);
      expect(ev('previous_x_days_to_date', '2026-09-04T11:00:00Z', 7)).toBe(false);
    });

    it('is not met on a count that is not a positive whole number', () => {
      expect(ev('previous_x_days', '2026-09-01T12:00:00Z', 0)).toBe(false);
      expect(ev('previous_x_days', '2026-09-01T12:00:00Z', 1.5)).toBe(false);
      expect(ev('previous_x_days', '2026-09-01T12:00:00Z', 'seven')).toBe(false);
    });

    // A calendar date has no instant: read as UTC midnight it would fall before Honolulu's day
    // even started, and the record's own "today" would be counted as yesterday.
    it('reads a calendar date in the clock timezone', () => {
      const honolulu: Clock = {
        now: new Date('2026-09-04T05:00:00Z'),
        timezone: 'Pacific/Honolulu',
      };

      expect(ev('today', '2026-09-03', undefined, honolulu)).toBe(true);
      expect(ev('today', '2026-09-04', undefined, honolulu)).toBe(false);
      expect(ev('yesterday', '2026-09-02', undefined, honolulu)).toBe(true);
    });

    it('is not met on a value that is not a date', () => {
      expect(ev('today', 'now')).toBe(false);
      expect(ev('today', 150)).toBe(false);
    });
  });
});
