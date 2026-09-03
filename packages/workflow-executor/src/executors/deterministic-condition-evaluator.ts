import type { ConditionOperator } from '../types/validated/step-definition';

// Guard against Date.parse's laxity ("5" parses as a year in some engines): only strings that
// start like an ISO date are treated as dates.
const ISO_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;
const TIMEZONE_SUFFIX = /(Z|[+-]\d{2}:?\d{2})$/i;
// Sequelize hands back numeric/decimal/bigint columns as strings although datasource-sequelize
// maps them to the Number primitive, so the builder's JSON number meets a string at runtime.
const NUMERIC_STRING = /^-?\d+(\.\d+)?$/;
const INTEGER_STRING = /^-?\d+$/;

// Date.parse rolls an out-of-range day over ("2026-02-30" becomes 2026-03-02), which would make a
// nonsensical config compare equal to a real date instead of being inert.
function isRealCalendarDate(datePart: string): boolean {
  const parsed = new Date(`${datePart}T00:00:00.000Z`);

  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(datePart);
}

function toTimestamp(value: unknown): number | null {
  if (typeof value !== 'string' || !ISO_DATE_PREFIX.test(value)) return null;
  if (!isRealCalendarDate(value.slice(0, 10))) return null;

  // Date.parse reads an offset-less datetime as host-local (date-only as UTC), which would route
  // the same run differently per machine — pin every offset-less datetime to UTC.
  const absolute = value.includes('T') && !TIMEZONE_SUFFIX.test(value) ? `${value}Z` : value;
  const parsed = Date.parse(absolute);

  return Number.isNaN(parsed) ? null : parsed;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;

  return typeof value === 'string' && NUMERIC_STRING.test(value) ? Number(value) : null;
}

// Coercion only kicks in against a real number (always the build-time side): two numeric-looking
// strings stay strings, since the contract exposes ordering operators for Number/Date fields only.
function toNumberPair(actual: unknown, expected: unknown): [number, number] | null {
  if (typeof actual !== 'number' && typeof expected !== 'number') return null;

  const actualNumber = toNumber(actual);
  const expectedNumber = toNumber(expected);

  return actualNumber !== null && expectedNumber !== null ? [actualNumber, expectedNumber] : null;
}

function toInteger(value: unknown): bigint | null {
  if (typeof value === 'number') return Number.isInteger(value) ? BigInt(value) : null;

  return typeof value === 'string' && INTEGER_STRING.test(value) ? BigInt(value) : null;
}

// A bigint column arrives as a string (Sequelize) while its threshold arrives as a JSON number, so
// Number() would round the column past 2^53 and make 9007199254740993 compare equal to
// 9007199254740992 — silently satisfying a condition the data does not meet. Whole numbers are
// therefore compared exactly. Only whole ones: a decimal has no BigInt to be read as.
function compareIntegers(actual: unknown, expected: unknown): number | null {
  if (typeof actual !== 'number' && typeof expected !== 'number') return null;

  const actualInteger = toInteger(actual);
  const expectedInteger = toInteger(expected);
  if (actualInteger === null || expectedInteger === null) return null;

  if (actualInteger === expectedInteger) return 0;

  return actualInteger > expectedInteger ? 1 : -1;
}

function scalarEqual(actual: unknown, expected: unknown): boolean | null {
  if (actual === expected) return true;

  const integers = compareIntegers(actual, expected);
  if (integers !== null) return integers === 0;

  const numbers = toNumberPair(actual, expected);
  if (numbers) return numbers[0] === numbers[1];

  const actualTs = toTimestamp(actual);
  const expectedTs = toTimestamp(expected);
  if (actualTs !== null && expectedTs !== null) return actualTs === expectedTs;

  return typeof actual === typeof expected ? false : null;
}

function isEqual(actual: unknown, expected: unknown): boolean | null {
  if (Array.isArray(actual) && Array.isArray(expected)) {
    return (
      actual.length === expected.length &&
      actual.every((item, index) => scalarEqual(item, expected[index]) === true)
    );
  }

  if (Array.isArray(actual) || Array.isArray(expected)) return null;

  return scalarEqual(actual, expected);
}

function compare(actual: unknown, expected: unknown): number | null {
  const integers = compareIntegers(actual, expected);
  if (integers !== null) return integers;

  const numbers = toNumberPair(actual, expected);
  if (numbers) return numbers[0] - numbers[1];

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

// Tri-state like scalarEqual: null = the candidate could not be compared to any member, so a
// negated membership test cannot claim "not a member" about a comparison it never managed to make.
// An empty list compares nothing and mismatches nothing, so it stays a plain false.
function memberOf(list: unknown, candidate: unknown): boolean | null {
  if (!Array.isArray(list)) return null;

  const results = list.map(item => scalarEqual(item, candidate));
  if (results.includes(true)) return true;

  return results.includes(null) ? null : false;
}

function ordering(satisfies: (diff: number) => boolean) {
  return (actual: unknown, expected: unknown): boolean => {
    const diff = compare(actual, expected);

    return diff !== null && satisfies(diff);
  };
}

const EVALUATORS: Record<
  Exclude<ConditionOperator, 'present' | 'blank'>,
  (actual: unknown, expected: unknown) => boolean
> = {
  equal: (actual, expected) => isEqual(actual, expected) === true,
  not_equal: (actual, expected) => isEqual(actual, expected) === false,
  greater_than: ordering(diff => diff > 0),
  less_than: ordering(diff => diff < 0),
  greater_than_or_equal: ordering(diff => diff >= 0),
  less_than_or_equal: ordering(diff => diff <= 0),
  in: (actual, expected) => memberOf(expected, actual) === true,
  not_in: (actual, expected) => memberOf(expected, actual) === false,
  contains: (actual, expected) =>
    typeof actual === 'string' && typeof expected === 'string' && actual.includes(expected),
  not_contains: (actual, expected) =>
    typeof actual === 'string' && typeof expected === 'string' && !actual.includes(expected),
};

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

  return EVALUATORS[operator](actual, expected);
}
