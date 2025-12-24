import type { ConditionTree, Operator } from '@forestadmin/datasource-toolkit';

import { ConditionTreeFactory, ConditionTreeLeaf } from '@forestadmin/datasource-toolkit';

import buildDefaultCondition from './utils/build-default-condition';

export default function buildBasicArrayFieldFilter(
  field: string,
  filterOperators: Set<Operator> | undefined,
  searchString: unknown,
  isNegated: boolean,
): ConditionTree {
  if (!isNegated) {
    if (filterOperators?.has('IncludesAll')) {
      return new ConditionTreeLeaf(field, 'IncludesAll', searchString);
    }
  } else if (filterOperators?.has('IncludesNone')) {
    if (filterOperators.has('IncludesNone') && filterOperators.has('Missing')) {
      return ConditionTreeFactory.union(
        new ConditionTreeLeaf(field, 'IncludesNone', searchString),
        new ConditionTreeLeaf(field, 'Missing'),
      );
    }

    if (filterOperators.has('IncludesNone')) {
      return new ConditionTreeLeaf(field, 'IncludesNone', searchString);
    }
  }

  return buildDefaultCondition(isNegated);
}
