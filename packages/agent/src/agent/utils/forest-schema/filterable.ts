import { ColumnType, Operator, PrimitiveTypes } from '@forestadmin/datasource-toolkit';

export default class FrontendFilterableUtils {
  private static readonly baseOperators: Operator[] = ['Equal', 'NotEqual', 'Present', 'Blank'];

  private static readonly dateOperators: Operator[] = [
    ...FrontendFilterableUtils.baseOperators,
    'LessThan',
    'GreaterThan',
    'Today',
    'Yesterday',
    'PreviousXDays',
    'PreviousWeek',
    'PreviousQuarter',
    'PreviousYear',
    'PreviousXDaysToDate',
    'PreviousWeekToDate',
    'PreviousMonthToDate',
    'PreviousQuarterToDate',
    'PreviousYearToDate',
    'Past',
    'Future',
    'BeforeXHoursAgo',
    'AfterXHoursAgo',
  ];

  private static readonly operatorByType: Partial<Record<PrimitiveTypes, Operator[]>> = {
    Boolean: FrontendFilterableUtils.baseOperators,
    Date: FrontendFilterableUtils.dateOperators,
    Dateonly: FrontendFilterableUtils.dateOperators,
    Enum: [...FrontendFilterableUtils.baseOperators, 'In'],
    Number: [...FrontendFilterableUtils.baseOperators, 'In', 'GreaterThan', 'LessThan'],
    String: [
      ...FrontendFilterableUtils.baseOperators,
      'In',
      'StartsWith',
      'EndsWith',
      'Contains',
      'NotContains',
    ],
    Timeonly: [...FrontendFilterableUtils.baseOperators, 'GreaterThan', 'LessThan'],
    Uuid: FrontendFilterableUtils.baseOperators,
  };

  /**
   * Compute if a column if filterable according to forestadmin's frontend.
   *
   * @param type column's type (string, number, or a composite type)
   * @param operators list of operators that the column supports
   * @returns either if the frontend would consider this column filterable or not.
   */
  static isFilterable(type: ColumnType, operators?: Set<Operator>): boolean {
    const neededOperators = FrontendFilterableUtils.getRequiredOperators(type);
    const supportedOperators = operators ?? new Set();

    return Boolean(neededOperators && neededOperators.every(op => supportedOperators.has(op)));
  }

  static getRequiredOperators(type: ColumnType): Operator[] | null {
    if (typeof type === 'string' && FrontendFilterableUtils.operatorByType[type]) {
      return FrontendFilterableUtils.operatorByType[type];
    }

    // It sound highly unlikely that this operator can work with dates, or nested objects
    // and they should be more restricted, however the frontend code does not seems to check the
    // array's content so I'm replicating the same test here
    if (Array.isArray(type)) {
      return ['IncludesAll'];
    }

    return null;
  }
}
