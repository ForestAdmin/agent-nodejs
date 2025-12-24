import type { ColumnSchema, ConditionTree } from '@forestadmin/datasource-toolkit';

import { ConditionTreeFactory, ConditionTreeLeaf } from '@forestadmin/datasource-toolkit';

import buildDefaultCondition from './utils/build-default-condition';
import findEnumValue from './utils/find-enum-value';

export default function buildEnumFieldFilter(
  field: string,
  schema: ColumnSchema,
  searchString: string,
  isNegated: boolean,
): ConditionTree {
  const { filterOperators } = schema;
  const searchValue = findEnumValue(searchString, schema);

  if (!searchValue) return buildDefaultCondition(isNegated);

  if (filterOperators?.has('Equal') && !isNegated) {
    return new ConditionTreeLeaf(field, 'Equal', searchValue);
  }

  if (filterOperators?.has('NotEqual') && filterOperators?.has('Missing') && isNegated) {
    // In DBs, NULL values are not equal to anything, including NULL.
    return ConditionTreeFactory.union(
      new ConditionTreeLeaf(field, 'NotEqual', searchValue),
      new ConditionTreeLeaf(field, 'Missing'),
    );
  }

  if (filterOperators?.has('NotEqual') && isNegated) {
    return new ConditionTreeLeaf(field, 'NotEqual', searchValue);
  }

  return buildDefaultCondition(isNegated);
}
