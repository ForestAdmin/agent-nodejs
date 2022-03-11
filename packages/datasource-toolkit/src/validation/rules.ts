import { Operator } from '../interfaces/query/condition-tree/nodes/leaf';
import { PrimitiveTypes } from '../interfaces/schema';
import { ValidationPrimaryTypes, ValidationTypes, ValidationTypesArray } from './types';

const BASE_OPERATORS: Operator[] = [
  Operator.Blank,
  Operator.Equal,
  Operator.Missing,
  Operator.NotEqual,
  Operator.Present,
];

const ARRAY_OPERATORS: Operator[] = [Operator.In, Operator.NotIn, Operator.IncludesAll];

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

export const MAP_ALLOWED_OPERATORS_FOR_COLUMN_TYPE: Readonly<
  Record<PrimitiveTypes, readonly Operator[]>
> = Object.freeze({
  [PrimitiveTypes.String]: [
    ...BASE_OPERATORS,
    ...ARRAY_OPERATORS,
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
    ...ARRAY_OPERATORS,
    Operator.GreaterThan,
    Operator.LessThan,
  ],
  [PrimitiveTypes.Dateonly]: [...BASE_OPERATORS, ...BASE_DATEONLY_OPERATORS],
  [PrimitiveTypes.Date]: [
    ...BASE_OPERATORS,
    ...BASE_DATEONLY_OPERATORS,
    Operator.BeforeXHoursAgo,
    Operator.AfterXHoursAgo,
  ],
  [PrimitiveTypes.Timeonly]: [...BASE_OPERATORS, Operator.LessThan, Operator.GreaterThan],
  [PrimitiveTypes.Enum]: [...BASE_OPERATORS, ...ARRAY_OPERATORS],
  [PrimitiveTypes.Json]: [Operator.Blank, Operator.Missing, Operator.Present],
  [PrimitiveTypes.Boolean]: BASE_OPERATORS,
  [PrimitiveTypes.Point]: BASE_OPERATORS,
  [PrimitiveTypes.Uuid]: [...BASE_OPERATORS, ...ARRAY_OPERATORS],
});

export const MAP_ALLOWED_TYPES_FOR_COLUMN_TYPE: Readonly<
  Record<PrimitiveTypes, readonly (ValidationTypes | PrimitiveTypes)[]>
> = Object.freeze({
  [PrimitiveTypes.String]: [
    PrimitiveTypes.String,
    ValidationTypesArray.String,
    ValidationPrimaryTypes.Null,
  ],
  [PrimitiveTypes.Number]: [
    PrimitiveTypes.Number,
    ValidationTypesArray.Number,
    ValidationPrimaryTypes.Null,
  ],
  [PrimitiveTypes.Boolean]: [
    PrimitiveTypes.Boolean,
    ValidationTypesArray.Boolean,
    ValidationPrimaryTypes.Null,
  ],
  [PrimitiveTypes.Enum]: [
    PrimitiveTypes.Enum,
    ValidationTypesArray.Enum,
    ValidationPrimaryTypes.Null,
  ],
  [PrimitiveTypes.Date]: [PrimitiveTypes.Date, PrimitiveTypes.Number, ValidationPrimaryTypes.Null],
  [PrimitiveTypes.Dateonly]: [
    PrimitiveTypes.Dateonly,
    PrimitiveTypes.Number,
    ValidationPrimaryTypes.Null,
  ],
  [PrimitiveTypes.Json]: [PrimitiveTypes.Json, ValidationPrimaryTypes.Null],
  [PrimitiveTypes.Point]: [PrimitiveTypes.Point, ValidationPrimaryTypes.Null],
  [PrimitiveTypes.Timeonly]: [PrimitiveTypes.Timeonly, ValidationPrimaryTypes.Null],
  [PrimitiveTypes.Uuid]: [
    PrimitiveTypes.Uuid,
    ValidationTypesArray.Uuid,
    ValidationPrimaryTypes.Null,
  ],
});

function computeAllowedTypesForOperators(): Record<Operator, PrimitiveTypes[]> {
  return Object.values(PrimitiveTypes).reduce((mapMemo, type) => {
    const allowedOperators = MAP_ALLOWED_OPERATORS_FOR_COLUMN_TYPE[type];
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

const NO_TYPES_ALLOWED: ValidationTypes[] = [ValidationPrimaryTypes.Null];
export const MAP_ALLOWED_TYPES_FOR_OPERATOR: Readonly<
  Record<Operator, readonly (ValidationTypes | PrimitiveTypes)[]>
> = Object.freeze({
  ...computeAllowedTypesForOperators(),
  [Operator.In]: Object.values(ValidationTypesArray),
  [Operator.NotIn]: Object.values(ValidationTypesArray),
  [Operator.IncludesAll]: Object.values(ValidationTypesArray),

  [Operator.Blank]: NO_TYPES_ALLOWED,
  [Operator.Missing]: NO_TYPES_ALLOWED,
  [Operator.Present]: NO_TYPES_ALLOWED,
  [Operator.Yesterday]: NO_TYPES_ALLOWED,
  [Operator.Today]: NO_TYPES_ALLOWED,
  [Operator.PreviousQuarter]: NO_TYPES_ALLOWED,
  [Operator.PreviousYear]: NO_TYPES_ALLOWED,
  [Operator.PreviousMonth]: NO_TYPES_ALLOWED,
  [Operator.PreviousWeek]: NO_TYPES_ALLOWED,
  [Operator.Past]: NO_TYPES_ALLOWED,
  [Operator.Future]: NO_TYPES_ALLOWED,
  [Operator.PreviousWeekToDate]: NO_TYPES_ALLOWED,
  [Operator.PreviousMonthToDate]: NO_TYPES_ALLOWED,
  [Operator.PreviousQuarterToDate]: NO_TYPES_ALLOWED,
  [Operator.PreviousYearToDate]: NO_TYPES_ALLOWED,

  [Operator.PreviousXDaysToDate]: [PrimitiveTypes.Number],
  [Operator.PreviousXDays]: [PrimitiveTypes.Number],
  [Operator.BeforeXHoursAgo]: [PrimitiveTypes.Number],
  [Operator.AfterXHoursAgo]: [PrimitiveTypes.Number],
});
