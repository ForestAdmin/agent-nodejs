import { DateTime, DateTimeUnit } from 'luxon';

import * as factories from '../__factories__';
import { Operator } from '../../src/interfaces/query/condition-tree/nodes/operators';
import ConditionTreeLeaf from '../../src/interfaces/query/condition-tree/nodes/leaf';
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
          id: factories.columnSchema.numericPrimaryKey().build(),
          reviews: factories.manyToManySchema.build({
            foreignCollection: 'reviews',
            originKey: 'bookId',
            originKeyTarget: 'id',
            foreignKey: 'reviewId',
            foreignKeyTarget: 'id',
            throughCollection: 'bookReview',
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
          id: factories.columnSchema.numericPrimaryKey().build(),
        },
      },
    }),
    factories.collection.build({
      name: 'bookReview',
      schema: {
        fields: {
          bookId: factories.columnSchema.numericPrimaryKey().build(),
          reviewId: factories.columnSchema.numericPrimaryKey().build(),
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
            operator: 'Like',
            field: 'someField',
            value: 'someValue',
          }),
        });
        expect(FilterFactory.getPreviousPeriodFilter(filter, 'Europe/Paris')).toStrictEqual(filter);
      });
    });

    describe('when interval operator is present in the condition tree', () => {
      it.each([
        ['Today', 'Yesterday'],
        ['PreviousWeekToDate', 'PreviousWeek'],
        ['PreviousMonthToDate', 'PreviousMonth'],
        ['PreviousQuarterToDate', 'PreviousQuarter'],
        ['PreviousYearToDate', 'PreviousYear'],
      ])('should override %s operator by the %s operator', (baseOperator, previousOperator) => {
        const filter = factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build({
            operator: baseOperator as Operator,
            field: 'someField',
            value: null,
          }),
        });

        expect(
          FilterFactory.getPreviousPeriodFilter(filter, 'Europe/Paris').conditionTree,
        ).toMatchObject({
          operator: previousOperator,
        });
      });

      it.each([
        ['Yesterday', 'day'],
        ['PreviousWeek', 'week'],
        ['PreviousMonth', 'month'],
        ['PreviousQuarter', 'quarter'],
        ['PreviousYear', 'year'],
      ])('should replace %s operator by a greater/less than operator', (baseOperator, duration) => {
        const time = DateTime.fromISO(TEST_DATE);
        DateTime.now = jest.fn(() => time);

        const newDate = time.setZone(TEST_TIMEZONE).minus({ [duration]: 2 });

        const filter = factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build({
            operator: baseOperator as Operator,
            field: 'someField',
            value: null,
          }),
        });

        expect(
          FilterFactory.getPreviousPeriodFilter(filter, TEST_TIMEZONE).conditionTree,
        ).toMatchObject({
          aggregator: 'And',
          conditions: [
            {
              operator: 'GreaterThan',
              value: newDate.startOf(duration as DateTimeUnit).toISO(),
            },
            {
              operator: 'LessThan',
              value: newDate.endOf(duration as DateTimeUnit).toISO(),
            },
          ],
        });

        jest.clearAllMocks();
      });

      it(`should replace ${'PreviousXDays'} operator by a greater/less than`, () => {
        const time = DateTime.fromISO(TEST_DATE);
        DateTime.now = jest.fn(() => time);

        const filter = factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build({
            operator: 'PreviousXDays',
            field: 'someField',
            value: 3,
          }),
        });

        const newDate = time.setZone(TEST_TIMEZONE);

        expect(
          FilterFactory.getPreviousPeriodFilter(filter, TEST_TIMEZONE).conditionTree,
        ).toMatchObject({
          aggregator: 'And',
          conditions: [
            {
              operator: 'GreaterThan',
              value: newDate.minus({ days: 6 }).startOf('day').toISO(),
            },
            {
              operator: 'LessThan',
              value: newDate.minus({ days: 3 }).startOf('day').toISO(),
            },
          ],
        });

        jest.clearAllMocks();
      });

      it(`should replace ${'PreviousXDaysToDate'} operator by a greater/less than`, () => {
        const time = DateTime.fromISO(TEST_DATE);
        DateTime.now = jest.fn(() => time);

        const filter = factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build({
            operator: 'PreviousXDaysToDate',
            field: 'someField',
            value: 3,
          }),
        });

        const newDate = time.setZone(TEST_TIMEZONE);

        expect(
          FilterFactory.getPreviousPeriodFilter(filter, TEST_TIMEZONE).conditionTree,
        ).toMatchObject({
          aggregator: 'And',
          conditions: [
            {
              operator: 'GreaterThan',
              value: newDate.minus({ days: 6 }).startOf('day').toISO(),
            },
            {
              operator: 'LessThan',
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
        conditionTree: new ConditionTreeLeaf('someField', 'Equal', 1),
      });
      const filter = await FilterFactory.makeThroughFilter(
        books,
        [1],
        'reviews',
        factories.caller.build(),
        baseFilter,
      );

      expect(filter).toEqual({
        conditionTree: {
          aggregator: 'And',
          conditions: [
            { field: 'bookId', operator: 'Equal', value: 1 },
            { field: 'reviewId', operator: 'Present' },
            { field: 'review:someField', operator: 'Equal', value: 1 },
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
        conditionTree: new ConditionTreeLeaf('someField', 'Equal', 1),
        segment: 'someSegment',
      });

      const filter = await FilterFactory.makeThroughFilter(
        books,
        [1],
        'reviews',
        factories.caller.build(),
        baseFilter,
      );

      expect(filter).toEqual({
        conditionTree: {
          aggregator: 'And',
          conditions: [
            { field: 'bookId', operator: 'Equal', value: 1 },
            { field: 'reviewId', operator: 'In', value: [123] },
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
        conditionTree: new ConditionTreeLeaf('someField', 'Equal', 1),
        segment: 'some-segment',
      });
      const filter = await FilterFactory.makeForeignFilter(
        books,
        [1],
        'bookReviews',
        factories.caller.build(),
        baseFilter,
      );

      expect(filter).toEqual({
        conditionTree: {
          aggregator: 'And',
          conditions: [
            { field: 'someField', operator: 'Equal', value: 1 },
            { field: 'bookId', operator: 'Equal', value: 1 },
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
        conditionTree: new ConditionTreeLeaf('someField', 'Equal', 1),
        segment: 'some-segment',
      });
      const filter = await FilterFactory.makeForeignFilter(
        books,
        [1],
        'reviews',
        factories.caller.build(),
        baseFilter,
      );

      expect(filter).toEqual({
        conditionTree: {
          aggregator: 'And',
          conditions: [
            { field: 'someField', operator: 'Equal', value: 1 },
            { field: 'id', operator: 'In', value: [123, 124] },
          ],
        },
        segment: 'some-segment',
      });
    });
  });
});
