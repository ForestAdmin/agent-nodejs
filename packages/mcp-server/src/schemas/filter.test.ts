import filterSchema from './filter';

describe('filterSchema', () => {
  describe('leaf conditions', () => {
    it('should accept valid leaf condition with Equal operator', () => {
      const condition = {
        aggregator: 'And',
        conditions: [{ field: 'name', operator: 'Equal', value: 'John' }],
      };

      expect(() => filterSchema.parse(condition)).not.toThrow();
    });

    it('should accept leaf condition without value for operators that do not require it', () => {
      const condition = {
        aggregator: 'And',
        conditions: [{ field: 'deletedAt', operator: 'Present' }],
      };

      expect(() => filterSchema.parse(condition)).not.toThrow();
    });

    it.each([
      'Equal',
      'NotEqual',
      'LessThan',
      'GreaterThan',
      'LessThanOrEqual',
      'GreaterThanOrEqual',
      'Match',
      'NotContains',
      'NotIContains',
      'LongerThan',
      'ShorterThan',
      'IncludesAll',
      'IncludesNone',
      'Today',
      'Yesterday',
      'PreviousMonth',
      'PreviousQuarter',
      'PreviousWeek',
      'PreviousYear',
      'PreviousMonthToDate',
      'PreviousQuarterToDate',
      'PreviousWeekToDate',
      'PreviousXDaysToDate',
      'PreviousXDays',
      'PreviousYearToDate',
      'Present',
      'Blank',
      'Missing',
      'In',
      'NotIn',
      'StartsWith',
      'EndsWith',
      'Contains',
      'IStartsWith',
      'IEndsWith',
      'IContains',
      'Like',
      'ILike',
      'Before',
      'After',
      'AfterXHoursAgo',
      'BeforeXHoursAgo',
      'Future',
      'Past',
    ])('should accept operator "%s"', operator => {
      const condition = {
        aggregator: 'And',
        conditions: [{ field: 'testField', operator, value: 'test' }],
      };

      expect(() => filterSchema.parse(condition)).not.toThrow();
    });

    it('should reject invalid operator', () => {
      const condition = {
        aggregator: 'And',
        conditions: [{ field: 'name', operator: 'InvalidOperator', value: 'John' }],
      };

      expect(() => filterSchema.parse(condition)).toThrow();
    });

    it('should require field property', () => {
      const condition = {
        aggregator: 'And',
        conditions: [{ operator: 'Equal', value: 'John' }],
      };

      expect(() => filterSchema.parse(condition)).toThrow();
    });

    it('should require operator property', () => {
      const condition = {
        aggregator: 'And',
        conditions: [{ field: 'name', value: 'John' }],
      };

      expect(() => filterSchema.parse(condition)).toThrow();
    });
  });

  describe('branch conditions', () => {
    it('should accept And aggregator', () => {
      const condition = {
        aggregator: 'And',
        conditions: [{ field: 'name', operator: 'Equal', value: 'John' }],
      };

      expect(() => filterSchema.parse(condition)).not.toThrow();
    });

    it('should accept Or aggregator', () => {
      const condition = {
        aggregator: 'Or',
        conditions: [{ field: 'name', operator: 'Equal', value: 'John' }],
      };

      expect(() => filterSchema.parse(condition)).not.toThrow();
    });

    it('should reject invalid aggregator', () => {
      const condition = {
        aggregator: 'Xor',
        conditions: [{ field: 'name', operator: 'Equal', value: 'John' }],
      };

      expect(() => filterSchema.parse(condition)).toThrow();
    });

    it('should require conditions array', () => {
      const condition = {
        aggregator: 'And',
      };

      expect(() => filterSchema.parse(condition)).toThrow();
    });

    it('should accept empty conditions array', () => {
      const condition = {
        aggregator: 'And',
        conditions: [],
      };

      expect(() => filterSchema.parse(condition)).not.toThrow();
    });
  });

  describe('nested conditions', () => {
    it('should accept nested branch conditions', () => {
      const condition = {
        aggregator: 'And',
        conditions: [
          { field: 'name', operator: 'Equal', value: 'John' },
          {
            aggregator: 'Or',
            conditions: [
              { field: 'age', operator: 'GreaterThan', value: 18 },
              { field: 'status', operator: 'Equal', value: 'adult' },
            ],
          },
        ],
      };

      expect(() => filterSchema.parse(condition)).not.toThrow();
    });

    it('should accept deeply nested conditions', () => {
      const condition = {
        aggregator: 'And',
        conditions: [
          {
            aggregator: 'Or',
            conditions: [
              {
                aggregator: 'And',
                conditions: [
                  { field: 'a', operator: 'Equal', value: 1 },
                  { field: 'b', operator: 'Equal', value: 2 },
                ],
              },
              { field: 'c', operator: 'Equal', value: 3 },
            ],
          },
        ],
      };

      expect(() => filterSchema.parse(condition)).not.toThrow();
    });

    it('should accept mixed leaf and branch conditions', () => {
      const condition = {
        aggregator: 'And',
        conditions: [
          { field: 'active', operator: 'Equal', value: true },
          {
            aggregator: 'Or',
            conditions: [
              { field: 'role', operator: 'Equal', value: 'admin' },
              { field: 'role', operator: 'Equal', value: 'superuser' },
            ],
          },
          { field: 'verified', operator: 'Equal', value: true },
        ],
      };

      expect(() => filterSchema.parse(condition)).not.toThrow();
    });
  });

  describe('value types', () => {
    it('should accept string values', () => {
      const condition = {
        aggregator: 'And',
        conditions: [{ field: 'name', operator: 'Equal', value: 'John' }],
      };

      expect(() => filterSchema.parse(condition)).not.toThrow();
    });

    it('should accept number values', () => {
      const condition = {
        aggregator: 'And',
        conditions: [{ field: 'age', operator: 'GreaterThan', value: 25 }],
      };

      expect(() => filterSchema.parse(condition)).not.toThrow();
    });

    it('should accept boolean values', () => {
      const condition = {
        aggregator: 'And',
        conditions: [{ field: 'active', operator: 'Equal', value: true }],
      };

      expect(() => filterSchema.parse(condition)).not.toThrow();
    });

    it('should accept null values', () => {
      const condition = {
        aggregator: 'And',
        conditions: [{ field: 'deletedAt', operator: 'Equal', value: null }],
      };

      expect(() => filterSchema.parse(condition)).not.toThrow();
    });

    it('should accept array values for In operator', () => {
      const condition = {
        aggregator: 'And',
        conditions: [{ field: 'status', operator: 'In', value: ['active', 'pending', 'approved'] }],
      };

      expect(() => filterSchema.parse(condition)).not.toThrow();
    });

    it('should accept date string values', () => {
      const condition = {
        aggregator: 'And',
        conditions: [{ field: 'createdAt', operator: 'After', value: '2024-01-01T00:00:00Z' }],
      };

      expect(() => filterSchema.parse(condition)).not.toThrow();
    });
  });
});
