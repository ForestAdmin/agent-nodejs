/* eslint-disable no-continue */
import type { ConditionTree, Operator } from '@forestadmin/datasource-toolkit';

import { ConditionTreeFactory, ConditionTreeLeaf } from '@forestadmin/datasource-toolkit';

import buildDefaultCondition from './utils/build-default-condition';

const supportedOperators: [string, Operator[], Operator[]][] = [
  ['', ['Equal'], ['NotEqual', 'Missing']],
  ['=', ['Equal'], ['NotEqual', 'Missing']],
  ['!=', ['NotEqual'], ['Equal', 'Missing']],
  ['<>', ['NotEqual'], ['Equal', 'Missing']],
  ['>', ['GreaterThan'], ['LessThan', 'Equal', 'Missing']],
  ['>=', ['GreaterThan', 'Equal'], ['LessThan', 'Missing']],
  ['≥', ['GreaterThan', 'Equal'], ['LessThan', 'Missing']],
  ['<', ['LessThan'], ['GreaterThan', 'Equal', 'Missing']],
  ['<=', ['LessThan', 'Equal'], ['GreaterThan', 'Missing']],
  ['≤', ['LessThan', 'Equal'], ['GreaterThan', 'Missing']],
];

export default function buildNumberFieldFilter(
  field: string,
  filterOperators: Set<Operator>,
  searchString: string,
  isNegated: boolean,
): ConditionTree {
  for (const [operatorPrefix, positiveOperators, negativeOperators] of supportedOperators) {
    if (operatorPrefix && !searchString.startsWith(operatorPrefix)) continue;
    if (Number.isNaN(Number(searchString.slice(operatorPrefix.length)))) continue;

    const value = Number(searchString.slice(operatorPrefix.length));
    const operators = isNegated ? negativeOperators : positiveOperators;

    // If Missing is not supported, we try to build a condition tree anyway
    if (
      !operators.filter(op => op !== 'Missing').every(operator => filterOperators.has(operator))
    ) {
      continue;
    }

    return ConditionTreeFactory.union(
      ...operators
        .filter(operator => filterOperators.has(operator))
        .map(
          operator =>
            new ConditionTreeLeaf(field, operator, operator !== 'Missing' ? value : undefined),
        ),
    );
  }

  return buildDefaultCondition(isNegated);
}
