import {
  ConditionTree,
  ConditionTreeLeaf,
  Operator,
  ConditionTreeFactory,
} from '@forestadmin/datasource-toolkit';

export default function buildBooleanFieldFilter(
  field: string,
  filterOperators: Set<Operator>,
  searchString: string,
  isNegated: boolean,
): ConditionTree {
  const operator = isNegated ? 'NotEqual' : 'Equal';

  if (filterOperators?.has(operator)) {
    if (['true', '1'].includes(searchString?.toLowerCase())) {
      if (isNegated && filterOperators.has('Blank')) {
        return ConditionTreeFactory.union(
          new ConditionTreeLeaf(field, operator, true),
          new ConditionTreeLeaf(field, 'Blank', null),
        );
      }

      return new ConditionTreeLeaf(field, operator, true);
    }

    if (['false', '0'].includes(searchString?.toLowerCase())) {
      if (isNegated && filterOperators.has('Blank')) {
        return ConditionTreeFactory.union(
          new ConditionTreeLeaf(field, operator, false),
          new ConditionTreeLeaf(field, 'Blank', null),
        );
      }

      return new ConditionTreeLeaf(field, operator, false);
    }
  }

  return null;
}
