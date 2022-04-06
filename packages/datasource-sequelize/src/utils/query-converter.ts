import {
  Aggregator,
  ConditionTree,
  ConditionTreeBranch,
  ConditionTreeLeaf,
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
  col,
  fn,
  where,
} from 'sequelize';
import { Where } from 'sequelize/dist/lib/utils';

export default class QueryConverter {
  private static asArray(value: unknown) {
    if (!Array.isArray(value)) return [value];

    return value;
  }

  private static makeWhereClause(
    operator: Operator,
    field: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value?: any,
  ): WhereOperators | OrOperator | Where {
    if (operator === null) throw new Error('Invalid (null) operator.');

    switch (operator) {
      case Operator.Blank:
        return {
          [Op.or]: [this.makeWhereClause(Operator.Missing, field) as OrOperator, { [Op.eq]: '' }],
        };
      case Operator.Contains:
        return where(fn('LOWER', col(field)), 'LIKE', `%${value.toLocaleLowerCase()}%`);
      case Operator.EndsWith:
        return where(fn('LOWER', col(field)), 'LIKE', `%${value.toLocaleLowerCase()}`);
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
        return where(fn('LOWER', col(field)), 'NOT LIKE', `%${value.toLocaleLowerCase()}%`);
      case Operator.NotEqual:
        return { [Op.ne]: value };
      case Operator.NotIn:
        return { [Op.notIn]: this.asArray(value) };
      case Operator.Present:
        return { [Op.ne]: null };
      case Operator.StartsWith:
        return where(fn('LOWER', col(field)), 'LIKE', `${value.toLocaleLowerCase()}%`);
      default:
        throw new Error(`Unsupported operator: "${operator}".`);
    }
  }

  static getWhereFromConditionTree(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: ModelDefined<any, any>,
    conditionTree?: ConditionTree,
  ): WhereOptions {
    if (!conditionTree) return {};

    const sequelizeWhereClause = {};

    if ((conditionTree as ConditionTreeBranch).aggregator !== undefined) {
      const { aggregator, conditions } = conditionTree as ConditionTreeBranch;

      if (aggregator === null) {
        throw new Error('Invalid (null) aggregator.');
      }

      const sequelizeOperator = aggregator === Aggregator.And ? Op.and : Op.or;

      if (!Array.isArray(conditions)) {
        throw new Error('Conditions must be an array.');
      }

      sequelizeWhereClause[sequelizeOperator] = conditions.map(condition =>
        this.getWhereFromConditionTree(model, condition),
      );
    } else if ((conditionTree as ConditionTreeLeaf).operator !== undefined) {
      const { field, operator, value } = conditionTree as ConditionTreeLeaf;
      const isRelation = field.includes(':');

      let safeField = field;

      if (isRelation) {
        const paths = field.split(':');
        const fieldName = paths.pop();
        const safeFieldName = paths
          .reduce((acc, path) => acc.associations[path].target, model)
          .getAttributes()[fieldName].field;
        safeField = `${paths.join('.')}.${safeFieldName}`;
      }

      sequelizeWhereClause[isRelation ? `$${safeField}$` : safeField] = this.makeWhereClause(
        operator,
        safeField,
        value,
      );
    } else {
      throw new Error('Invalid ConditionTree.');
    }

    return sequelizeWhereClause;
  }

  private static computeIncludeFromProjection(
    projection: Projection,
    withAttributes = true,
  ): IncludeOptions[] {
    return Object.entries(projection.relations).map(([relationName, relationProjection]) => {
      return {
        association: relationName,
        attributes: withAttributes ? relationProjection.columns : [],
        include: this.computeIncludeFromProjection(relationProjection, withAttributes),
      };
    });
  }

  static getIncludeFromProjection(projection: Projection): IncludeOptions[] {
    return this.computeIncludeFromProjection(projection, false);
  }

  static getIncludeWithAttributesFromProjection(projection: Projection): IncludeOptions[] {
    return this.computeIncludeFromProjection(projection);
  }

  static getOrderFromSort(sort: Sort): OrderItem[] {
    return (sort ?? []).map(({ field, ascending }): OrderItem => {
      const path = field.split(':') as [string];

      return [...path, ascending ? 'ASC' : 'DESC'];
    });
  }
}
