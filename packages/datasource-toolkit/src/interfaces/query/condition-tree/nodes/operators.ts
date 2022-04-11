// This set of operators is enough to implement them all with replacements
export const uniqueOperators = [
  // All types besides arrays
  'Equal',
  'NotEqual',
  'LessThan',
  'GreaterThan',

  // Strings
  'Like',
  'NotContains',
  'LongerThan',
  'ShorterThan',

  // Arrays
  'IncludesAll',
] as const;

export const intervalOperators = [
  // Dates
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
] as const;

export const otherOperators = [
  // All types
  'Present',
  'Blank',
  'Missing',

  // All types besides arrays
  'In',
  'NotIn',

  // Strings
  'StartsWith',
  'EndsWith',
  'Contains',

  // Dates
  'Before',
  'After',
  'AfterXHoursAgo',
  'BeforeXHoursAgo',
  'Future',
  'Past',
] as const;

export const allOperators = [...uniqueOperators, ...intervalOperators, ...otherOperators] as const;

export type Operator = typeof allOperators[number];
