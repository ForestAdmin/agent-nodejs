import {
  ConditionTree,
  ConditionTreeBranch,
  ConditionTreeFactory,
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
  private model: ModelDefined<unknown, unknown>;

  constructor(model: ModelDefined<unknown, unknown>) {
    this.model = model;
  }

  private asArray(value: unknown) {
    if (!Array.isArray(value)) return [value];

    return value;
  }

  private makeWhereClause(
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

  /*
   * Delete and update sequelize methods does not provide the include options.
   * This method is developed to by pass this problem.
   */
  async getWhereFromConditionTreeToByPassInclude(
    conditionTree?: ConditionTree,
  ): Promise<WhereOptions> {
    const include = conditionTree ? this.getIncludeFromProjection(conditionTree.projection) : [];
    const whereOptions = this.getWhereFromConditionTree(conditionTree);

    if (include.length === 0) {
      return whereOptions;
    }

    const keys = [...this.model.primaryKeyAttributes];
    const records = await this.model.findAll({ attributes: keys, where: whereOptions, include });
    const conditions = records.map(record => {
      const equals = keys.map(pk => new ConditionTreeLeaf(pk, 'Equal', record.get(pk)));

      return ConditionTreeFactory.intersect(...equals);
    });

    const union = ConditionTreeFactory.union(...conditions);

    return this.getWhereFromConditionTree(union);
  }

  getWhereFromConditionTree(conditionTree?: ConditionTree): WhereOptions {
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
        this.getWhereFromConditionTree(condition),
      );
    } else if ((conditionTree as ConditionTreeLeaf).operator !== undefined) {
      const { field, operator, value } = conditionTree as ConditionTreeLeaf;
      const isRelation = field.includes(':');

      let safeField: string;

      if (isRelation) {
        const paths = field.split(':');
        const fieldName = paths.pop();
        const safeFieldName = paths
          .reduce((acc, path) => acc.associations[path].target, this.model)
          .getAttributes()[fieldName].field;
        safeField = `${paths.join('.')}.${safeFieldName}`;
      } else {
        safeField = this.model.getAttributes()[field].field;
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

  private computeIncludeFromProjection(
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

  getIncludeFromProjection(projection: Projection): IncludeOptions[] {
    return this.computeIncludeFromProjection(projection, false);
  }

  getIncludeWithAttributesFromProjection(projection: Projection): IncludeOptions[] {
    return this.computeIncludeFromProjection(projection);
  }

  getOrderFromSort(sort: Sort): OrderItem[] {
    return (sort ?? []).map(({ field, ascending }): OrderItem => {
      const path = field.split(':') as [string];

      return [...path, ascending ? 'ASC' : 'DESC'];
    });
  }
}
