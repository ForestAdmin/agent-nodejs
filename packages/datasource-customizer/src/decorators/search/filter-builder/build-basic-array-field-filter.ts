import {
  ConditionTree,
  ConditionTreeFactory,
  ConditionTreeLeaf,
} from '@forestadmin/datasource-toolkit';

import buildDefaultCondition from './utils/build-default-condition';

export default function buildBasicArrayFieldFilter(
  field: string,
  filterOperators: Set<string> | undefined,
  searchString: unknown,
  isNegated: boolean,
): ConditionTree {
  if (!isNegated) {
    if (filterOperators?.has('In')) {
      return new ConditionTreeLeaf(field, 'In', searchString);
    }
  } else if (filterOperators?.has('NotIn')) {
    if (filterOperators.has('NotIn') && filterOperators.has('Missing')) {
      return ConditionTreeFactory.union(
        new ConditionTreeLeaf(field, 'NotIn', searchString),
        new ConditionTreeLeaf(field, 'Missing'),
      );
    }

    if (filterOperators.has('NotIn')) {
      return new ConditionTreeLeaf(field, 'NotIn', searchString);
    }
  }

  return buildDefaultCondition(isNegated);
}
