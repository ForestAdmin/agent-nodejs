import { DateTime, DateTimeUnit } from 'luxon';

import * as factories from '../__factories__';
import { Aggregator } from '../../src/interfaces/query/condition-tree/nodes/branch';
import { PrimitiveTypes } from '../../src/interfaces/schema';
import ConditionTreeLeaf, { Operator } from '../../src/interfaces/query/condition-tree/nodes/leaf';
import Filter from '../../src/interfaces/query/filter/unpaginated';
import FilterFactory from '../../src/interfaces/query/filter/factory';

const TEST_TIMEZONE = 'Europe/Dublin';
const TEST_DATE = '2022-02-16T10:00:00.000Z';

function setup() {
  return factories.dataSource.buildWithCollections([
    factories.collection.build({
      name: 'books',
      schema: {
        fields: {
          id: factories.columnSchema.build({
            isPrimaryKey: true,
            columnType: PrimitiveTypes.Number,
          }),
          reviews: factories.manyToManySchema.build({
            foreignCollection: 'reviews',
            originKey: 'bookId',
            originKeyTarget: 'id',
            foreignKey: 'reviewId',
            foreignKeyTarget: 'id',
            throughCollection: 'bookReview',
            foreignRelation: 'review',
          }),
          bookReviews: factories.oneToManySchema.build({
            foreignCollection: 'reviews',
            originKey: 'bookId',
            originKeyTarget: 'id',
          }),
        },
      },
    }),
    factories.collection.build({
      name: 'reviews',
      schema: {
        fields: {
          id: factories.columnSchema.build({
            isPrimaryKey: true,
            columnType: PrimitiveTypes.Number,
          }),
        },
      },
    }),
    factories.collection.build({
      name: 'bookReview',
      schema: {
        fields: {
          bookId: factories.columnSchema.build({
            isPrimaryKey: true,
            columnType: PrimitiveTypes.Number,
          }),
          reviewId: factories.columnSchema.build({
            isPrimaryKey: true,
            columnType: PrimitiveTypes.Number,
          }),
          review: factories.manyToOneSchema.build({
            foreignCollection: 'reviews',
            foreignKey: 'reviewId',
            foreignKeyTarget: 'id',
          }),
        },
      },
    }),
  ]);
}

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

  describe('makeThroughFilter', () => {
    test('should nest the provided filter [many to many]', async () => {
      const dataSource = setup();
      const [books] = dataSource.collections;
      const baseFilter = new Filter({
        conditionTree: new ConditionTreeLeaf('someField', Operator.Equal, 1),
      });
      const filter = await FilterFactory.makeThroughFilter(books, [1], 'reviews', baseFilter);

      expect(filter).toEqual({
        conditionTree: {
          aggregator: 'and',
          conditions: [
            { field: 'bookId', operator: 'equal', value: 1 },
            { field: 'review:someField', operator: 'equal', value: 1 },
          ],
        },
      });
    });

    test('should make two queries [many to many]', async () => {
      const dataSource = setup();
      const [books, reviews, bookReviews] = dataSource.collections;
      // first query to list the linked records
      (bookReviews.list as jest.Mock).mockResolvedValue([{ id: 123 }, { id: 124 }]);

      // second query to restrict the segment
      (reviews.list as jest.Mock).mockResolvedValue([{ id: 123 }]);

      const baseFilter = new Filter({
        conditionTree: new ConditionTreeLeaf('someField', Operator.Equal, 1),
        segment: 'someSegment',
      });

      const filter = await FilterFactory.makeThroughFilter(books, [1], 'reviews', baseFilter);

      expect(filter).toEqual({
        conditionTree: {
          aggregator: 'and',
          conditions: [
            { field: 'bookId', operator: 'equal', value: 1 },
            { field: 'reviewId', operator: 'in', value: [123] },
          ],
        },
      });
    });
  });

  describe('makeForeignFilter', () => {
    test('should add the fk condition [one to many]', async () => {
      const dataSource = setup();
      const [books] = dataSource.collections;
      const baseFilter = new Filter({
        conditionTree: new ConditionTreeLeaf('someField', Operator.Equal, 1),
        segment: 'some-segment',
      });
      const filter = await FilterFactory.makeForeignFilter(books, [1], 'bookReviews', baseFilter);

      expect(filter).toEqual({
        conditionTree: {
          aggregator: 'and',
          conditions: [
            { field: 'someField', operator: 'equal', value: 1 },
            { field: 'bookId', operator: 'equal', value: 1 },
          ],
        },
        segment: 'some-segment',
      });
    });

    test('should query the through collection [many to many]', async () => {
      const dataSource = setup();
      const [books, , bookReviews] = dataSource.collections;
      (bookReviews.list as jest.Mock).mockResolvedValue([{ reviewId: 123 }, { reviewId: 124 }]);

      const baseFilter = new Filter({
        conditionTree: new ConditionTreeLeaf('someField', Operator.Equal, 1),
        segment: 'some-segment',
      });
      const filter = await FilterFactory.makeForeignFilter(books, [1], 'reviews', baseFilter);

      expect(filter).toEqual({
        conditionTree: {
          aggregator: 'and',
          conditions: [
            { field: 'someField', operator: 'equal', value: 1 },
            { field: 'id', operator: 'in', value: [123, 124] },
          ],
        },
        segment: 'some-segment',
      });
    });
  });
});
