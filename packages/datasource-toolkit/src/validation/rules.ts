import { Operator } from '../interfaces/query/condition-tree/nodes/leaf';
import { PrimitiveTypes } from '../interfaces/schema';
import ValidationTypes from './types';

const BASE_OPERATORS: Operator[] = [
  Operator.Blank,
  Operator.Equal,
  Operator.Missing,
  Operator.NotEqual,
  Operator.Present,
];

const BASE_DATEONLY_OPERATORS: Operator[] = [
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
  Operator.Before,
  Operator.After,
];

export const MAP_ALLOWED_OPERATORS_IN_FILTER_FOR_COLUMN_TYPE: Readonly<
  Record<PrimitiveTypes, readonly Operator[]>
> = Object.freeze({
  [PrimitiveTypes.String]: [
    ...BASE_OPERATORS,
    Operator.In,
    Operator.NotIn,
    Operator.Contains,
    Operator.NotContains,
    Operator.EndsWith,
    Operator.StartsWith,
    Operator.LongerThan,
    Operator.ShorterThan,
    Operator.Like,
  ],
  [PrimitiveTypes.Number]: [
    ...BASE_OPERATORS,
    Operator.GreaterThan,
    Operator.LessThan,
    Operator.In,
    Operator.NotIn,
  ],
  [PrimitiveTypes.Dateonly]: [...BASE_OPERATORS, ...BASE_DATEONLY_OPERATORS],
  [PrimitiveTypes.Date]: [
    ...BASE_OPERATORS,
    ...BASE_DATEONLY_OPERATORS,
    Operator.BeforeXHoursAgo,
    Operator.AfterXHoursAgo,
  ],
  [PrimitiveTypes.Timeonly]: [...BASE_OPERATORS, Operator.LessThan, Operator.GreaterThan],
  [PrimitiveTypes.Enum]: [...BASE_OPERATORS, Operator.In, Operator.NotIn],
  [PrimitiveTypes.Json]: [Operator.Blank, Operator.Missing, Operator.Present],
  [PrimitiveTypes.Boolean]: BASE_OPERATORS,
  [PrimitiveTypes.Point]: BASE_OPERATORS,
  [PrimitiveTypes.Uuid]: [...BASE_OPERATORS, Operator.In],
});

export const MAP_ALLOWED_TYPES_IN_FILTER_FOR_COLUMN_TYPE: Readonly<
  Record<PrimitiveTypes, readonly (ValidationTypes | PrimitiveTypes)[]>
> = Object.freeze({
  [PrimitiveTypes.String]: [PrimitiveTypes.String, ValidationTypes.ArrayOfString],
  [PrimitiveTypes.Number]: [PrimitiveTypes.Number, ValidationTypes.ArrayOfNumber],
  [PrimitiveTypes.Boolean]: [PrimitiveTypes.Boolean, ValidationTypes.ArrayOfBoolean],
  [PrimitiveTypes.Enum]: [PrimitiveTypes.Enum, ValidationTypes.ArrayOfEnum],
  [PrimitiveTypes.Date]: [PrimitiveTypes.Date],
  [PrimitiveTypes.Dateonly]: [PrimitiveTypes.Dateonly],
  [PrimitiveTypes.Json]: [PrimitiveTypes.Json],
  [PrimitiveTypes.Point]: [PrimitiveTypes.Point],
  [PrimitiveTypes.Timeonly]: [PrimitiveTypes.Timeonly],
  [PrimitiveTypes.Uuid]: [PrimitiveTypes.Uuid, ValidationTypes.ArrayOfUuid],
});

function computeAllowedTypesForOperators(): Record<Operator, PrimitiveTypes[]> {
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
  }, {} as Record<Operator, PrimitiveTypes[]>);
}

const NO_TYPES_ALLOWED: ValidationTypes[] = [];

export const MAP_ALLOWED_TYPES_FOR_OPERATOR_IN_FILTER: Readonly<
  Record<Operator, readonly (ValidationTypes | PrimitiveTypes)[]>
> = Object.freeze({
  ...computeAllowedTypesForOperators(),
  [Operator.Blank]: NO_TYPES_ALLOWED,
  [Operator.In]: [
    ValidationTypes.ArrayOfBoolean,
    ValidationTypes.ArrayOfEnum,
    ValidationTypes.ArrayOfNumber,
    ValidationTypes.ArrayOfString,
    ValidationTypes.ArrayOfUuid,
  ],
  [Operator.IncludesAll]: [
    ValidationTypes.ArrayOfBoolean,
    ValidationTypes.ArrayOfEnum,
    ValidationTypes.ArrayOfNumber,
    ValidationTypes.ArrayOfString,
  ],
  [Operator.Missing]: NO_TYPES_ALLOWED,
  [Operator.Present]: NO_TYPES_ALLOWED,
});
