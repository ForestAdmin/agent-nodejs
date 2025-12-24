import type { ConditionTree, Operator } from '@forestadmin/datasource-toolkit';

import { ConditionTreeFactory, ConditionTreeLeaf } from '@forestadmin/datasource-toolkit';

import buildDefaultCondition from './utils/build-default-condition';

export default function buildBooleanFieldFilter(
  field: string,
  filterOperators: Set<Operator>,
  searchString: string,
  isNegated: boolean,
): ConditionTree {
  const operator = isNegated ? 'NotEqual' : 'Equal';

  if (filterOperators?.has(operator)) {
    if (['true', '1'].includes(searchString?.toLowerCase())) {
      if (isNegated && filterOperators.has('Missing')) {
        return ConditionTreeFactory.union(
          new ConditionTreeLeaf(field, operator, true),
          new ConditionTreeLeaf(field, 'Missing', null),
        );
      }

      return new ConditionTreeLeaf(field, operator, true);
    }

    if (['false', '0'].includes(searchString?.toLowerCase())) {
      if (isNegated && filterOperators.has('Missing')) {
        return ConditionTreeFactory.union(
          new ConditionTreeLeaf(field, operator, false),
          new ConditionTreeLeaf(field, 'Missing', null),
        );
      }

      return new ConditionTreeLeaf(field, operator, false);
    }
  }

  return buildDefaultCondition(isNegated);
}
