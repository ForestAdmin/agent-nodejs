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
  if (!uuidValidate(searchString)) return null;

  if (!isNegated && filterOperators?.has('Equal')) {
    return new ConditionTreeLeaf(field, 'Equal', searchString);
  }

  if (isNegated && filterOperators?.has('NotEqual') && filterOperators?.has('Blank')) {
    return ConditionTreeFactory.union(
      new ConditionTreeLeaf(field, 'NotEqual', searchString),
      new ConditionTreeLeaf(field, 'Blank'),
    );
  }

  if (isNegated && filterOperators?.has('NotEqual')) {
    return new ConditionTreeLeaf(field, 'NotEqual', searchString);
  }

  return null;
}
