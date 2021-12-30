import { Op } from 'sequelize';

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

function convertOperatorToSequelize(operator: Operator): symbol {
  // FIXME: Handle proper mapping.
  void operator;

  return Op.eq;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function convertConditionTreeToSequelize(conditionTree: ConditionTree): any {
  const sequelizeWhereClause = {};

  if ((conditionTree as ConditionTreeBranch).aggregator) {
    const { aggregator, conditions } = conditionTree as ConditionTreeBranch;
    const sequelizeOperator = aggregator === Aggregator.And ? Op.and : Op.or;

    // FIXME: Update Prettier/Eslint config to remove use of prettier-ignore
    // prettier-ignore
    sequelizeWhereClause[sequelizeOperator] = conditions.map(
      condition => convertConditionTreeToSequelize(condition),
    );
  } else if ((conditionTree as ConditionTreeNot).condition) {
    sequelizeWhereClause[Op.not] = convertConditionTreeToSequelize(
      (conditionTree as ConditionTreeNot).condition,
    );
  } else if ((conditionTree as ConditionTreeLeaf).operator) {
    // FIXME: Cannot express filter like `field: {[Op.or]: { [Op.lt]: 1000, [Op.eq]: null } }`
    const { field, operator, value } = conditionTree as ConditionTreeLeaf;

    sequelizeWhereClause[field] = {
      [convertOperatorToSequelize(operator)]: value,
    };
  } else {
    throw new Error('Invalid ConditionTree.');
  }

  return sequelizeWhereClause;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function convertFilterToSequelize(filter: Filter): any {
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
  const pageLimit = filter.page?.limit ?? 10;
  const pageOffset = filter.page?.skip ?? 0;
  if (pageLimit !== null) sequelizeFilter.limit = pageLimit;
  if (pageOffset !== null) sequelizeFilter.offset = pageOffset;

  const order = filter.sort?.map(value => [
    value.field,
    value.ascending === false ? 'DESC' : 'ASC',
  ]);
  if (Array.isArray(order) && order.length > 0) sequelizeFilter.order = order;

  return sequelizeFilter;
}
