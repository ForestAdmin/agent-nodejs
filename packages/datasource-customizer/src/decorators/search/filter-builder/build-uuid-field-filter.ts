import {
  ConditionTree,
  ConditionTreeFactory,
  ConditionTreeLeaf,
  Operator,
} from '@forestadmin/datasource-toolkit';
import { validate as uuidValidate } from 'uuid';

export default function buildUuidFieldFilter(
  field: string,
  filterOperators: Set<Operator>,
  searchString: string,
  isNegated: boolean,
): ConditionTree {
  const defaultCondition = isNegated
    ? ConditionTreeFactory.MatchAll
    : ConditionTreeFactory.MatchNone;

  if (!uuidValidate(searchString)) return defaultCondition;

  if (!isNegated && filterOperators?.has('Equal')) {
    return new ConditionTreeLeaf(field, 'Equal', searchString);
  }

  if (isNegated && filterOperators?.has('NotEqual') && filterOperators?.has('Missing')) {
    return ConditionTreeFactory.union(
      new ConditionTreeLeaf(field, 'NotEqual', searchString),
      new ConditionTreeLeaf(field, 'Missing'),
    );
  }

  if (isNegated && filterOperators?.has('NotEqual')) {
    return new ConditionTreeLeaf(field, 'NotEqual', searchString);
  }

  return defaultCondition;
}
