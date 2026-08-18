import type { ConditionOperator } from '../types/validated/step-definition';

// Guard against Date.parse's laxity ("5" parses as a year in some engines): only strings that
// start like an ISO date are treated as dates.
const ISO_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;

function toTimestamp(value: unknown): number | null {
  if (typeof value !== 'string' || !ISO_DATE_PREFIX.test(value)) return null;

  const parsed = Date.parse(value);

  return Number.isNaN(parsed) ? null : parsed;
}

function scalarEqual(actual: unknown, expected: unknown): boolean {
  if (actual === expected) return true;

  const actualTs = toTimestamp(actual);
  const expectedTs = toTimestamp(expected);

  return actualTs !== null && expectedTs !== null && actualTs === expectedTs;
}

function isEqual(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(actual) && Array.isArray(expected)) {
    return (
      actual.length === expected.length &&
      actual.every((item, index) => scalarEqual(item, expected[index]))
    );
  }

  if (Array.isArray(actual) || Array.isArray(expected)) return false;

  return scalarEqual(actual, expected);
}

function compare(actual: unknown, expected: unknown): number | null {
  if (typeof actual === 'number' && typeof expected === 'number') {
    if (Number.isNaN(actual) || Number.isNaN(expected)) return null;

    return actual - expected;
  }

  const actualTs = toTimestamp(actual);
  const expectedTs = toTimestamp(expected);
  if (actualTs !== null && expectedTs !== null) return actualTs - expectedTs;

  return null;
}

function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;

  return true;
}

function isMemberOf(list: unknown, candidate: unknown): boolean {
  return Array.isArray(list) && list.some(item => scalarEqual(item, candidate));
}

/**
 * Pure evaluation of one deterministic condition. Never throws for data reasons:
 * - `null` = not evaluable (the resolved value is null/missing) — treated as "not met";
 * - a type-mismatched comparison (including for negated operators) is "not met" (`false`),
 *   so a broken config can never accidentally satisfy a condition.
 */
export default function evaluateOperator(
  operator: ConditionOperator,
  actual: unknown,
  expected: unknown,
): boolean | null {
  if (operator === 'present') return isPresent(actual);
  if (operator === 'blank') return !isPresent(actual);
  if (actual === null || actual === undefined) return null;

  switch (operator) {
    case 'equal':
      return isEqual(actual, expected);
    case 'not_equal':
      return !isEqual(actual, expected);

    case 'greater_than': {
      const diff = compare(actual, expected);

      return diff !== null && diff > 0;
    }

    case 'less_than': {
      const diff = compare(actual, expected);

      return diff !== null && diff < 0;
    }

    case 'greater_than_or_equal': {
      const diff = compare(actual, expected);

      return diff !== null && diff >= 0;
    }

    case 'less_than_or_equal': {
      const diff = compare(actual, expected);

      return diff !== null && diff <= 0;
    }

    case 'in':
      return isMemberOf(expected, actual);
    case 'not_in':
      return Array.isArray(expected) && !isMemberOf(expected, actual);
    case 'contains':
      if (typeof actual === 'string' && typeof expected === 'string') {
        return actual.includes(expected);
      }

      return isMemberOf(actual, expected);
    case 'not_contains':
      if (typeof actual === 'string' && typeof expected === 'string') {
        return !actual.includes(expected);
      }

      return Array.isArray(actual) && !isMemberOf(actual, expected);
    default:
      return null;
  }
}
