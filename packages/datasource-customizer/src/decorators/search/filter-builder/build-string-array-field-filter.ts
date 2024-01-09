import { ConditionTree } from '@forestadmin/datasource-toolkit';

import buildBasicArrayFieldFilter from './build-basic-array-field-filter';

export default function buildStringArrayFieldFilter(
  field: string,
  filterOperators: Set<string> | undefined,
  searchString: string,
  isNegated: boolean,
): ConditionTree {
  return buildBasicArrayFieldFilter(field, filterOperators, searchString, isNegated);
}
