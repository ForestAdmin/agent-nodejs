import {
  ConditionTree,
  ConditionTreeFactory,
  ConditionTreeLeaf,
  Operator,
} from '@forestadmin/datasource-toolkit';

export default function buildStringFieldFilter(
  field: string,
  filterOperators: Set<Operator>,
  searchString: string,
  isNegated: boolean,
): ConditionTree {
  const isCaseSensitive = searchString.toLocaleLowerCase() !== searchString.toLocaleUpperCase();

  const iContainsOperator = isNegated ? 'NotIContains' : 'IContains';
  const supportsIContains = filterOperators?.has(iContainsOperator);

  const containsOperator = isNegated ? 'NotContains' : 'Contains';
  const supportsContains = filterOperators?.has(containsOperator);

  const equalOperator = isNegated ? 'NotEqual' : 'Equal';
  const supportsEqual = filterOperators?.has('Equal');

  // Perf: don't use case-insensitive operator when the search string is indifferent to case
  let operator: Operator;
  if (supportsIContains && (isCaseSensitive || !supportsContains) && searchString)
    operator = iContainsOperator;
  else if (supportsContains && searchString) operator = containsOperator;
  else if (supportsEqual) operator = equalOperator;

  if (operator) {
    if (isNegated && filterOperators.has('Blank')) {
      return ConditionTreeFactory.union(
        new ConditionTreeLeaf(field, operator, searchString),
        new ConditionTreeLeaf(field, 'Blank', null),
      );
    }

    return new ConditionTreeLeaf(field, operator, searchString);
  }

  return null;
}
