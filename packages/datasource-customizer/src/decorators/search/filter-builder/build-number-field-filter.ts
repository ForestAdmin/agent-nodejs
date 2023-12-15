/* eslint-disable no-continue */
import {
  ConditionTree,
  ConditionTreeFactory,
  ConditionTreeLeaf,
  Operator,
} from '@forestadmin/datasource-toolkit';

const supportedOperators: [string, Operator[], Operator[]][] = [
  ['', ['Equal'], ['NotEqual', 'Blank']],
  ['>', ['GreaterThan'], ['LessThan', 'Equal', 'Blank']],
  ['>=', ['GreaterThan', 'Equal'], ['LessThan', 'Blank']],
  ['<', ['LessThan'], ['GreaterThan', 'Equal', 'Blank']],
  ['<=', ['LessThan', 'Equal'], ['GreaterThan', 'Blank']],
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

    // If blank is not supported, we try to build a condition tree anyway
    if (!operators.filter(op => op !== 'Blank').every(operator => filterOperators.has(operator)))
      continue;

    return ConditionTreeFactory.union(
      ...operators
        .filter(operator => filterOperators.has(operator))
        .map(operator => new ConditionTreeLeaf(field, operator, value)),
    );
  }

  return null;
}
