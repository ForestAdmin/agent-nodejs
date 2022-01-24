export type Filter = {
  conditionTree?: ConditionTree;
  search?: string;
  searchExtended?: boolean;
  segment?: string;
  timezone?: string;
};

export type PaginatedFilter = Filter & {
  sort?: Array<{
    field: string;
    ascending: boolean;
  }>;
  page?: {
    skip?: number;
    limit?: number;
  };
};

export enum Operator {
  Blank = 'blank',
  Contains = 'contains',
  EndsWith = 'ends_with',
  Equal = 'equal',
  GreaterThan = 'greater_than',
  In = 'in',
  IncludesAll = 'includes_all',
  LessThan = 'less_than',
  NotContains = 'not_contains',
  NotEqual = 'not_equal',
  NotIn = 'not_in',
  Present = 'present',
  StartsWith = 'starts_with',

  Before = 'before',
  After = 'after',
  AfterXHoursAgo = 'after_x_hours_ago',
  BeforeXHoursAgo = 'before_x_hours_ago',
  Future = 'future',
  Past = 'past',
  PreviousMonthToDate = 'previous_month_to_date',
  PreviousMonth = 'previous_month',
  PreviousQuarterToDate = 'previous_quarter_to_date',
  PreviousQuarter = 'previous_quarter',
  PreviousWeekToDate = 'previous_week_to_date',
  PreviousWeek = 'previous_week',
  PreviousXDaysToDate = 'previous_x_days_to_date',
  PreviousXDays = 'previous_x_days',
  PreviousYearToDate = 'previous_year_to_date',
  PreviousYear = 'previous_year',
  Today = 'today',
  Yesterday = 'yesterday',

  LongerThan = 'longer_than',
  ShorterThan = 'shorter_than',
  Like = 'like',
}

export enum Aggregator {
  And = 'and',
  Or = 'or',
}

export type ConditionTreeNot = { condition: ConditionTree };
export type ConditionTreeLeaf = { operator: Operator; field: string; value?: unknown };
export type ConditionTreeBranch = { aggregator: Aggregator; conditions: ConditionTree[] };
export type ConditionTree = ConditionTreeBranch | ConditionTreeLeaf | ConditionTreeNot;
