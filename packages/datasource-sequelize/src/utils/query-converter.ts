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
  Dialect,
  IncludeOptions,
  ModelDefined,
  Op,
  OrderItem,
  Sequelize,
  WhereOptions,
} from 'sequelize';

import unAmbigousField from './un-ambigous';

export default class QueryConverter {
  private model: ModelDefined<unknown, unknown>;
  private dialect: Dialect;
  private col: Sequelize['col'];
  private fn: Sequelize['fn'];
  private where: Sequelize['where'];

  constructor(model: ModelDefined<unknown, unknown>) {
    this.model = model;
    this.dialect = this.model.sequelize.getDialect() as Dialect;
    this.col = this.model.sequelize.col;
    this.fn = this.model.sequelize.fn;
    this.where = this.model.sequelize.where;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private makeWhereClause(field: string, operator: Operator, value?: unknown): any {
    switch (operator) {
      // Presence
      case 'Present':
        return { [Op.ne]: null };
      case 'Missing':
        return { [Op.is]: null };

      // Equality
      case 'Equal':
        return { [value !== null ? Op.eq : Op.is]: value };
      case 'NotEqual':
        return { [Op.ne]: value };
      case 'In':
        return this.makeInWhereClause(field, value);
      case 'NotIn':
        return this.makeNotInWhereClause(field, value);

      // Orderables
      case 'LessThan':
        return { [Op.lt]: value };
      case 'GreaterThan':
        return { [Op.gt]: value };

      // Strings
      case 'Like':
        return this.makeLikeWhereClause(field, value as string, true, false);
      case 'ILike':
        return this.makeLikeWhereClause(field, value as string, false, false);
      case 'NotContains':
        return this.makeLikeWhereClause(field, `%${value}%`, true, true);
      case 'NotIContains':
        return this.makeLikeWhereClause(field, `%${value}%`, false, true);

      // Arrays
      case 'IncludesAll':
        return { [Op.contains]: Array.isArray(value) ? value : [value] };

      default:
        throw new Error(`Unsupported operator: "${operator}".`);
    }
  }

  private makeInWhereClause(field: string, value: unknown): unknown {
    const valueAsArray = value as unknown[];

    if (valueAsArray.length === 1) {
      return this.makeWhereClause(field, 'Equal', valueAsArray[0]);
    }

    if (valueAsArray.includes(null)) {
      const valueAsArrayWithoutNull = valueAsArray.filter(v => v !== null);

      return {
        [Op.or]: [this.makeInWhereClause(field, valueAsArrayWithoutNull), { [Op.is]: null }],
      };
    }

    return { [Op.in]: valueAsArray };
  }

  private makeNotInWhereClause(field: string, value: unknown): unknown {
    const valueAsArray = value as unknown[];

    if (valueAsArray.length === 1) {
      return this.makeWhereClause(field, 'NotEqual', valueAsArray[0]);
    }

    if (valueAsArray.includes(null)) {
      const valueAsArrayWithoutNull = valueAsArray.filter(v => v !== null);

      return {
        [Op.and]: [{ [Op.ne]: null }, this.makeNotInWhereClause(field, valueAsArrayWithoutNull)],
      };
    }

    return { [Op.notIn]: valueAsArray };
  }

  private makeLikeWhereClause(
    field: string,
    value: string,
    caseSensitive: boolean,
    not: boolean,
  ): unknown {
    const op = not ? 'NOT LIKE' : 'LIKE';

    if (caseSensitive) {
      if (this.dialect === 'sqlite') {
        const sqLiteOp = not ? 'NOT GLOB' : 'GLOB';

        return this.where(this.col(field), sqLiteOp, value.replace(/%/g, '*').replace(/_/g, '?'));
      }

      if (this.dialect === 'mysql' || this.dialect === 'mariadb')
        return this.where(this.fn('BINARY', this.col(field)), op, value);

      return not ? { [Op.or]: [{ [Op.notLike]: value }, { [Op.is]: null }] } : { [Op.like]: value };
    }

    // Case insensitive
    if (this.dialect === 'postgres')
      return not
        ? { [Op.or]: [{ [Op.notILike]: value }, { [Op.is]: null }] }
        : { [Op.iLike]: value };

    if (this.dialect === 'mysql' || this.dialect === 'mariadb' || this.dialect === 'sqlite')
      return not ? { [Op.or]: [{ [Op.notLike]: value }, { [Op.is]: null }] } : { [Op.like]: value };

    return this.where(this.fn('LOWER', this.col(field)), op, value.toLocaleLowerCase());
  }

  /*
   * Delete and update sequelize methods does not provide the include options.
   * This method is developed to by pass this problem.
   */
  async getWhereFromConditionTreeToByPassInclude(
    conditionTree?: ConditionTree,
  ): Promise<WhereOptions> {
    const include = conditionTree
      ? this.getIncludeFromProjection(new Projection(), conditionTree.projection)
      : [];
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

      const safeField = unAmbigousField(this.model, field);

      sequelizeWhereClause[isRelation ? `$${safeField}$` : safeField] = this.makeWhereClause(
        safeField,
        operator,
        value,
      );
    } else {
      throw new Error('Invalid ConditionTree.');
    }

    return sequelizeWhereClause;
  }

  getIncludeFromProjection(
    attrProjection: Projection,
    tableProjection: Projection = new Projection(),
  ): IncludeOptions[] {
    const projection = attrProjection.union(tableProjection);

    return Object.keys(projection.relations).map(name => {
      const relAttrProjection = attrProjection.relations[name] ?? new Projection();
      const relTableProjection = tableProjection.relations[name] ?? new Projection();

      return {
        association: name,
        attributes: relAttrProjection.columns,
        include: this.getIncludeFromProjection(relAttrProjection, relTableProjection),
      };
    });
  }

  getOrderFromSort(sort: Sort): OrderItem[] {
    return (sort ?? []).map(({ field, ascending }): OrderItem => {
      const path = field.split(':') as [string];

      return [...path, ascending ? 'ASC' : 'DESC'];
    });
  }
}
