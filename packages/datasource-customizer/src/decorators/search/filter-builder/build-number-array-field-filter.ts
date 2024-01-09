import { ConditionTree } from '@forestadmin/datasource-toolkit';

import buildBasicArrayFieldFilter from './build-basic-array-field-filter';
import buildDefaultCondition from './utils/build-default-condition';

export default function buildNumberArrayFieldFilter(
  field: string,
  filterOperators: Set<string> | undefined,
  searchString: string,
  isNegated: boolean,
): ConditionTree {
  if (Number.isNaN(Number(searchString))) return buildDefaultCondition(isNegated);

  return buildBasicArrayFieldFilter(field, filterOperators, searchString, isNegated);
}
