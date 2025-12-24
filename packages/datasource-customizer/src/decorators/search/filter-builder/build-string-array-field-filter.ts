import type { ConditionTree, Operator } from '@forestadmin/datasource-toolkit';

import buildBasicArrayFieldFilter from './build-basic-array-field-filter';

export default function buildStringArrayFieldFilter(
  field: string,
  filterOperators: Set<Operator> | undefined,
  searchString: string,
  isNegated: boolean,
): ConditionTree {
  return buildBasicArrayFieldFilter(field, filterOperators, searchString, isNegated);
}
