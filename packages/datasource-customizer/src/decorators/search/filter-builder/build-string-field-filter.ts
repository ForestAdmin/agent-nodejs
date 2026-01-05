/* eslint-disable no-continue */

import type { ConditionTree, Operator } from '@forestadmin/datasource-toolkit';

import { ConditionTreeFactory, ConditionTreeLeaf } from '@forestadmin/datasource-toolkit';

import buildDefaultCondition from './utils/build-default-condition';

const operatorsStack: [Operator[], Operator[]][] = [
  [['IContains'], ['NotIContains', 'Missing']],
  [['Contains'], ['NotContains', 'Missing']],
  [['Equal'], ['NotEqual', 'Missing']],
];

export default function buildStringFieldFilter(
  field: string,
  filterOperators: Set<Operator>,
  searchString: string,
  isNegated: boolean,
): ConditionTree {
  if (!searchString) {
    if (filterOperators.has('Equal') && !isNegated) {
      return new ConditionTreeLeaf(field, 'Equal', '');
    }

    if (filterOperators.has('NotEqual') && isNegated) {
      if (filterOperators.has('Missing')) {
        return ConditionTreeFactory.union(
          new ConditionTreeLeaf(field, 'NotEqual', ''),
          new ConditionTreeLeaf(field, 'Missing'),
        );
      }

      return new ConditionTreeLeaf(field, 'NotEqual', '');
    }

    return buildDefaultCondition(isNegated);
  }

  for (const [positiveOperators, negativeOperators] of operatorsStack) {
    const operators = isNegated ? negativeOperators : positiveOperators;

    const neededOperators = operators.filter(
      operator => operator !== 'Missing' || filterOperators.has(operator),
    );

    if (!neededOperators.every(operator => filterOperators.has(operator))) continue;

    return ConditionTreeFactory.union(
      ...neededOperators.map(
        operator =>
          new ConditionTreeLeaf(field, operator, operator !== 'Missing' ? searchString : undefined),
      ),
    );
  }

  return buildDefaultCondition(isNegated);
}
