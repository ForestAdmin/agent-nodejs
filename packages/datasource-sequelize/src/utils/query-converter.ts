import {
  Aggregator,
  ConditionTree,
  ConditionTreeBranch,
  ConditionTreeLeaf,
  ConditionTreeNot,
  Filter,
  Operator,
  PaginatedFilter,
  Projection,
} from '@forestadmin/datasource-toolkit';
import {
  FindOptions,
  IncludeOptions,
  Op,
  OrOperator,
  Order,
  WhereOperators,
  WhereOptions,
  col,
} from 'sequelize';

export default class QueryConverter {
  private static asArray(value: unknown) {
    if (!Array.isArray(value)) return [value];

    return value;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static makeWhereClause(operator: Operator, value?: any): WhereOperators | OrOperator {
    if (operator === null) throw new Error('Invalid (null) operator.');

    switch (operator) {
      case Operator.Blank:
        return { [Op.or]: [this.makeWhereClause(Operator.Missing), { [Op.eq]: '' }] };
      case Operator.Contains:
        return { [Op.like]: `%${value}%` };
      case Operator.EndsWith:
        return { [Op.like]: `%${value}` };
      case Operator.Equal:
        return { [Op.eq]: value };
      case Operator.GreaterThan:
        return { [Op.gt]: value };
      case Operator.In:
        return { [Op.in]: this.asArray(value) };
      case Operator.IncludesAll:
        return { [Op.contains]: this.asArray(value) };
      case Operator.LessThan:
        return { [Op.lt]: value };
      case Operator.Missing:
        return { [Op.is]: null };
      case Operator.NotContains:
        return { [Op.notILike]: `%${value}%` };
      case Operator.NotEqual:
        return { [Op.ne]: value };
      case Operator.NotIn:
        return { [Op.notIn]: this.asArray(value) };
      case Operator.Present:
        return { [Op.not]: { [Op.is]: null } };
      case Operator.StartsWith:
        return { [Op.like]: `${value}%` };
      default:
        throw new Error(`Unsupported operator: "${operator}".`);
    }
  }

  private static convertConditionTreeToSequelize(conditionTree: ConditionTree): WhereOptions {
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

      sequelizeWhereClause[sequelizeOperator] = conditions.map(condition =>
        this.convertConditionTreeToSequelize(condition),
      );
    } else if ((conditionTree as ConditionTreeNot).condition !== undefined) {
      const { condition } = conditionTree as ConditionTreeNot;

      if (condition === null) {
        throw new Error('Invalid (null) condition.');
      }

      sequelizeWhereClause[Op.not] = this.convertConditionTreeToSequelize(
        (conditionTree as ConditionTreeNot).condition,
      );
    } else if ((conditionTree as ConditionTreeLeaf).operator !== undefined) {
      const { field, operator, value } = conditionTree as ConditionTreeLeaf;

      const safeField = field.indexOf(':') === -1 ? field : `$${field.replace(':', '.')}$`;

      sequelizeWhereClause[safeField] = this.makeWhereClause(operator, value);
    } else {
      throw new Error('Invalid ConditionTree.');
    }

    return sequelizeWhereClause;
  }

  public static convertFilterToSequelize(filter: Filter): FindOptions {
    if (!filter) {
      throw new Error('Invalid (null) filter.');
    }

    const sequelizeFilter: FindOptions = {};

    if (filter.conditionTree) {
      sequelizeFilter.where = this.convertConditionTreeToSequelize(filter.conditionTree);
    }

    // TODO: Handle `search`
    // TODO: Handle `searchExtended`
    // TODO: Handle `segment`
    // TODO: Handle `timezone`

    return sequelizeFilter;
  }

  public static convertPaginatedFilterToSequelize(
    modelName: string,
    filter: PaginatedFilter,
  ): FindOptions {
    const sequelizeFilter = this.convertFilterToSequelize(filter);

    const pageLimit = filter.page?.limit ?? null;
    const pageOffset = filter.page?.skip ?? null;

    if (pageLimit !== null) sequelizeFilter.limit = pageLimit;
    if (pageOffset !== null) sequelizeFilter.offset = pageOffset;

    const order: Order = filter.sort?.map(({ field, ascending }) => [
      col(field.includes(':') ? field.replace(':', '.') : `${modelName}.${field}`),
      ascending === false ? 'DESC' : 'ASC',
    ]);

    if (Array.isArray(order) && order.length > 0) sequelizeFilter.order = order;

    return sequelizeFilter;
  }

  private static convertProjectionRelationsToSequelize(
    relations: Record<string, Projection>,
    withAttributes = true,
  ): IncludeOptions[] {
    const sequelizeInclude: IncludeOptions[] = [];

    Object.entries(relations).forEach(([key, relation]: [string, Projection]) => {
      sequelizeInclude.push({
        association: key,
        attributes: withAttributes ? relation.columns : [],
        include: this.convertProjectionRelationsToSequelize(relation.relations, withAttributes),
      });
    });

    return sequelizeInclude;
  }

  public static convertProjectionToSequelize(
    projection: Projection,
    withAttributes?: boolean,
  ): FindOptions {
    if (!projection) return {};

    return {
      attributes: projection.columns,
      include: this.convertProjectionRelationsToSequelize(projection.relations, withAttributes),
    };
  }
}
