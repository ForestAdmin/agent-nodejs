import { z } from 'zod';

const operatorEnum = z.enum([
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
]);

const aggregatorEnum = z.enum(['And', 'Or']);

// Leaf condition (e.g., { field: 'name', operator: 'Equal', value: 'John' })
const leafSchema = z.object({
  field: z.string(),
  operator: operatorEnum,
  value: z.unknown().optional(),
});

// Build nested branch schemas iteratively (avoids z.lazy() which causes $ref issues)
const MAX_NESTING_DEPTH = 3;

function buildConditionSchema(): z.ZodTypeAny {
  let schema: z.ZodTypeAny = leafSchema;

  for (let i = 0; i < MAX_NESTING_DEPTH; i += 1) {
    schema = z.union([
      leafSchema,
      z.object({
        aggregator: aggregatorEnum,
        conditions: z.array(schema),
      }),
    ]);
  }

  return schema;
}

export default buildConditionSchema();
