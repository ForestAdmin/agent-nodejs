import { DateTime, DateTimeUnit } from 'luxon';
import { Operator } from '../../../interfaces/query/selection';
import { PrimitiveTypes } from '../../../interfaces/schema';
import ConditionTreeUtils from '../../../utils/condition-tree';
import { Alternative } from '../types';

type DateCallback = (now: DateTime, value: unknown) => DateTime;

function format(value: DateTime): string {
  return value.toUTC().toISO({ suppressMilliseconds: true });
}

function compare(operator: Operator, dateFn: DateCallback): Alternative {
  return {
    dependsOn: [operator],
    forTypes: [PrimitiveTypes.Date, PrimitiveTypes.Dateonly],
    replacer: ({ field, value }, tz) => {
      const now = DateTime.utc().setZone(tz);

      return { field, operator, value: format(dateFn(now, value)) };
    },
  };
}

function interval(startFn: DateCallback, endFn: DateCallback): Alternative {
  return {
    dependsOn: [Operator.LessThan, Operator.GreaterThan],
    forTypes: [PrimitiveTypes.Date, PrimitiveTypes.Dateonly],
    replacer: ({ field, value }, tz) => {
      const now = DateTime.utc().setZone(tz);

      return ConditionTreeUtils.intersect(
        { field, operator: Operator.GreaterThan, value: format(startFn(now, value)) },
        { field, operator: Operator.LessThan, value: format(endFn(now, value)) },
      );
    },
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

const alternatives: Partial<Record<Operator, Alternative[]>> = {
  [Operator.Before]: [compare(Operator.LessThan, (_, value) => DateTime.fromISO(value as string))],
  [Operator.After]: [
    compare(Operator.GreaterThan, (_, value) => DateTime.fromISO(value as string)),
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

  [Operator.Yesterday]: [previousInterval('day')],
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
};

export default alternatives;
