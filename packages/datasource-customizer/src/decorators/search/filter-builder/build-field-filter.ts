import { ColumnSchema, ConditionTree, ConditionTreeLeaf } from '@forestadmin/datasource-toolkit';

import buildBooleanFieldFilter from './build-boolean-field-filter';
import buildDateFieldFilter from './build-date-field-filter';
import buildEnumFieldFilter from './build-enum-field-filter';
import buildNumberFieldFilter from './build-number-field-filter';
import buildStringFieldFilter from './build-string-field-filter';
import buildUuidFieldFilter from './build-uuid-field-filter';

export default function buildFieldFilter(
  field: string,
  schema: ColumnSchema,
  searchString: string,
  isNegated: boolean,
): ConditionTree {
  const { columnType, filterOperators } = schema;

  if (searchString === 'NULL' && filterOperators?.has('Blank')) {
    return new ConditionTreeLeaf(field, 'Blank');
  }

  switch (columnType) {
    case 'Number':
      return buildNumberFieldFilter(field, filterOperators, searchString, isNegated);
    case 'Enum':
      return buildEnumFieldFilter(field, schema, searchString, isNegated);
    case 'String':
    case 'Json':
      return buildStringFieldFilter(field, filterOperators, searchString, isNegated);
    case 'Boolean':
      return buildBooleanFieldFilter(field, filterOperators, searchString, isNegated);
    case 'Uuid':
      return buildUuidFieldFilter(field, filterOperators, searchString, isNegated);
    case 'Date':
    case 'Dateonly':
      return buildDateFieldFilter(field, filterOperators, searchString, isNegated);
    default:
      return null;
  }
}
