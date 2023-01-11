import { ValidationPrimaryTypes, ValidationTypes, ValidationTypesArray } from './types';
import { Operator } from '../interfaces/query/condition-tree/nodes/operators';
import { PrimitiveTypes } from '../interfaces/schema';

const BASE_OPERATORS: Operator[] = ['Blank', 'Equal', 'Missing', 'NotEqual', 'Present'];

const ARRAY_OPERATORS: Operator[] = ['In', 'NotIn', 'IncludesAll'];

const BASE_DATEONLY_OPERATORS: Operator[] = [
  'Today',
  'Yesterday',
  'PreviousXDaysToDate',
  'PreviousWeek',
  'PreviousWeekToDate',
  'PreviousMonth',
  'PreviousMonthToDate',
  'PreviousQuarter',
  'PreviousQuarterToDate',
  'PreviousYear',
  'PreviousYearToDate',
  'Past',
  'Future',
  'PreviousXDays',
  'Before',
  'After',
];

export const MAP_ALLOWED_OPERATORS_FOR_COLUMN_TYPE: Readonly<
  Record<PrimitiveTypes, readonly Operator[]>
> = Object.freeze({
  String: [
    ...BASE_OPERATORS,
    ...ARRAY_OPERATORS,
    'Contains',
    'NotContains',
    'EndsWith',
    'StartsWith',
    'LongerThan',
    'ShorterThan',
    'Like',
    'ILike',
    'IContains',
    'IEndsWith',
    'IStartsWith',
  ],
  Number: [...BASE_OPERATORS, ...ARRAY_OPERATORS, 'GreaterThan', 'LessThan'],
  Dateonly: [...BASE_OPERATORS, ...BASE_DATEONLY_OPERATORS],
  Date: [...BASE_OPERATORS, ...BASE_DATEONLY_OPERATORS, 'BeforeXHoursAgo', 'AfterXHoursAgo'],
  Timeonly: [...BASE_OPERATORS, 'LessThan', 'GreaterThan'],
  Enum: [...BASE_OPERATORS, ...ARRAY_OPERATORS],
  Json: [...BASE_OPERATORS, ...ARRAY_OPERATORS],
  Boolean: [...BASE_OPERATORS, ...ARRAY_OPERATORS],
  Point: BASE_OPERATORS,
  Uuid: [...BASE_OPERATORS, ...ARRAY_OPERATORS],
});

export const MAP_ALLOWED_TYPES_FOR_COLUMN_TYPE: Readonly<
  Record<PrimitiveTypes, readonly (ValidationTypes | PrimitiveTypes)[]>
> = Object.freeze({
  String: ['String', ValidationPrimaryTypes.Null],
  Number: ['Number', ValidationPrimaryTypes.Null],
  Boolean: ['Boolean', ValidationPrimaryTypes.Null],
  Enum: ['Enum', ValidationPrimaryTypes.Null],
  Date: ['Date', ValidationPrimaryTypes.Null],
  Dateonly: ['Dateonly', ValidationPrimaryTypes.Null],
  Json: ['Json', ValidationTypesArray.Json, ValidationPrimaryTypes.Null],
  Point: ['Point', ValidationPrimaryTypes.Null],
  Timeonly: ['Timeonly', ValidationPrimaryTypes.Null],
  Uuid: ['Uuid', ValidationPrimaryTypes.Null],
});

export const MAP_ALLOWED_TYPES_FOR_COLUMN_TYPE_CONDITION_TREE: Readonly<
  Record<PrimitiveTypes, readonly (ValidationTypes | PrimitiveTypes)[]>
> = Object.freeze({
  ...MAP_ALLOWED_TYPES_FOR_COLUMN_TYPE,
  ...{
    String: [...MAP_ALLOWED_TYPES_FOR_COLUMN_TYPE.String, ValidationTypesArray.String],
    Number: [...MAP_ALLOWED_TYPES_FOR_COLUMN_TYPE.Number, ValidationTypesArray.Number],
    Boolean: [...MAP_ALLOWED_TYPES_FOR_COLUMN_TYPE.Boolean, ValidationTypesArray.Boolean],
    Enum: [...MAP_ALLOWED_TYPES_FOR_COLUMN_TYPE.Enum, ValidationTypesArray.Enum],
    Uuid: [...MAP_ALLOWED_TYPES_FOR_COLUMN_TYPE.Uuid, ValidationTypesArray.Uuid],
  },
});

function computeAllowedTypesForOperators(): Record<Operator, PrimitiveTypes[]> {
  return Object.keys(MAP_ALLOWED_OPERATORS_FOR_COLUMN_TYPE).reduce((mapMemo, type) => {
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
  In: Object.values(ValidationTypesArray),
  NotIn: Object.values(ValidationTypesArray),
  IncludesAll: Object.values(ValidationTypesArray),

  Blank: NO_TYPES_ALLOWED,
  Missing: NO_TYPES_ALLOWED,
  Present: NO_TYPES_ALLOWED,
  Yesterday: NO_TYPES_ALLOWED,
  Today: NO_TYPES_ALLOWED,
  PreviousQuarter: NO_TYPES_ALLOWED,
  PreviousYear: NO_TYPES_ALLOWED,
  PreviousMonth: NO_TYPES_ALLOWED,
  PreviousWeek: NO_TYPES_ALLOWED,
  Past: NO_TYPES_ALLOWED,
  Future: NO_TYPES_ALLOWED,
  PreviousWeekToDate: NO_TYPES_ALLOWED,
  PreviousMonthToDate: NO_TYPES_ALLOWED,
  PreviousQuarterToDate: NO_TYPES_ALLOWED,
  PreviousYearToDate: NO_TYPES_ALLOWED,

  PreviousXDaysToDate: ['Number'],
  PreviousXDays: ['Number'],
  BeforeXHoursAgo: ['Number'],
  AfterXHoursAgo: ['Number'],
  LongerThan: ['Number'],
  ShorterThan: ['Number'],
});
