import type { ConditionOperator } from '../types/validated/step-definition';

import { DateTime } from 'luxon';

// Injected rather than read here so the evaluator stays a pure function of its inputs.
export interface Clock {
  now: Date;
  timezone: string;
}

// Guard against Date.parse's laxity ("5" parses as a year in some engines): only strings that
// start like an ISO date are treated as dates.
const ISO_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
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
  // the same run differently per machine — pin every offset-less datetime to UTC. Postgres emits
  // the SQL form ("2026-09-04 08:00:00+02"): space separator, bare-hour offset that Date.parse
  // only accepts as hh:mm once the separator is a T.
  const datetime = value
    .trim()
    .replace(/\s+/, 'T')
    .replace(/\s+/g, '')
    .replace(/(:\d{2}(?:\.\d+)?)([+-]\d{2})$/, '$1$2:00');
  const absolute =
    datetime.includes('T') && !TIMEZONE_SUFFIX.test(datetime) ? `${datetime}Z` : datetime;
  const parsed = Date.parse(absolute);

  return Number.isNaN(parsed) ? null : parsed;
}

// A calendar date has no instant of its own, so it is read at midnight in the project's zone: that
// is what makes "today" the project's today for a Dateonly column, whatever the machine's or UTC's
// day is at that moment. A datetime is an absolute instant already (the UTC pinning above).
function toInstant(value: unknown, timezone: string): DateTime | null {
  if (typeof value !== 'string' || !isRealCalendarDate(value.slice(0, 10))) return null;
  if (DATE_ONLY.test(value)) return DateTime.fromISO(value, { zone: timezone });

  const timestamp = toTimestamp(value);

  return timestamp === null ? null : DateTime.fromMillis(timestamp, { zone: timezone });
}

