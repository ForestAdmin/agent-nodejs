/* eslint-disable @typescript-eslint/no-non-null-assertion */
import ConditionTreeLeaf from '../../../src/interfaces/query/condition-tree/nodes/leaf';
import makeAlternatives from '../../../src/interfaces/query/condition-tree/transforms/time';

describe('ConditionTreeOperators > Time', () => {
  const alternatives = makeAlternatives();

  beforeAll(() => {
    // https://static.wikia.nocookie.net/bttf/images/d/d5/Time_Circuits_BTTF.png
    const date = new Date('1985-10-26T01:22:00-08:00');
    jest.useFakeTimers().setSystemTime(date);
  });

  describe('Before', () => {
    test('should rewrite', () => {
      expect(
        alternatives.Before![0].replacer(
          new ConditionTreeLeaf('column', 'Before', '2010-01-01T00:00:00Z'),
          'America/Los_Angeles',
        ),
      ).toEqual({
        field: 'column',
        operator: 'LessThan',
        value: '2010-01-01T00:00:00Z',
      });
    });
  });

  describe('After', () => {
    test('should rewrite', () => {
      expect(
        alternatives.After![0].replacer(
          new ConditionTreeLeaf('column', 'After', '2010-01-01T00:00:00Z'),
          'America/Los_Angeles',
        ),
      ).toEqual({
        field: 'column',
        operator: 'GreaterThan',
        value: '2010-01-01T00:00:00Z',
      });
    });
  });

  describe('Past', () => {
    test('should rewrite', () => {
      expect(
        alternatives.Past![0].replacer(
          new ConditionTreeLeaf('column', 'Past'),
          'America/Los_Angeles',
        ),
      ).toEqual({
        field: 'column',
        operator: 'LessThan',
        value: '1985-10-26T09:22:00Z',
      });
    });
  });

  describe('Future', () => {
    test('should rewrite', () => {
      expect(
        alternatives.Future![0].replacer(
          new ConditionTreeLeaf('column', 'Future'),
          'America/Los_Angeles',
        ),
      ).toEqual({
        field: 'column',
        operator: 'GreaterThan',
        value: '1985-10-26T09:22:00Z',
      });
    });
  });

  describe('BeforeXHoursAgo', () => {
    test('should rewrite', () => {
      expect(
        alternatives.BeforeXHoursAgo![0].replacer(
          new ConditionTreeLeaf('column', 'BeforeXHoursAgo', 24),
          'America/Los_Angeles',
        ),
      ).toEqual({
        field: 'column',
        operator: 'LessThan',
        value: '1985-10-25T09:22:00Z',
      });
    });
  });

  describe('AfterXHoursAgo', () => {
    test('should rewrite', () => {
      expect(
        alternatives.AfterXHoursAgo![0].replacer(
          new ConditionTreeLeaf('column', 'AfterXHoursAgo', 24),
          'America/Los_Angeles',
        ),
      ).toEqual({
        field: 'column',
        operator: 'GreaterThan',
        value: '1985-10-25T09:22:00Z',
      });
    });
  });

  describe('PreviousMonthToDate', () => {
    test('should rewrite', () => {
      expect(
        alternatives.PreviousMonthToDate![0].replacer(
          new ConditionTreeLeaf('column', 'PreviousMonthToDate'),
          'America/Los_Angeles',
        ),
      ).toEqual({
        aggregator: 'And',
        conditions: [
          { field: 'column', operator: 'GreaterThan', value: '1985-10-01T07:00:00Z' },
          { field: 'column', operator: 'LessThan', value: '1985-10-26T09:22:00Z' },
        ],
      });
    });
  });

  describe('PreviousMonth', () => {
    test('should rewrite', () => {
      expect(
        alternatives.PreviousMonth![0].replacer(
          new ConditionTreeLeaf('column', 'PreviousMonth'),
          'America/Los_Angeles',
        ),
      ).toEqual({
        aggregator: 'And',
        conditions: [
          { field: 'column', operator: 'GreaterThan', value: '1985-09-01T07:00:00Z' },
          { field: 'column', operator: 'LessThan', value: '1985-10-01T07:00:00Z' },
        ],
      });
    });
  });

  describe('PreviousQuarterToDate', () => {
    test('should rewrite', () => {
      expect(
        alternatives.PreviousQuarterToDate![0].replacer(
          new ConditionTreeLeaf('column', 'PreviousQuarterToDate'),
          'America/Los_Angeles',
        ),
      ).toEqual({
        aggregator: 'And',
        conditions: [
          { field: 'column', operator: 'GreaterThan', value: '1985-10-01T07:00:00Z' },
          { field: 'column', operator: 'LessThan', value: '1985-10-26T09:22:00Z' },
        ],
      });
    });
  });

  describe('PreviousQuarter', () => {
    test('should rewrite', () => {
      expect(
        alternatives.PreviousQuarter![0].replacer(
          new ConditionTreeLeaf('column', 'PreviousQuarter'),
          'America/Los_Angeles',
        ),
      ).toEqual({
        aggregator: 'And',
        conditions: [
          { field: 'column', operator: 'GreaterThan', value: '1985-07-01T07:00:00Z' },
          { field: 'column', operator: 'LessThan', value: '1985-10-01T07:00:00Z' },
        ],
      });
    });
  });

  describe('PreviousWeekToDate', () => {
    test('should rewrite', () => {
      expect(
        alternatives.PreviousWeekToDate![0].replacer(
          new ConditionTreeLeaf('column', 'PreviousWeekToDate'),
          'America/Los_Angeles',
        ),
      ).toEqual({
        aggregator: 'And',
        conditions: [
          { field: 'column', operator: 'GreaterThan', value: '1985-10-21T07:00:00Z' },
          { field: 'column', operator: 'LessThan', value: '1985-10-26T09:22:00Z' },
        ],
      });
    });
  });

  describe('PreviousWeek', () => {
    test('should rewrite', () => {
      // Note that luxon always consider weeks to be from monday to friday
      // @see https://github.com/moment/luxon/issues/373#issuecomment-441123720

      expect(
        alternatives.PreviousWeek![0].replacer(
          new ConditionTreeLeaf('column', 'PreviousWeek'),
          'America/Los_Angeles',
        ),
      ).toEqual({
        aggregator: 'And',
        conditions: [
          { field: 'column', operator: 'GreaterThan', value: '1985-10-14T07:00:00Z' },
          { field: 'column', operator: 'LessThan', value: '1985-10-21T07:00:00Z' },
        ],
      });
    });
  });

  describe('PreviousXDaysToDate', () => {
    test('should rewrite', () => {
      expect(
        alternatives.PreviousXDaysToDate![0].replacer(
          new ConditionTreeLeaf('column', 'PreviousXDaysToDate', 14),
          'America/Los_Angeles',
        ),
      ).toEqual({
        aggregator: 'And',
        conditions: [
          { field: 'column', operator: 'GreaterThan', value: '1985-10-12T07:00:00Z' },
          { field: 'column', operator: 'LessThan', value: '1985-10-26T09:22:00Z' },
        ],
      });
    });
  });

  describe('PreviousXDays', () => {
    test('should rewrite', () => {
      expect(
        alternatives.PreviousXDays![0].replacer(
          new ConditionTreeLeaf('column', 'PreviousXDays', 14),
          'America/Los_Angeles',
        ),
      ).toEqual({
        aggregator: 'And',
        conditions: [
          { field: 'column', operator: 'GreaterThan', value: '1985-10-12T07:00:00Z' },
          { field: 'column', operator: 'LessThan', value: '1985-10-26T07:00:00Z' },
        ],
      });
    });
  });

  describe('PreviousYearToDate', () => {
    test('should rewrite', () => {
      expect(
        alternatives.PreviousYearToDate![0].replacer(
          new ConditionTreeLeaf('column', 'PreviousYearToDate'),
          'America/Los_Angeles',
        ),
      ).toEqual({
        aggregator: 'And',
        conditions: [
          { field: 'column', operator: 'GreaterThan', value: '1985-01-01T08:00:00Z' },
          { field: 'column', operator: 'LessThan', value: '1985-10-26T09:22:00Z' },
        ],
      });
    });
  });

  describe('PreviousYear', () => {
    test('should rewrite', () => {
      // Notice daylight saving time in this test, as it's january

      expect(
        alternatives.PreviousYear![0].replacer(
          new ConditionTreeLeaf('column', 'PreviousYear'),
          'America/Los_Angeles',
        ),
      ).toEqual({
        aggregator: 'And',
        conditions: [
          { field: 'column', operator: 'GreaterThan', value: '1984-01-01T08:00:00Z' },
          { field: 'column', operator: 'LessThan', value: '1985-01-01T08:00:00Z' },
        ],
      });
    });
  });

  describe('Today', () => {
    test('should rewrite', () => {
      expect(
        alternatives.Today![0].replacer(
          new ConditionTreeLeaf('column', 'Today'),
          'America/Los_Angeles',
        ),
      ).toEqual({
        aggregator: 'And',
        conditions: [
          { field: 'column', operator: 'GreaterThan', value: '1985-10-26T07:00:00Z' },
          { field: 'column', operator: 'LessThan', value: '1985-10-27T07:00:00Z' },
        ],
      });
    });
  });

  describe('Yesterday', () => {
    test('should rewrite', () => {
      expect(
        alternatives.Yesterday![0].replacer(
          new ConditionTreeLeaf('column', 'Yesterday'),
          'America/Los_Angeles',
        ),
      ).toEqual({
        aggregator: 'And',
        conditions: [
          { field: 'column', operator: 'GreaterThan', value: '1985-10-25T07:00:00Z' },
          { field: 'column', operator: 'LessThan', value: '1985-10-26T07:00:00Z' },
        ],
      });
    });
  });
});
