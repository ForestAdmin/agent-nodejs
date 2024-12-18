/* eslint-disable @typescript-eslint/no-non-null-assertion */
import ConditionTreeLeaf from '../../../src/interfaces/query/condition-tree/nodes/leaf';
import makeAlternatives from '../../../src/interfaces/query/condition-tree/transforms/time';

describe('ConditionTreeOperators > Time > DateOnly', () => {
  const alternatives = makeAlternatives();

  beforeAll(() => {
    // https://static.wikia.nocookie.net/bttf/images/d/d5/Time_Circuits_BTTF.png
    const date = new Date('2024-12-17T23:00:00-00:00');
    jest.useFakeTimers().setSystemTime(date);
  });

  describe('Before', () => {
    test('should rewrite', () => {
      expect(
        alternatives.Before![0].replacer(
          new ConditionTreeLeaf('column', 'Before', '2010-01-01'),
          'Europe/Paris',
          true,
        ),
      ).toEqual({
        field: 'column',
        operator: 'LessThan',
        value: '2010-01-01',
      });
    });
  });

  describe('After', () => {
    test('should rewrite', () => {
      expect(
        alternatives.After![0].replacer(
          new ConditionTreeLeaf('column', 'After', '2010-01-01'),
          'Europe/Paris',
          true,
        ),
      ).toEqual({
        field: 'column',
        operator: 'GreaterThan',
        value: '2010-01-01',
      });
    });
  });

  describe('Past', () => {
    test('should rewrite', () => {
      expect(
        alternatives.Past![0].replacer(
          new ConditionTreeLeaf('column', 'Past'),
          'Europe/Paris',
          true,
        ),
      ).toEqual({
        field: 'column',
        operator: 'LessThan',
        value: '2024-12-18',
      });
    });
  });

  describe('Future', () => {
    test('should rewrite', () => {
      expect(
        alternatives.Future![0].replacer(
          new ConditionTreeLeaf('column', 'Future'),
          'Europe/Paris',
          true,
        ),
      ).toEqual({
        field: 'column',
        operator: 'GreaterThan',
        value: '2024-12-18',
      });
    });
  });

  describe('PreviousMonthToDate', () => {
    test('should rewrite', () => {
      expect(
        alternatives.PreviousMonthToDate![0].replacer(
          new ConditionTreeLeaf('column', 'PreviousMonthToDate'),
          'Europe/Paris',
          true,
        ),
      ).toEqual({
        aggregator: 'And',
        conditions: [
          { field: 'column', operator: 'GreaterThanOrEqual', value: '2024-12-01' },
          { field: 'column', operator: 'LessThan', value: '2024-12-18' },
        ],
      });
    });
  });

  describe('PreviousMonth', () => {
    test('should rewrite', () => {
      expect(
        alternatives.PreviousMonth![0].replacer(
          new ConditionTreeLeaf('column', 'PreviousMonth'),
          'Europe/Paris',
          true,
        ),
      ).toEqual({
        aggregator: 'And',
        conditions: [
          { field: 'column', operator: 'GreaterThanOrEqual', value: '2024-11-01' },
          { field: 'column', operator: 'LessThan', value: '2024-12-01' },
        ],
      });
    });
  });

  describe('PreviousQuarterToDate', () => {
    test('should rewrite', () => {
      expect(
        alternatives.PreviousQuarterToDate![0].replacer(
          new ConditionTreeLeaf('column', 'PreviousQuarterToDate'),
          'Europe/Paris',
          true,
        ),
      ).toEqual({
        aggregator: 'And',
        conditions: [
          { field: 'column', operator: 'GreaterThanOrEqual', value: '2024-10-01' },
          { field: 'column', operator: 'LessThan', value: '2024-12-18' },
        ],
      });
    });
  });

  describe('PreviousQuarter', () => {
    test('should rewrite', () => {
      expect(
        alternatives.PreviousQuarter![0].replacer(
          new ConditionTreeLeaf('column', 'PreviousQuarter'),
          'Europe/Paris',
          true,
        ),
      ).toEqual({
        aggregator: 'And',
        conditions: [
          { field: 'column', operator: 'GreaterThanOrEqual', value: '2024-07-01' },
          { field: 'column', operator: 'LessThan', value: '2024-10-01' },
        ],
      });
    });
  });

  describe('PreviousWeekToDate', () => {
    test('should rewrite', () => {
      expect(
        alternatives.PreviousWeekToDate![0].replacer(
          new ConditionTreeLeaf('column', 'PreviousWeekToDate'),
          'Europe/Paris',
          true,
        ),
      ).toEqual({
        aggregator: 'And',
        conditions: [
          { field: 'column', operator: 'GreaterThanOrEqual', value: '2024-12-16' },
          { field: 'column', operator: 'LessThan', value: '2024-12-18' },
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
          'Europe/Paris',
          true,
        ),
      ).toEqual({
        aggregator: 'And',
        conditions: [
          { field: 'column', operator: 'GreaterThanOrEqual', value: '2024-12-09' },
          { field: 'column', operator: 'LessThan', value: '2024-12-16' },
        ],
      });
    });
  });

  describe('PreviousXDaysToDate', () => {
    test('should rewrite', () => {
      expect(
        alternatives.PreviousXDaysToDate![0].replacer(
          new ConditionTreeLeaf('column', 'PreviousXDaysToDate', 14),
          'Europe/Paris',
          true,
        ),
      ).toEqual({
        aggregator: 'And',
        conditions: [
          { field: 'column', operator: 'GreaterThanOrEqual', value: '2024-12-04' },
          { field: 'column', operator: 'LessThan', value: '2024-12-18' },
        ],
      });
    });
  });

  describe('PreviousXDays', () => {
    test('should rewrite', () => {
      expect(
        alternatives.PreviousXDays![0].replacer(
          new ConditionTreeLeaf('column', 'PreviousXDays', 14),
          'Europe/Paris',
          true,
        ),
      ).toEqual({
        aggregator: 'And',
        conditions: [
          { field: 'column', operator: 'GreaterThanOrEqual', value: '2024-12-04' },
          { field: 'column', operator: 'LessThan', value: '2024-12-18' },
        ],
      });
    });
  });

  describe('PreviousYearToDate', () => {
    test('should rewrite', () => {
      expect(
        alternatives.PreviousYearToDate![0].replacer(
          new ConditionTreeLeaf('column', 'PreviousYearToDate'),
          'Europe/Paris',
          true,
        ),
      ).toEqual({
        aggregator: 'And',
        conditions: [
          { field: 'column', operator: 'GreaterThanOrEqual', value: '2024-01-01' },
          { field: 'column', operator: 'LessThan', value: '2024-12-18' },
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
          'Europe/Paris',
          true,
        ),
      ).toEqual({
        aggregator: 'And',
        conditions: [
          { field: 'column', operator: 'GreaterThanOrEqual', value: '2023-01-01' },
          { field: 'column', operator: 'LessThan', value: '2024-01-01' },
        ],
      });
    });
  });

  describe('Today', () => {
    test('should rewrite', () => {
      expect(
        alternatives.Today![0].replacer(
          new ConditionTreeLeaf('column', 'Today'),
          'Europe/Paris',
          true,
        ),
      ).toEqual({
        aggregator: 'And',
        conditions: [
          { field: 'column', operator: 'GreaterThanOrEqual', value: '2024-12-18' },
          { field: 'column', operator: 'LessThan', value: '2024-12-19' },
        ],
      });
    });
  });

  describe('Yesterday', () => {
    test('should rewrite', () => {
      expect(
        alternatives.Yesterday![0].replacer(
          new ConditionTreeLeaf('column', 'Yesterday'),
          'Europe/Paris',
          true,
        ),
      ).toEqual({
        aggregator: 'And',
        conditions: [
          { field: 'column', operator: 'GreaterThanOrEqual', value: '2024-12-17' },
          { field: 'column', operator: 'LessThan', value: '2024-12-18' },
        ],
      });
    });
  });
});
