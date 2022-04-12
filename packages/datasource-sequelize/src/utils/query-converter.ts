import {
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
import { Where } from 'sequelize/types/utils';

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
      case 'Blank':
        return {
          [Op.or]: [this.makeWhereClause('Missing', field) as OrOperator, { [Op.eq]: '' }],
        };
      case 'Contains':
        return where(fn('LOWER', col(field)), 'LIKE', `%${value.toLocaleLowerCase()}%`);
      case 'EndsWith':
        return where(fn('LOWER', col(field)), 'LIKE', `%${value.toLocaleLowerCase()}`);
      case 'Equal':
        return { [Op.eq]: value };
      case 'GreaterThan':
        return { [Op.gt]: value };
      case 'In':
        return { [Op.in]: this.asArray(value) };
      case 'IncludesAll':
        return { [Op.contains]: this.asArray(value) };
      case 'LessThan':
        return { [Op.lt]: value };
      case 'Missing':
        return { [Op.is]: null };
      case 'NotContains':
        return where(fn('LOWER', col(field)), 'NOT LIKE', `%${value.toLocaleLowerCase()}%`);
      case 'NotEqual':
        return { [Op.ne]: value };
      case 'NotIn':
        return { [Op.notIn]: this.asArray(value) };
      case 'Present':
        return { [Op.ne]: null };
      case 'StartsWith':
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

      const sequelizeOperator = aggregator === 'And' ? Op.and : Op.or;

      if (!Array.isArray(conditions)) {
        throw new Error('Conditions must be an array.');
      }

      sequelizeWhereClause[sequelizeOperator] = conditions.map(condition =>
        this.getWhereFromConditionTree(model, condition),
      );
    } else if ((conditionTree as ConditionTreeLeaf).operator !== undefined) {
      const { field, operator, value } = conditionTree as ConditionTreeLeaf;
      const isRelation = field.includes(':');

      let safeField: string;

      if (isRelation) {
        const paths = field.split(':');
        const fieldName = paths.pop();
        const safeFieldName = paths
          .reduce((acc, path) => acc.associations[path].target, model)
          .getAttributes()[fieldName].field;
        safeField = `${paths.join('.')}.${safeFieldName}`;
      } else {
        safeField = model.getAttributes()[field].field;
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
