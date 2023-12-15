import {
  ColumnSchema,
  ConditionTree,
  ConditionTreeFactory,
  ConditionTreeLeaf,
  Operator,
} from '@forestadmin/datasource-toolkit';
import { validate as uuidValidate } from 'uuid';
import buildBooleanFieldFilter from './build-boolean-field-filter';
import buildNumberFieldFilter from './build-number-field-filter';
import buildStringFieldFilter from './build-string-field-filter';

function lenientFind(haystack: string[], needle: string): string {
  return (
    haystack?.find(v => v === needle.trim()) ??
    haystack?.find(v => v.toLocaleLowerCase() === needle.toLocaleLowerCase().trim())
  );
}

export default function buildEnumFieldFilter(
  field: string,
  schema: ColumnSchema,
  searchString: string,
  isNegated: boolean,
): ConditionTree {
  const { enumValues, filterOperators } = schema;
  const searchValue = lenientFind(enumValues, searchString);

  if (!searchValue) return null;

  if (filterOperators?.has('Equal') && !isNegated) {
    return new ConditionTreeLeaf(field, 'Equal', searchValue);
  }

  if (filterOperators?.has('NotEqual') && filterOperators?.has('Blank') && isNegated) {
    // In DBs, NULL values are not equal to anything, including NULL.
    return ConditionTreeFactory.union(
      new ConditionTreeLeaf(field, 'NotEqual', searchValue),
      new ConditionTreeLeaf(field, 'Blank'),
    );
  }

  if (filterOperators?.has('NotEqual') && isNegated) {
    return new ConditionTreeLeaf(field, 'NotEqual', searchValue);
  }

  return null;
}
