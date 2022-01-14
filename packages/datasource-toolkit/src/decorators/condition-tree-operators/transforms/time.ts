import { DateTime, DateTimeUnit } from 'luxon';
import { Operator } from '../../../interfaces/query/selection';
import { PrimitiveTypes } from '../../../interfaces/schema';
import ConditionTreeUtils from '../../../utils/condition-tree';
import { Alternative } from '../types';

type TimeOperator =
  | Operator.Before
  | Operator.After
  | Operator.Past
  | Operator.Future
  | Operator.BeforeXHoursAgo
  | Operator.AfterXHoursAgo
  | Operator.PreviousMonthToDate
  | Operator.PreviousMonth
  | Operator.PreviousQuarterToDate
  | Operator.PreviousQuarter
  | Operator.PreviousWeekToDate
  | Operator.PreviousWeek
  | Operator.PreviousXDaysToDate
  | Operator.PreviousXDays
  | Operator.PreviousYearToDate
  | Operator.PreviousYear
  | Operator.Today
  | Operator.Yesterday;

type DateCallback = (date: DateTime, value: unknown) => DateTime;

function format(value: unknown, tz: string, callback: DateCallback): string {
  const now = DateTime.utc().setZone(tz);

  return callback(now, value).toUTC().toISO({ suppressMilliseconds: true });
}

function compare(operator: Operator, dateFn: DateCallback): Alternative {
  return {
    dependsOn: [operator],
    forTypes: [PrimitiveTypes.Date, PrimitiveTypes.Dateonly],
    replacer: ({ field, value }, tz) => ({
      field,
      operator,
      value: format(value, tz, dateFn),
    }),
  };
}

function interval(startFn: DateCallback, endFn: DateCallback): Alternative {
  return {
    dependsOn: [Operator.LessThan, Operator.GreaterThan],
    forTypes: [PrimitiveTypes.Date, PrimitiveTypes.Dateonly],
    replacer: ({ field, value }, tz) =>
      ConditionTreeUtils.intersect(
        {
          field,
          operator: Operator.GreaterThan,
          value: format(value, tz, startFn),
        },
        {
          field,
          operator: Operator.LessThan,
          value: format(value, tz, endFn),
        },
      ),
  };
}

function previousInterval(duration: DateTimeUnit): Alternative {
  return interval(
    now => now.minus({ [duration]: 1 }).startOf(duration),
    now => now.startOf(duration),
  );
}

function previousIntervalToDate(duration: DateTimeUnit): Alternative {
  return interval(
    now => now.startOf(duration),
    now => now,
  );
}

const alternatives: Record<TimeOperator, Alternative[]> = {
  [Operator.Before]: [
    compare(Operator.LessThan, (now, value) => DateTime.fromISO(value as string).setZone(now.zone)),
  ],
  [Operator.After]: [
    compare(Operator.GreaterThan, (now, value) =>
      DateTime.fromISO(value as string).setZone(now.zone),
    ),
  ],

  [Operator.Past]: [compare(Operator.LessThan, now => now)],
  [Operator.Future]: [compare(Operator.GreaterThan, now => now)],

  [Operator.BeforeXHoursAgo]: [
    compare(Operator.LessThan, (now, value) => now.minus({ hours: value as number })),
  ],
  [Operator.AfterXHoursAgo]: [
    compare(Operator.GreaterThan, (now, value) => now.minus({ hours: value as number })),
  ],

  [Operator.PreviousWeekToDate]: [previousIntervalToDate('week')],
  [Operator.PreviousMonthToDate]: [previousIntervalToDate('month')],
  [Operator.PreviousQuarterToDate]: [previousIntervalToDate('quarter')],
  [Operator.PreviousYearToDate]: [previousIntervalToDate('year')],

  [Operator.PreviousWeek]: [previousInterval('week')],
  [Operator.PreviousMonth]: [previousInterval('month')],
  [Operator.PreviousQuarter]: [previousInterval('quarter')],
  [Operator.PreviousYear]: [previousInterval('year')],

  [Operator.PreviousXDaysToDate]: [
    interval(
      (now, value) => now.minus({ days: value as number }).startOf('day'),
      now => now,
    ),
  ],
  [Operator.PreviousXDays]: [
    interval(
      (now, value) => now.minus({ days: value as number }).startOf('day'),
      now => now.startOf('day'),
    ),
  ],

  [Operator.Today]: [
    interval(
      now => now.startOf('day'),
      now => now.plus({ day: 1 }).startOf('day'),
    ),
  ],
  [Operator.Yesterday]: [
    interval(
      now => now.minus({ day: 1 }).startOf('day'),
      now => now.startOf('day'),
    ),
  ],
};

export default alternatives;
