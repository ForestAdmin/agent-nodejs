import { FindOptions, Op, Order, OrOperator, WhereOperators, WhereOptions } from 'sequelize';
import {
  Aggregator,
  ConditionTree,
  ConditionTreeBranch,
  ConditionTreeLeaf,
  ConditionTreeNot,
  Filter,
  Operator,
  PaginatedFilter,
} from '@forestadmin/datasource-toolkit';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeWhereClause(operator: Operator, value?: any): WhereOperators | OrOperator {
  if (operator === null) throw new Error('Invalid (null) operator.');

  switch (operator) {
    case Operator.Blank:
      return { [Op.or]: [makeWhereClause(Operator.Missing), { [Op.eq]: '' }] };
    case Operator.Contains:
      return { [Op.iLike]: `%${value}%` };
    case Operator.EndsWith:
      return { [Op.iLike]: `%${value}` };
    case Operator.Equal:
      return { [Op.eq]: value };
    case Operator.GreaterThan:
      return { [Op.gt]: value };
    case Operator.In:
      return { [Op.in]: value };
    case Operator.IncludesAll:
      return { [Op.contains]: value };
    case Operator.LessThan:
      return { [Op.lt]: value };
    case Operator.Missing:
      return { [Op.is]: null };
    case Operator.NotContains:
      return { [Op.notILike]: `%${value}%` };
    case Operator.NotEqual:
      return { [Op.ne]: value };
    case Operator.NotIn:
      return { [Op.notIn]: value };
    case Operator.Present:
      return { [Op.not]: { [Op.is]: null } };
    case Operator.StartsWith:
      return { [Op.iLike]: `${value}%` };
    default:
      throw new Error(`Unsupported operator: "${operator}".`);
  }
}

function convertConditionTreeToSequelize(conditionTree: ConditionTree): WhereOptions {
  // @fixme
  // According to sequelize typing files, the 'not' handling in this function is not legal.

  // I'm disabling the compiler, but we should either open a PR on sequelize, or fix this
  // Good  { fieldName: { [Op.not]: { [Op.eq]: 1 } } }
  // Bad   { [Op.not]: { fieldName: { [Op.eq]: 1 } } }

  let sequelizeWhereClause: WhereOptions = null;

  if (conditionTree instanceof ConditionTreeBranch) {
    const { aggregator, conditions } = conditionTree;

    if (aggregator === null) {
      throw new Error('Invalid (null) aggregator.');
    }

    const sequelizeOperator = conditionTree.aggregator === Aggregator.And ? Op.and : Op.or;

    if (!Array.isArray(conditions) || conditions.length < 2) {
      throw new Error('Two or more conditions needed for aggregation.');
    }

    sequelizeWhereClause = {
      [sequelizeOperator]: conditions.map(condition => convertConditionTreeToSequelize(condition)),
    };
  } else if (conditionTree instanceof ConditionTreeNot) {
    const { condition } = conditionTree;

    if (condition === null) {
      throw new Error('Invalid (null) condition.');
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    sequelizeWhereClause = {
      [Op.not]: convertConditionTreeToSequelize(condition),
    };
  } else if (conditionTree instanceof ConditionTreeLeaf) {
    const { field, operator, value } = conditionTree;

    sequelizeWhereClause = {
      [field]: makeWhereClause(operator, value as number | string),
    };
  } else {
    throw new Error('Invalid ConditionTree.');
  }

  return sequelizeWhereClause;
}

export function convertFilterToSequelize(filter: Filter): FindOptions {
  if (!filter) {
    throw new Error('Invalid (null) filter.');
  }

  const sequelizeFilter: FindOptions = {};

  if (filter.conditionTree) {
    sequelizeFilter.where = convertConditionTreeToSequelize(filter.conditionTree);
  }

  // TODO: Handle `search`
  // TODO: Handle `searchExtended`
  // TODO: Handle `segment`
  // TODO: Handle `timezone`

  return sequelizeFilter;
}

export function convertPaginatedFilterToSequelize(filter: PaginatedFilter): FindOptions {
  const sequelizeFilter = convertFilterToSequelize(filter);

  const pageLimit = filter.page?.limit ?? null;
  const pageOffset = filter.page?.skip ?? null;

  if (pageLimit !== null) sequelizeFilter.limit = pageLimit;
  if (pageOffset !== null) sequelizeFilter.offset = pageOffset;

  const order: Order = filter.sort?.map(value => [
    value.field,
    value.ascending === false ? 'DESC' : 'ASC',
  ]);

  if (Array.isArray(order) && order.length > 0) sequelizeFilter.order = order;

  return sequelizeFilter;
}
