import { ColumnType, Operator, PrimitiveTypes } from '@forestadmin/datasource-toolkit';

export default class FrontendFilterableUtils {
  private static readonly baseOperators: Operator[] = [
    Operator.Equal,
    Operator.NotEqual,
    Operator.Present,
    Operator.Blank,
  ];

  private static readonly dateOperators: Operator[] = [
    ...FrontendFilterableUtils.baseOperators,
    Operator.LessThan,
    Operator.GreaterThan,
    Operator.Today,
    Operator.Yesterday,
    Operator.PreviousXDays,
    Operator.PreviousWeek,
    Operator.PreviousQuarter,
    Operator.PreviousYear,
    Operator.PreviousXDaysToDate,
    Operator.PreviousWeekToDate,
    Operator.PreviousMonthToDate,
    Operator.PreviousQuarterToDate,
    Operator.PreviousYearToDate,
    Operator.Past,
    Operator.Future,
    Operator.BeforeXHoursAgo,
    Operator.AfterXHoursAgo,
  ];

  private static readonly operatorByType: Partial<Record<PrimitiveTypes, Operator[]>> = {
    [PrimitiveTypes.Boolean]: FrontendFilterableUtils.baseOperators,
    [PrimitiveTypes.Date]: FrontendFilterableUtils.dateOperators,
    [PrimitiveTypes.Dateonly]: FrontendFilterableUtils.dateOperators,
    [PrimitiveTypes.Enum]: [...FrontendFilterableUtils.baseOperators, Operator.In],
    [PrimitiveTypes.Number]: [
      ...FrontendFilterableUtils.baseOperators,
      Operator.In,
      Operator.GreaterThan,
      Operator.LessThan,
    ],
    [PrimitiveTypes.String]: [
      ...FrontendFilterableUtils.baseOperators,
      Operator.In,
      Operator.StartsWith,
      Operator.EndsWith,
      Operator.Contains,
      Operator.NotContains,
    ],
    [PrimitiveTypes.Timeonly]: [
      ...FrontendFilterableUtils.baseOperators,
      Operator.GreaterThan,
      Operator.LessThan,
    ],
    [PrimitiveTypes.Uuid]: FrontendFilterableUtils.baseOperators,
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

    return neededOperators && neededOperators.every(op => supportedOperators.has(op));
  }

  private static getRequiredOperators(type: ColumnType): Operator[] | null {
    if (typeof type === 'string' && FrontendFilterableUtils.operatorByType[type]) {
      return FrontendFilterableUtils.operatorByType[type];
    }

    // It sound highly unlikely that this operator can work with dates, or nested objects
    // and they should be more restricted, however the frontend code does not seems to check the
    // array's content so I'm replicating the same test here
    if (Array.isArray(type)) {
      return [Operator.IncludesAll];
    }

    return null;
  }
}
