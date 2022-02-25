import {
  Aggregator,
  ConditionTree,
  ConditionTreeBranch,
  ConditionTreeLeaf,
  ConditionTreeNot,
  Operator,
  Projection,
  Sort,
} from '@forestadmin/datasource-toolkit';
import {
  IncludeOptions,
  ModelDefined,
  Op,
  OrOperator,
  OrderItem,
  WhereOperators,
  WhereOptions,
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

  public static getWhereFromConditionTree(
    conditionTree: ConditionTree,
    model: ModelDefined<any, any>,
  ): WhereOptions {
    const sequelizeWhereClause = {};

    if ((conditionTree as ConditionTreeBranch)?.aggregator !== undefined) {
      const { aggregator, conditions } = conditionTree as ConditionTreeBranch;

      if (aggregator === null) {
        throw new Error('Invalid (null) aggregator.');
      }

      const sequelizeOperator = aggregator === Aggregator.And ? Op.and : Op.or;

      if (!Array.isArray(conditions) || conditions.length < 2) {
        throw new Error('Two or more conditions needed for aggregation.');
      }

      sequelizeWhereClause[sequelizeOperator] = conditions.map(condition =>
        this.getWhereFromConditionTree(condition, model),
      );
    } else if ((conditionTree as ConditionTreeNot).condition !== undefined) {
      const { condition } = conditionTree as ConditionTreeNot;

      if (condition === null) {
        throw new Error('Invalid (null) condition.');
      }

      sequelizeWhereClause[Op.not] = this.getWhereFromConditionTree(
        (conditionTree as ConditionTreeNot).condition,
        model,
      );
    } else if ((conditionTree as ConditionTreeLeaf)?.operator !== undefined) {
      const { field, operator, value } = conditionTree as ConditionTreeLeaf;

      let safeField = field;

      if (field.includes(':')) {
        const paths = field.split(':');
        const fieldName = paths.pop();
        const safeFieldName = paths
          .reduce((acc, path) => acc.associations[path].target, model)
          .getAttributes()[fieldName].field;
        safeField = `$${paths.join('.')}.${safeFieldName}$`;
      }

      sequelizeWhereClause[safeField] = this.makeWhereClause(operator, value);
    } else {
      throw new Error('Invalid ConditionTree.');
    }

    return sequelizeWhereClause;
  }

  static getIncludeAndAttributesFromProjection(projection: Projection): {
    include: IncludeOptions[];
    includeAttributes: string[];
  } {
    const include: IncludeOptions[] = [];
    let includeAttributes: string[] = [];

    Object.entries(projection.relations).forEach(([relationName, relationProjection]) => {
      let nestedInclude: IncludeOptions[] = [];
      let nestedIncludeAttributes: string[] = [];

      if (Object.keys(relationProjection.relations).length) {
        ({ include: nestedInclude, includeAttributes: nestedIncludeAttributes } =
          this.getIncludeAndAttributesFromProjection(relationProjection));
      }

      include.push({
        association: relationName,
        include: nestedInclude,
      });
      includeAttributes = includeAttributes.concat(
        relationProjection.nest(relationName).columns,
        nestedIncludeAttributes,
      );
    });

    return { include, includeAttributes };
  }

  static getOrderFromSort(sort: Sort): OrderItem[] {
    return (sort ?? []).map(({ field, ascending }): OrderItem => {
      const path = field.split(':') as [string];

      return [...path, ascending ? 'ASC' : 'DESC'];
    });
  }
}