// The toolkit compares a Dateonly column against the bound's calendar date (its time transforms
// format the bound with toISODate for that column type), so a bound falling mid-day is read at the
// start of its day when the value is a calendar date: "past" on a Dateonly excludes today, as the
// list filter does. The kind is told from the value's shape where the toolkit reads the column
// type, so parity holds as long as a Dateonly serialises as a bare YYYY-MM-DD.
function alignToValueKind(actual: unknown, bound: DateTime): DateTime {
  return DATE_ONLY.test(actual as string) ? bound.startOf('day') : bound;
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

function isMemberOf(list: unknown, candidate: unknown): boolean {
  return Array.isArray(list) && list.some(item => scalarEqual(item, candidate) === true);
}

function includesAll(actual: unknown, expected: unknown): boolean {
  if (!Array.isArray(actual)) return false;
  const wanted = Array.isArray(expected) ? expected : [expected];

  return wanted.length > 0 && wanted.every(item => isMemberOf(actual, item));
}

function stringTest(satisfies: (actual: string, expected: string) => boolean) {
  return (actual: unknown, expected: unknown): boolean =>
    typeof actual === 'string' && typeof expected === 'string' && satisfies(actual, expected);
}

function ordering(satisfies: (diff: number) => boolean) {
  return (actual: unknown, expected: unknown): boolean => {
    const diff = compare(actual, expected);

    return diff !== null && satisfies(diff);
  };
}

// The builder pins a datetime for a Date column and a calendar date for a Dateonly one, so both
// sides share a kind and a calendar date is read in the project's zone on either side. The toolkit
// reads a bare date in the server's zone here; the project's is the deliberate choice.
function dateOrdering(satisfies: (actual: DateTime, expected: DateTime) => boolean) {
  return (actual: unknown, expected: unknown, clock: Clock): boolean => {
    const actualInstant = toInstant(actual, clock.timezone);
    const expectedInstant = toInstant(expected, clock.timezone);

    return (
      actualInstant !== null &&
      expectedInstant !== null &&
      satisfies(actualInstant, expectedInstant)
    );
  };
}

// Relative to the clock. The end of a window is always excluded; its start is included for a
// calendar date and excluded for a datetime. That asymmetry is datasource-toolkit's (its time
// transforms emit GreaterThanOrEqual for a Dateonly column, GreaterThan otherwise), and the list
// filter runs on it, so the same record answers "today" the same way in both places.
type Window = (now: DateTime, value: unknown) => [start: DateTime, end: DateTime] | null;

function days(value: unknown): number | null {
  const count = toNumber(value);

  return count !== null && Number.isInteger(count) && count > 0 ? count : null;
}

const WINDOWS: Record<
  'today' | 'yesterday' | 'previous_x_days' | 'previous_x_days_to_date',
  Window
> = {
  today: now => [now.startOf('day'), now.plus({ days: 1 }).startOf('day')],
  yesterday: now => [now.minus({ days: 1 }).startOf('day'), now.startOf('day')],
  previous_x_days: (now, value) => {
    const count = days(value);

    return count === null ? null : [now.minus({ days: count }).startOf('day'), now.startOf('day')];
  },
  previous_x_days_to_date: (now, value) => {
    const count = days(value);

    return count === null ? null : [now.minus({ days: count }).startOf('day'), now];
  },
};

function within(name: keyof typeof WINDOWS) {
  return (actual: unknown, expected: unknown, clock: Clock): boolean => {
    const instant = toInstant(actual, clock.timezone);
    if (instant === null) return false;

    const window = WINDOWS[name](DateTime.fromJSDate(clock.now).setZone(clock.timezone), expected);
    if (window === null) return false;

    const [start, end] = window.map(bound => alignToValueKind(actual, bound));
    const afterStart = DATE_ONLY.test(actual as string) ? instant >= start : instant > start;

    return afterStart && instant < end;
  };
}

function relativeTo(
  bound: (now: DateTime, value: unknown) => DateTime | null,
  satisfies: (actual: DateTime, bound: DateTime) => boolean,
) {
  return (actual: unknown, expected: unknown, clock: Clock): boolean => {
    const instant = toInstant(actual, clock.timezone);
    if (instant === null) return false;

    const reference = bound(DateTime.fromJSDate(clock.now).setZone(clock.timezone), expected);

    return reference !== null && satisfies(instant, alignToValueKind(actual, reference));
  };
}

function hoursAgo(now: DateTime, value: unknown): DateTime | null {
  const count = toNumber(value);

  return count !== null && count >= 0 ? now.minus({ hours: count }) : null;
}

const EVALUATORS: Record<
  Exclude<ConditionOperator, 'present' | 'blank'>,
  (actual: unknown, expected: unknown, clock: Clock) => boolean
> = {
  equal: (actual, expected) => isEqual(actual, expected) === true,
  not_equal: (actual, expected) => isEqual(actual, expected) === false,
  greater_than: ordering(diff => diff > 0),
  less_than: ordering(diff => diff < 0),
  in: (actual, expected) => isMemberOf(expected, actual),
  includes_all: includesAll,
  contains: stringTest((actual, expected) => actual.includes(expected)),
  not_contains: stringTest((actual, expected) => !actual.includes(expected)),
  starts_with: stringTest((actual, expected) => actual.startsWith(expected)),
  ends_with: stringTest((actual, expected) => actual.endsWith(expected)),
  // Case folded, accents kept: the Postgres ILIKE path of the list filter ('É' ILIKE '%é%' holds,
  // 'é' ILIKE '%e%' does not). MySQL and SQLite collations diverge; Postgres is the contract.
  i_contains: stringTest((actual, expected) =>
    actual.toLowerCase().includes(expected.toLowerCase()),
  ),
  before: dateOrdering((actual, expected) => actual < expected),
  after: dateOrdering((actual, expected) => actual > expected),
  past: relativeTo(
    now => now,
    (actual, bound) => actual < bound,
  ),
  future: relativeTo(
    now => now,
    (actual, bound) => actual > bound,
  ),
  before_x_hours_ago: relativeTo(hoursAgo, (actual, bound) => actual < bound),
  after_x_hours_ago: relativeTo(hoursAgo, (actual, bound) => actual > bound),
  today: within('today'),
  yesterday: within('yesterday'),
  previous_x_days: within('previous_x_days'),
  previous_x_days_to_date: within('previous_x_days_to_date'),
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
  clock: Clock,
): boolean | null {
  if (operator === 'present') return isPresent(actual);
  if (operator === 'blank') return !isPresent(actual);
  if (actual === null || actual === undefined) return null;

  return EVALUATORS[operator](actual, expected, clock);
}
