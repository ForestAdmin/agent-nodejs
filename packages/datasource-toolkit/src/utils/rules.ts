import { NonPrimitiveTypes, PrimitiveTypes } from '../interfaces/schema';
import { Operator } from '../interfaces/query/selection';

const NO_TYPES_ALLOWED: Readonly<PrimitiveTypes[]> = [];

export const MAP_ALLOWED_OPERATORS_IN_FILTER_FOR_COLUMN_TYPE: Readonly<{
  [type: string]: readonly Operator[];
}> = Object.freeze({
  [PrimitiveTypes.String]: [
    Operator.Present,
    Operator.Equal,
    Operator.In,
    Operator.NotIn,
    Operator.Contains,
    Operator.NotContains,
    Operator.EndsWith,
    Operator.StartsWith,
  ],
  [PrimitiveTypes.Number]: [
    Operator.Present,
    Operator.Equal,
    Operator.GreaterThan,
    Operator.NotIn,
    Operator.LessThan,
  ],
  [PrimitiveTypes.Boolean]: [Operator.Equal, Operator.NotEqual, Operator.Blank],
  [PrimitiveTypes.Dateonly]: [
    Operator.Equal,
    Operator.NotEqual,
    Operator.Present,
    Operator.Blank,
    Operator.Today,
    Operator.Yesterday,
    Operator.PreviousXDaysToDate,
    Operator.PreviousWeek,
    Operator.PreviousWeekToDate,
    Operator.PreviousMonth,
    Operator.PreviousMonthToDate,
    Operator.PreviousQuarter,
    Operator.PreviousQuarterToDate,
    Operator.PreviousYear,
    Operator.PreviousYearToDate,
    Operator.Past,
    Operator.Future,
    Operator.PreviousXDays,
  ],
  [PrimitiveTypes.Date]: [
    Operator.Equal,
    Operator.NotEqual,
    Operator.Present,
    Operator.Blank,
    Operator.Today,
    Operator.Yesterday,
    Operator.PreviousXDaysToDate,
    Operator.PreviousWeek,
    Operator.PreviousWeekToDate,
    Operator.PreviousMonth,
    Operator.PreviousMonthToDate,
    Operator.PreviousQuarter,
    Operator.PreviousQuarterToDate,
    Operator.PreviousYear,
    Operator.PreviousYearToDate,
    Operator.Past,
    Operator.Future,
    Operator.BeforeXHoursAgo,
    Operator.AfterXHoursAgo,
    Operator.PreviousXDays,
  ],
  [PrimitiveTypes.Timeonly]: [
    Operator.Equal,
    Operator.LessThan,
    Operator.GreaterThan,
    Operator.Present,
    Operator.NotEqual,
    Operator.Blank,
  ],
  [PrimitiveTypes.Enum]: [
    Operator.Equal,
    Operator.In,
    Operator.NotIn,
    Operator.Present,
    Operator.Blank,
  ],
  [PrimitiveTypes.Json]: [Operator.Equal, Operator.Present, Operator.Blank],
  [PrimitiveTypes.Point]: [Operator.Equal],
  [PrimitiveTypes.Uuid]: [Operator.Equal, Operator.NotEqual, Operator.Present, Operator.Blank],
});

export const MAP_ALLOWED_TYPES_IN_FILTER_FOR_COLUMN_TYPE: Readonly<{
  [type: string]: readonly (PrimitiveTypes | NonPrimitiveTypes)[];
}> = Object.freeze({
  [PrimitiveTypes.String]: [PrimitiveTypes.String, NonPrimitiveTypes.ArrayOfString],
  [PrimitiveTypes.Number]: [PrimitiveTypes.Number, NonPrimitiveTypes.ArrayOfNumber],
  [PrimitiveTypes.Boolean]: [PrimitiveTypes.Boolean, NonPrimitiveTypes.ArrayOfBoolean],
  [PrimitiveTypes.Enum]: [PrimitiveTypes.String, NonPrimitiveTypes.ArrayOfString],
  [PrimitiveTypes.Date]: [PrimitiveTypes.Date],
  [PrimitiveTypes.Dateonly]: [PrimitiveTypes.Dateonly],
  [PrimitiveTypes.Json]: [PrimitiveTypes.Json],
  [PrimitiveTypes.Point]: [PrimitiveTypes.Point],
  [PrimitiveTypes.Timeonly]: [PrimitiveTypes.Timeonly],
  [PrimitiveTypes.Uuid]: [PrimitiveTypes.Uuid],
});

function computeAllowedTypesForOperators() {
  return Object.values(PrimitiveTypes).reduce((mapMemo, type) => {
    const allowedOperators = MAP_ALLOWED_OPERATORS_IN_FILTER_FOR_COLUMN_TYPE[type];
    allowedOperators.forEach(operator => {
      if (mapMemo[operator]) {
        mapMemo[operator].push(type);
      } else {
        mapMemo[operator] = [type];
      }
    });

    return mapMemo;
  }, {});
}

export const MAP_ALLOWED_TYPES_FOR_OPERATOR_IN_FILTER: Readonly<{
  [operator: string]: readonly (PrimitiveTypes | NonPrimitiveTypes)[];
}> = {
  ...computeAllowedTypesForOperators(),
  [Operator.Present]: NO_TYPES_ALLOWED,
  [Operator.Blank]: NO_TYPES_ALLOWED,
  [Operator.In]: [
    NonPrimitiveTypes.ArrayOfNumber,
    NonPrimitiveTypes.ArrayOfString,
    NonPrimitiveTypes.ArrayOfBoolean,
  ],
  [Operator.IncludesAll]: [
    NonPrimitiveTypes.ArrayOfNumber,
    NonPrimitiveTypes.ArrayOfString,
    NonPrimitiveTypes.ArrayOfBoolean,
  ],
};
