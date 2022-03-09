import { DateTime, DateTimeUnit } from 'luxon';

import ConditionTree from '../condition-tree/nodes/base';
import ConditionTreeFactory from '../condition-tree/factory';
import ConditionTreeLeaf, { Operator } from '../condition-tree/nodes/leaf';
import Filter from './unpaginated';

export default class FilterFactory {
  private static getPreviousConditionTree(
    field: string,
    startPeriod: DateTime,
    endPeriod: DateTime,
  ): ConditionTree {
    return ConditionTreeFactory.intersect(
      new ConditionTreeLeaf(field, Operator.GreaterThan, startPeriod.toISO()),
      new ConditionTreeLeaf(field, Operator.LessThan, endPeriod.toISO()),
    );
  }

  private static getPreviousPeriodByUnit(
    field: string,
    now: DateTime,
    interval: string,
  ): ConditionTree {
    const dayBeforeYesterday = now.minus({ [interval]: 2 });

    return this.getPreviousConditionTree(
      field,
      dayBeforeYesterday.startOf(interval as DateTimeUnit),
      dayBeforeYesterday.endOf(interval as DateTimeUnit),
    );
  }

  static getPreviousPeriodFilter(filter: Filter): Filter {
    const now = DateTime.now().setZone(filter.timezone);

    return filter.override({
      conditionTree: filter.conditionTree.replaceLeafs(leaf => {
        switch (leaf.operator) {
          case Operator.Today:
            return leaf.override({ operator: Operator.Yesterday });
          case Operator.Yesterday:
            return this.getPreviousPeriodByUnit(leaf.field, now, 'day');
          case Operator.PreviousWeek:
            return this.getPreviousPeriodByUnit(leaf.field, now, 'week');
          case Operator.PreviousMonth:
            return this.getPreviousPeriodByUnit(leaf.field, now, 'month');
          case Operator.PreviousQuarter:
            return this.getPreviousPeriodByUnit(leaf.field, now, 'quarter');
          case Operator.PreviousYear:
            return this.getPreviousPeriodByUnit(leaf.field, now, 'year');

          case Operator.PreviousXDays: {
            const startPeriodXDays = now.minus({ days: 2 * Number(leaf.value) });
            const endPeriodXDays = now.minus({ days: Number(leaf.value) });

            return this.getPreviousConditionTree(
              leaf.field,
              startPeriodXDays.startOf('day'),
              endPeriodXDays.startOf('day'),
            );
          }

          case Operator.PreviousXDaysToDate: {
            const startPeriod = now.minus({ days: 2 * Number(leaf.value) });
            const endPeriod = now.minus({ days: Number(leaf.value) });

            return this.getPreviousConditionTree(leaf.field, startPeriod.startOf('day'), endPeriod);
          }

          case Operator.PreviousMonthToDate:
            return leaf.override({ operator: Operator.PreviousMonth });
          case Operator.PreviousQuarterToDate:
            return leaf.override({ operator: Operator.PreviousQuarter });
          case Operator.PreviousYearToDate:
            return leaf.override({ operator: Operator.PreviousYear });
          default:
            return leaf;
        }
      }),
    });
  }
}
