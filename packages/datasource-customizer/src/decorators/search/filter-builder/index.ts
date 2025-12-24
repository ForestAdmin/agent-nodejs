import type {
  Caller,
  ColumnSchema,
  ColumnType,
  ConditionTree,
  PrimitiveTypes,
} from '@forestadmin/datasource-toolkit';

import { ConditionTreeFactory, ConditionTreeLeaf } from '@forestadmin/datasource-toolkit';

import buildBooleanFieldFilter from './build-boolean-field-filter';
import buildDateFieldFilter from './build-date-field-filter';
import buildEnumArrayFieldFilter from './build-enum-array-field-filter';
import buildEnumFieldFilter from './build-enum-field-filter';
import buildNumberArrayFieldFilter from './build-number-array-field-filter';
import buildNumberFieldFilter from './build-number-field-filter';
import buildStringArrayFieldFilter from './build-string-array-field-filter';
import buildStringFieldFilter from './build-string-field-filter';
import buildUuidFieldFilter from './build-uuid-field-filter';

function generateDefaultCondition(isNegated: boolean): ConditionTree {
  return isNegated ? ConditionTreeFactory.MatchAll : ConditionTreeFactory.MatchNone;
}

function isArrayOf(columnType: ColumnType, testedType: PrimitiveTypes): boolean {
  return Array.isArray(columnType) && columnType[0] === testedType;
}

export default function buildFieldFilter(
  caller: Caller,
  field: string,
  schema: ColumnSchema,
  searchString: string,
  isNegated: boolean,
): ConditionTree {
  const { columnType, filterOperators } = schema;

  if (searchString === 'NULL') {
    if (!isNegated && filterOperators?.has('Missing')) {
      return new ConditionTreeLeaf(field, 'Missing');
    }

    if (isNegated && filterOperators?.has('Present')) {
      return new ConditionTreeLeaf(field, 'Present');
    }

    return generateDefaultCondition(isNegated);
  }

  switch (true) {
    case columnType === 'Number':
      return buildNumberFieldFilter(field, filterOperators, searchString, isNegated);
    case isArrayOf(columnType, 'Number'):
      return buildNumberArrayFieldFilter(field, filterOperators, searchString, isNegated);
    case columnType === 'Enum':
      return buildEnumFieldFilter(field, schema, searchString, isNegated);
    case isArrayOf(columnType, 'Enum'):
      return buildEnumArrayFieldFilter(field, schema, searchString, isNegated);
    case columnType === 'String':
      return buildStringFieldFilter(field, filterOperators, searchString, isNegated);
    case isArrayOf(columnType, 'String'):
      return buildStringArrayFieldFilter(field, filterOperators, searchString, isNegated);
    case columnType === 'Boolean':
      return buildBooleanFieldFilter(field, filterOperators, searchString, isNegated);
    case columnType === 'Uuid':
      return buildUuidFieldFilter(field, filterOperators, searchString, isNegated);
    case columnType === 'Date':
    case columnType === 'Dateonly':
      return buildDateFieldFilter({
        field,
        filterOperators,
        searchString,
        isNegated,
        columnType,
        timezone: caller.timezone,
      });
    default:
      return generateDefaultCondition(isNegated);
  }
}
