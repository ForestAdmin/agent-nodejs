import { Op } from 'sequelize';
import {
  Aggregator,
  ConditionTree,
  ConditionTreeBranch,
  ConditionTreeLeaf,
  ConditionTreeNot,
  constants,
  Filter,
  Operator,
  PaginatedFilter,
} from '@forestadmin/datasource-toolkit';

const { QUERY_PAGE_DEFAULT_LIMIT, QUERY_PAGE_DEFAULT_SKIP } = constants;

function makeWhereClause(operator: Operator, value?) {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function convertConditionTreeToSequelize(conditionTree: ConditionTree): any {
  const sequelizeWhereClause = {};

  if ((conditionTree as ConditionTreeBranch).aggregator !== undefined) {
    const { aggregator, conditions } = conditionTree as ConditionTreeBranch;

    if (aggregator === null) {
      throw new Error('Invalid (null) aggregator.');
    }

    const sequelizeOperator = aggregator === Aggregator.And ? Op.and : Op.or;

    if (!Array.isArray(conditions) || conditions.length < 2) {
      throw new Error('Two or more conditions needed for aggregation.');
    }

    // FIXME: Update Prettier/Eslint config to remove use of prettier-ignore
    // prettier-ignore
    sequelizeWhereClause[sequelizeOperator] = conditions.map(
      condition => convertConditionTreeToSequelize(condition),
    );
  } else if ((conditionTree as ConditionTreeNot).condition !== undefined) {
    const { condition } = conditionTree as ConditionTreeNot;

    if (condition === null) {
      throw new Error('Invalid (null) condition.');
    }

    sequelizeWhereClause[Op.not] = convertConditionTreeToSequelize(
      (conditionTree as ConditionTreeNot).condition,
    );
  } else if ((conditionTree as ConditionTreeLeaf).operator !== undefined) {
    const { field, operator, value } = conditionTree as ConditionTreeLeaf;

    sequelizeWhereClause[field] = makeWhereClause(operator, value);
  } else {
    throw new Error('Invalid ConditionTree.');
  }

  return sequelizeWhereClause;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function convertFilterToSequelize(filter: Filter): any {
  if (!filter) {
    throw new Error('Invalid (null) filter.');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sequelizeFilter: any = {};

  if (filter.conditionTree) {
    sequelizeFilter.where = convertConditionTreeToSequelize(filter.conditionTree);
  }

  // TODO: Handle `search`
  // TODO: Handle `searchExtended`
  // TODO: Handle `segment`
  // TODO: Handle `timezone`

  return sequelizeFilter;
}

export function convertPaginatedFilterToSequelize(filter: PaginatedFilter) {
  const sequelizeFilter = convertFilterToSequelize(filter);

  // TODO: Get default `page.{limit,skip}` from constants in toolkit.
  const pageLimit = filter.page?.limit ?? QUERY_PAGE_DEFAULT_LIMIT;
  const pageOffset = filter.page?.skip ?? QUERY_PAGE_DEFAULT_SKIP;

  if (pageLimit !== null) sequelizeFilter.limit = pageLimit;
  if (pageOffset !== null) sequelizeFilter.offset = pageOffset;

  const order = filter.sort?.map(value => [
    value.field,
    value.ascending === false ? 'DESC' : 'ASC',
  ]);

  if (Array.isArray(order) && order.length > 0) sequelizeFilter.order = order;

  return sequelizeFilter;
}
