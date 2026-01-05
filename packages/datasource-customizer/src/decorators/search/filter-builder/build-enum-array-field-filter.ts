import type { ColumnSchema, ConditionTree } from '@forestadmin/datasource-toolkit';

import buildBasicArrayFieldFilter from './build-basic-array-field-filter';
import buildDefaultCondition from './utils/build-default-condition';
import findEnumValue from './utils/find-enum-value';

export default function buildEnumArrayFieldFilter(
  field: string,
  schema: ColumnSchema,
  searchString: string,
  isNegated: boolean,
): ConditionTree {
  const enumValue = findEnumValue(searchString, schema);

  if (!enumValue) return buildDefaultCondition(isNegated);

  return buildBasicArrayFieldFilter(field, schema.filterOperators, enumValue, isNegated);
}
