import {
  ColumnSchema,
  ColumnType,
  ConditionTree,
  ConditionTreeFactory,
  ConditionTreeLeaf,
  PrimitiveTypes,
} from '@forestadmin/datasource-toolkit';

import buildBooleanFieldFilter from './build-boolean-field-filter';
import buildDateFieldFilter from './build-date-field-filter';
import buildEnumFieldFilter from './build-enum-field-filter';
import buildNumberFieldFilter from './build-number-field-filter';
import buildStringFieldFilter from './build-string-field-filter';
import buildUuidFieldFilter from './build-uuid-field-filter';

function generateDefaultCondition(isNegated: boolean): ConditionTree {
  return isNegated ? ConditionTreeFactory.MatchAll : ConditionTreeFactory.MatchNone;
}

function ofTypeOrArray(columnType: ColumnType, testedType: PrimitiveTypes): boolean {
  return columnType === testedType || (Array.isArray(columnType) && columnType[0] === testedType);
}

export default function buildFieldFilter(
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
    case ofTypeOrArray(columnType, 'Number'):
      return buildNumberFieldFilter(field, filterOperators, searchString, isNegated);
    case ofTypeOrArray(columnType, 'Enum'):
      return buildEnumFieldFilter(field, schema, searchString, isNegated);
    case ofTypeOrArray(columnType, 'String'):
    case ofTypeOrArray(columnType, 'Json'):
      return buildStringFieldFilter(field, filterOperators, searchString, isNegated);
    case ofTypeOrArray(columnType, 'Boolean'):
      return buildBooleanFieldFilter(field, filterOperators, searchString, isNegated);
    case ofTypeOrArray(columnType, 'Uuid'):
      return buildUuidFieldFilter(field, filterOperators, searchString, isNegated);
    case ofTypeOrArray(columnType, 'Date'):
    case ofTypeOrArray(columnType, 'Dateonly'):
      return buildDateFieldFilter(field, filterOperators, searchString, isNegated);
    default:
      return generateDefaultCondition(isNegated);
  }
}
