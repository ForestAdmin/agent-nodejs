import { DateTime, DateTimeUnit } from 'luxon';

import * as factories from '../__factories__';
import { Aggregator } from '../../src/interfaces/query/condition-tree/nodes/branch';
import { Operator } from '../../src/interfaces/query/condition-tree/nodes/leaf';
import FilterFactory from '../../src/interfaces/query/filter/factory';

const TEST_TIMEZONE = 'Europe/Dublin';
const TEST_DATE = '2022-02-16T10:00:00.000Z';

describe('FilterFactory', () => {
  describe('getPreviousPeriodFilter', () => {
    describe('when no interval operator is present in the condition tree', () => {
      it('should not modify the condition tree', () => {
        const filter = factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build({
            operator: Operator.Like,
            field: 'someField',
            value: 'someValue',
          }),
        });
        expect(FilterFactory.getPreviousPeriodFilter(filter)).toStrictEqual(filter);
      });
    });

    describe('when interval operator is present in the condition tree', () => {
      it.each([
        [Operator.Today, Operator.Yesterday],
        [Operator.PreviousMonthToDate, Operator.PreviousMonth],
        [Operator.PreviousQuarterToDate, Operator.PreviousQuarter],
        [Operator.PreviousYearToDate, Operator.PreviousYear],
      ])('should override %s operator by the %s operator', (baseOperator, previousOperator) => {
        const filter = factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build({
            operator: baseOperator,
            field: 'someField',
            value: null,
          }),
        });

        expect(FilterFactory.getPreviousPeriodFilter(filter).conditionTree).toMatchObject({
          operator: previousOperator,
        });
      });

      it.each([
        [Operator.Yesterday, 'day'],
        [Operator.PreviousWeek, 'week'],
        [Operator.PreviousMonth, 'month'],
        [Operator.PreviousQuarter, 'quarter'],
        [Operator.PreviousYear, 'year'],
      ])('should replace %s operator by a greater/less than operator', (baseOperator, duration) => {
        const time = DateTime.fromISO(TEST_DATE);
        DateTime.now = jest.fn(() => time);

        const newDate = time.setZone(TEST_TIMEZONE).minus({ [duration]: 2 });

        const filter = factories.filter.build({
          timezone: TEST_TIMEZONE,
          conditionTree: factories.conditionTreeLeaf.build({
            operator: baseOperator,
            field: 'someField',
            value: null,
          }),
        });

        expect(FilterFactory.getPreviousPeriodFilter(filter).conditionTree).toMatchObject({
          aggregator: Aggregator.And,
          conditions: [
            {
              operator: Operator.GreaterThan,
              value: newDate.startOf(duration as DateTimeUnit).toISO(),
            },
            {
              operator: Operator.LessThan,
              value: newDate.endOf(duration as DateTimeUnit).toISO(),
            },
          ],
        });

        jest.clearAllMocks();
      });

      it(`should replace ${Operator.PreviousXDays} operator by a greater/less than`, () => {
        const time = DateTime.fromISO(TEST_DATE);
        DateTime.now = jest.fn(() => time);

        const filter = factories.filter.build({
          timezone: TEST_TIMEZONE,
          conditionTree: factories.conditionTreeLeaf.build({
            operator: Operator.PreviousXDays,
            field: 'someField',
            value: 3,
          }),
        });

        const newDate = time.setZone(TEST_TIMEZONE);

        expect(FilterFactory.getPreviousPeriodFilter(filter).conditionTree).toMatchObject({
          aggregator: Aggregator.And,
          conditions: [
            {
              operator: Operator.GreaterThan,
              value: newDate.minus({ days: 6 }).startOf('day').toISO(),
            },
            {
              operator: Operator.LessThan,
              value: newDate.minus({ days: 3 }).startOf('day').toISO(),
            },
          ],
        });

        jest.clearAllMocks();
      });

      it(`should replace ${Operator.PreviousXDaysToDate} operator by a greater/less than`, () => {
        const time = DateTime.fromISO(TEST_DATE);
        DateTime.now = jest.fn(() => time);

        const filter = factories.filter.build({
          timezone: TEST_TIMEZONE,
          conditionTree: factories.conditionTreeLeaf.build({
            operator: Operator.PreviousXDaysToDate,
            field: 'someField',
            value: 3,
          }),
        });

        const newDate = time.setZone(TEST_TIMEZONE);

        expect(FilterFactory.getPreviousPeriodFilter(filter).conditionTree).toMatchObject({
          aggregator: Aggregator.And,
          conditions: [
            {
              operator: Operator.GreaterThan,
              value: newDate.minus({ days: 6 }).startOf('day').toISO(),
            },
            {
              operator: Operator.LessThan,
              value: newDate.minus({ days: 3 }).toISO(),
            },
          ],
        });

        jest.clearAllMocks();
      });
    });
  });
});
