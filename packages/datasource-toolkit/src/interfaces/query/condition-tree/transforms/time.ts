import { DateTime, DateTimeUnit } from 'luxon';

import { Alternative } from '../equivalence';
import { Operator } from '../nodes/operators';
import ConditionTreeFactory from '../factory';

type DateCallback = (now: DateTime, value: unknown) => DateTime;

function format(value: DateTime): string {
  return value.toUTC().toISO({ suppressMilliseconds: true });
}

function compare(operator: Operator, dateFn: DateCallback): Alternative {
  return {
    dependsOn: [operator],
    forTypes: ['Date', 'Dateonly'],
    replacer: (leaf, tz) => {
      const now = DateTime.utc().setZone(tz);

      return leaf.override({ operator, value: format(dateFn(now, leaf.value)) });
    },
  };
}

function interval(startFn: DateCallback, endFn: DateCallback): Alternative {
  return {
    dependsOn: ['LessThan', 'GreaterThan'],
    forTypes: ['Date', 'Dateonly'],
    replacer: (leaf, tz) => {
      const now = DateTime.utc().setZone(tz);

      return ConditionTreeFactory.intersect(
        leaf.override({ operator: 'GreaterThan', value: format(startFn(now, leaf.value)) }),
        leaf.override({ operator: 'LessThan', value: format(endFn(now, leaf.value)) }),
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

export default (): Partial<Record<Operator, Alternative[]>> => ({
  Before: [compare('LessThan', (_, value) => DateTime.fromISO(value as string))],
  After: [compare('GreaterThan', (_, value) => DateTime.fromISO(value as string))],

  Past: [compare('LessThan', now => now)],
  Future: [compare('GreaterThan', now => now)],

  BeforeXHoursAgo: [compare('LessThan', (now, value) => now.minus({ hours: value as number }))],
  AfterXHoursAgo: [compare('GreaterThan', (now, value) => now.minus({ hours: value as number }))],

  PreviousWeekToDate: [previousIntervalToDate('week')],
  PreviousMonthToDate: [previousIntervalToDate('month')],
  PreviousQuarterToDate: [previousIntervalToDate('quarter')],
  PreviousYearToDate: [previousIntervalToDate('year')],

  Yesterday: [previousInterval('day')],
  PreviousWeek: [previousInterval('week')],
  PreviousMonth: [previousInterval('month')],
  PreviousQuarter: [previousInterval('quarter')],
  PreviousYear: [previousInterval('year')],

  PreviousXDaysToDate: [
    interval(
      (now, value) => now.minus({ days: value as number }).startOf('day'),
      now => now,
    ),
  ],
  PreviousXDays: [
    interval(
      (now, value) => now.minus({ days: value as number }).startOf('day'),
      now => now.startOf('day'),
    ),
  ],

  Today: [
    interval(
      now => now.startOf('day'),
      now => now.plus({ day: 1 }).startOf('day'),
    ),
  ],
});
