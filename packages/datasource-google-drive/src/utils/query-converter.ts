import {
  ConditionTree,
  ConditionTreeBranch,
  ConditionTreeLeaf,
  Operator,
} from '@forestadmin/datasource-toolkit';

function makeWhereClause(field: string, operator: Operator, value?: unknown): string {
  switch (operator) {
    // Equality
    case 'Equal':
      return `${field} = '${value}'`;
    case 'NotEqual':
      return `${field} != '${value}'`;

    case 'In':
      return `'${value}' in ${field}`;
    case 'NotIn':
      return `not '${value}' in ${field}`;

    // Orderable
    case 'LessThan':
      return `${field} < '${value}'`;
    case 'GreaterThan':
      return `${field} > '${value}'`;

    // Strings
    case 'Like':
      return `${field} = '${value}'`;
    case 'ILike':
      return `${field} contains '${value}'`;
    case 'NotContains':
      return `not ${field} contains '${value}'`;

    // How to handle this ? Only with search could be power full ? @RomainG
    case 'Contains':
      return `fullText contains '${value}'`;

    default:
      throw new Error(`Unsupported operator: "${operator}".`);
  }
}

export default function queryStringFromConditionTree(conditionTree?: ConditionTree): string {
  if (!conditionTree) return '';

  let queryString = '';

  if ((conditionTree as ConditionTreeBranch).aggregator !== undefined) {
    const { aggregator, conditions } = conditionTree as ConditionTreeBranch;

    if (aggregator === null) {
      throw new Error('Invalid (null) aggregator.');
    }

    const operator = aggregator === 'And' ? 'and' : 'or';

    if (!Array.isArray(conditions)) {
      throw new Error('Conditions must be an array.');
    }

    queryString = conditions.reduce(
      // MB other way around `(${queryStringFromConditionTree(condition)}) ${operator} ${acc}`
      (acc, condition) => `${acc} ${operator} (${queryStringFromConditionTree(condition)})`,
      queryString,
    );
  } else if ((conditionTree as ConditionTreeLeaf).operator !== undefined) {
    const { field, operator, value } = conditionTree as ConditionTreeLeaf;

    queryString += makeWhereClause(field, operator, value);
  } else {
    throw new Error('Invalid ConditionTree.');
  }

  return queryString;
}
