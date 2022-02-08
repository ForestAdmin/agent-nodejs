import alternatives from '../../../../src/decorators/operators-replace/transforms/time';
import { Aggregator } from '../../../../src/interfaces/query/condition-tree/branch';
import ConditionTreeLeaf, { Operator } from '../../../../src/interfaces/query/condition-tree/leaf';

describe('ConditionTreeOperators > Time', () => {
  beforeAll(() => {
    // https://static.wikia.nocookie.net/bttf/images/d/d5/Time_Circuits_BTTF.png
    const date = new Date('1985-10-26T01:22:00-08:00');
    jest.useFakeTimers().setSystemTime(date);
  });

  describe('Operator.Before', () => {
    test('should rewrite', () => {
      expect(
        alternatives[Operator.Before][0].replacer(
          new ConditionTreeLeaf('column', Operator.Before, '2010-01-01T00:00:00Z'),
          'America/Los_Angeles',
        ),
      ).toEqual({
        field: 'column',
        operator: Operator.LessThan,
        value: '2010-01-01T00:00:00Z',
      });
    });
  });

  describe('Operator.After', () => {
    test('should rewrite', () => {
      expect(
        alternatives[Operator.After][0].replacer(
          new ConditionTreeLeaf('column', Operator.After, '2010-01-01T00:00:00Z'),
          'America/Los_Angeles',
        ),
      ).toEqual({
        field: 'column',
        operator: Operator.GreaterThan,
        value: '2010-01-01T00:00:00Z',
      });
    });
  });

  describe('Operator.Past', () => {
    test('should rewrite', () => {
      expect(
        alternatives[Operator.Past][0].replacer(
          new ConditionTreeLeaf('column', Operator.Past),
          'America/Los_Angeles',
        ),
      ).toEqual({
        field: 'column',
        operator: Operator.LessThan,
        value: '1985-10-26T09:22:00Z',
      });
    });
  });

  describe('Operator.Future', () => {
    test('should rewrite', () => {
      expect(
        alternatives[Operator.Future][0].replacer(
          new ConditionTreeLeaf('column', Operator.Future),
          'America/Los_Angeles',
        ),
      ).toEqual({
        field: 'column',
        operator: Operator.GreaterThan,
        value: '1985-10-26T09:22:00Z',
      });
    });
  });

  describe('Operator.BeforeXHoursAgo', () => {
    test('should rewrite', () => {
      expect(
        alternatives[Operator.BeforeXHoursAgo][0].replacer(
          new ConditionTreeLeaf('column', Operator.BeforeXHoursAgo, 24),
          'America/Los_Angeles',
        ),
      ).toEqual({
        field: 'column',
        operator: Operator.LessThan,
        value: '1985-10-25T09:22:00Z',
      });
    });
  });

  describe('Operator.AfterXHoursAgo', () => {
    test('should rewrite', () => {
      expect(
        alternatives[Operator.AfterXHoursAgo][0].replacer(
          new ConditionTreeLeaf('column', Operator.AfterXHoursAgo, 24),
          'America/Los_Angeles',
        ),
      ).toEqual({
        field: 'column',
        operator: Operator.GreaterThan,
        value: '1985-10-25T09:22:00Z',
      });
    });
  });

  describe('Operator.PreviousMonthToDate', () => {
    test('should rewrite', () => {
      expect(
        alternatives[Operator.PreviousMonthToDate][0].replacer(
          new ConditionTreeLeaf('column', Operator.PreviousMonthToDate),
          'America/Los_Angeles',
        ),
      ).toEqual({
        aggregator: Aggregator.And,
        conditions: [
          { field: 'column', operator: Operator.GreaterThan, value: '1985-10-01T07:00:00Z' },
          { field: 'column', operator: Operator.LessThan, value: '1985-10-26T09:22:00Z' },
        ],
      });
    });
  });

  describe('Operator.PreviousMonth', () => {
    test('should rewrite', () => {
      expect(
        alternatives[Operator.PreviousMonth][0].replacer(
          new ConditionTreeLeaf('column', Operator.PreviousMonth),
          'America/Los_Angeles',
        ),
      ).toEqual({
        aggregator: Aggregator.And,
        conditions: [
          { field: 'column', operator: Operator.GreaterThan, value: '1985-09-01T07:00:00Z' },
          { field: 'column', operator: Operator.LessThan, value: '1985-10-01T07:00:00Z' },
        ],
      });
    });
  });

  describe('Operator.PreviousQuarterToDate', () => {
    test('should rewrite', () => {
      expect(
        alternatives[Operator.PreviousQuarterToDate][0].replacer(
          new ConditionTreeLeaf('column', Operator.PreviousQuarterToDate),
          'America/Los_Angeles',
        ),
      ).toEqual({
        aggregator: Aggregator.And,
        conditions: [
          { field: 'column', operator: Operator.GreaterThan, value: '1985-10-01T07:00:00Z' },
          { field: 'column', operator: Operator.LessThan, value: '1985-10-26T09:22:00Z' },
        ],
      });
    });
  });

  describe('Operator.PreviousQuarter', () => {
    test('should rewrite', () => {
      expect(
        alternatives[Operator.PreviousQuarter][0].replacer(
          new ConditionTreeLeaf('column', Operator.PreviousQuarter),
          'America/Los_Angeles',
        ),
      ).toEqual({
        aggregator: Aggregator.And,
        conditions: [
          { field: 'column', operator: Operator.GreaterThan, value: '1985-07-01T07:00:00Z' },
          { field: 'column', operator: Operator.LessThan, value: '1985-10-01T07:00:00Z' },
        ],
      });
    });
  });

  describe('Operator.PreviousWeekToDate', () => {
    test('should rewrite', () => {
      expect(
        alternatives[Operator.PreviousWeekToDate][0].replacer(
          new ConditionTreeLeaf('column', Operator.PreviousWeekToDate),
          'America/Los_Angeles',
        ),
      ).toEqual({
        aggregator: Aggregator.And,
        conditions: [
          { field: 'column', operator: Operator.GreaterThan, value: '1985-10-21T07:00:00Z' },
          { field: 'column', operator: Operator.LessThan, value: '1985-10-26T09:22:00Z' },
        ],
      });
    });
  });

  describe('Operator.PreviousWeek', () => {
    test('should rewrite', () => {
      // Note that luxon always consider weeks to be from monday to friday
      // @see https://github.com/moment/luxon/issues/373#issuecomment-441123720

      expect(
        alternatives[Operator.PreviousWeek][0].replacer(
          new ConditionTreeLeaf('column', Operator.PreviousWeek),
          'America/Los_Angeles',
        ),
      ).toEqual({
        aggregator: Aggregator.And,
        conditions: [
          { field: 'column', operator: Operator.GreaterThan, value: '1985-10-14T07:00:00Z' },
          { field: 'column', operator: Operator.LessThan, value: '1985-10-21T07:00:00Z' },
        ],
      });
    });
  });

  describe('Operator.PreviousXDaysToDate', () => {
    test('should rewrite', () => {
      expect(
        alternatives[Operator.PreviousXDaysToDate][0].replacer(
          new ConditionTreeLeaf('column', Operator.PreviousXDaysToDate, 14),
          'America/Los_Angeles',
        ),
      ).toEqual({
        aggregator: Aggregator.And,
        conditions: [
          { field: 'column', operator: Operator.GreaterThan, value: '1985-10-12T07:00:00Z' },
          { field: 'column', operator: Operator.LessThan, value: '1985-10-26T09:22:00Z' },
        ],
      });
    });
  });

  describe('Operator.PreviousXDays', () => {
    test('should rewrite', () => {
      expect(
        alternatives[Operator.PreviousXDays][0].replacer(
          new ConditionTreeLeaf('column', Operator.PreviousXDays, 14),
          'America/Los_Angeles',
        ),
      ).toEqual({
        aggregator: Aggregator.And,
        conditions: [
          { field: 'column', operator: Operator.GreaterThan, value: '1985-10-12T07:00:00Z' },
          { field: 'column', operator: Operator.LessThan, value: '1985-10-26T07:00:00Z' },
        ],
      });
    });
  });

  describe('Operator.PreviousYearToDate', () => {
    test('should rewrite', () => {
      expect(
        alternatives[Operator.PreviousYearToDate][0].replacer(
          new ConditionTreeLeaf('column', Operator.PreviousYearToDate),
          'America/Los_Angeles',
        ),
      ).toEqual({
        aggregator: Aggregator.And,
        conditions: [
          { field: 'column', operator: Operator.GreaterThan, value: '1985-01-01T08:00:00Z' },
          { field: 'column', operator: Operator.LessThan, value: '1985-10-26T09:22:00Z' },
        ],
      });
    });
  });

  describe('Operator.PreviousYear', () => {
    test('should rewrite', () => {
      // Notice daylight saving time in this test, as it's january

      expect(
        alternatives[Operator.PreviousYear][0].replacer(
          new ConditionTreeLeaf('column', Operator.PreviousYear),
          'America/Los_Angeles',
        ),
      ).toEqual({
        aggregator: Aggregator.And,
        conditions: [
          { field: 'column', operator: Operator.GreaterThan, value: '1984-01-01T08:00:00Z' },
          { field: 'column', operator: Operator.LessThan, value: '1985-01-01T08:00:00Z' },
        ],
      });
    });
  });

  describe('Operator.Today', () => {
    test('should rewrite', () => {
      expect(
        alternatives[Operator.Today][0].replacer(
          new ConditionTreeLeaf('column', Operator.Today),
          'America/Los_Angeles',
        ),
      ).toEqual({
        aggregator: Aggregator.And,
        conditions: [
          { field: 'column', operator: Operator.GreaterThan, value: '1985-10-26T07:00:00Z' },
          { field: 'column', operator: Operator.LessThan, value: '1985-10-27T07:00:00Z' },
        ],
      });
    });
  });

  describe('Operator.Yesterday;', () => {
    test('should rewrite', () => {
      expect(
        alternatives[Operator.Yesterday][0].replacer(
          new ConditionTreeLeaf('column', Operator.Yesterday),
          'America/Los_Angeles',
        ),
      ).toEqual({
        aggregator: Aggregator.And,
        conditions: [
          { field: 'column', operator: Operator.GreaterThan, value: '1985-10-25T07:00:00Z' },
          { field: 'column', operator: Operator.LessThan, value: '1985-10-26T07:00:00Z' },
        ],
      });
    });
  });
});
