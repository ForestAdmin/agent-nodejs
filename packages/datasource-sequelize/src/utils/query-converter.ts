import type {
  ConditionTree,
  ConditionTreeBranch,
  Operator,
  Sort,
} from '@forestadmin/datasource-toolkit';
import type {
  Dialect,
  IncludeOptions,
  ModelDefined,
  OrderItem,
  Sequelize,
  WhereOptions,
} from 'sequelize';

import {
  ConditionTreeFactory,
  ConditionTreeLeaf,
  Projection,
} from '@forestadmin/datasource-toolkit';
import { Op } from 'sequelize';

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
  private makeWhereClause(
    colName: string,
    field: string,
    operator: Operator,
    value: unknown,
  ): WhereOptions {
    switch (true) {
      // Presence
      case operator === 'Present':
        return { [colName]: { [Op.ne]: null } };
      case operator === 'Missing':
        return { [colName]: { [Op.is]: null } };

      // Equality
      case operator === 'Equal':
        return { [colName]: { [value !== null ? Op.eq : Op.is]: value } };
      case operator === 'NotEqual':
        return value === null
          ? { [colName]: { [Op.ne]: value } }
          : {
              [Op.or]: [{ [colName]: { [Op.ne]: value } }, { [colName]: { [Op.is]: null } }],
            };
      case operator === 'In':
        return this.makeInWhereClause(colName, field, value);
      case operator === 'NotIn':
        return this.makeNotInWhereClause(colName, field, value);

      // Orderables
      case operator === 'LessThan':
        return { [colName]: { [Op.lt]: value } };
      case operator === 'GreaterThan':
        return { [colName]: { [Op.gt]: value } };
      case operator === 'LessThanOrEqual':
        return { [colName]: { [Op.lte]: value } };
      case operator === 'GreaterThanOrEqual':
        return { [colName]: { [Op.gte]: value } };

      // Strings
      case operator === 'Like':
        return this.makeLikeWhereClause(colName, field, value as string, true, false);
      case operator === 'ILike':
        return this.makeLikeWhereClause(colName, field, value as string, false, false);
      case operator === 'NotContains':
        return this.makeLikeWhereClause(colName, field, `%${value}%`, true, true);
      case operator === 'NotIContains':
        return this.makeLikeWhereClause(colName, field, `%${value}%`, false, true);

      // Arrays
      case operator === 'IncludesAll' && this.dialect === 'postgres':
        return { [colName]: { [Op.contains]: Array.isArray(value) ? value : [value] } };
      case operator === 'IncludesNone' && this.dialect === 'postgres':
        return {
          [Op.or]: [
            { [colName]: { [Op.is]: null } },
            {
              [Op.and]: (Array.isArray(value) ? value : [value]).map(oneValue => ({
                [Op.not]: {
                  [colName]: { [Op.contains]: [oneValue] },
                },
              })),
            },
          ],
        };

      default:
        throw new Error(`Unsupported operator: "${operator}".`);
    }
  }

  private makeInWhereClause(colName: string, field: string, value: unknown): WhereOptions {
    const valueAsArray = value as unknown[];

    if (valueAsArray.length === 1) {
      return this.makeWhereClause(colName, field, 'Equal', valueAsArray[0]);
    }

    if (valueAsArray.includes(null)) {
      const valueAsArrayWithoutNull = valueAsArray.filter(v => v !== null);

      return {
        [Op.or]: [
          this.makeInWhereClause(colName, field, valueAsArrayWithoutNull),
          { [colName]: { [Op.is]: null } },
        ],
      };
    }

    return { [colName]: { [Op.in]: valueAsArray } };
  }

  private makeNotInWhereClause(colName: string, field: string, value: unknown): WhereOptions {
    const valueAsArray = value as unknown[];

    if (valueAsArray.includes(null)) {
      if (valueAsArray.length === 1) {
        return { [colName]: { [Op.ne]: null } };
      }

      const valueAsArrayWithoutNull = valueAsArray.filter(v => v !== null);

      return {
        [Op.and]: [
          { [colName]: { [Op.ne]: null } },
          ...valueAsArrayWithoutNull.map(v => ({
            [colName]: { [Op.ne]: v },
          })),
        ],
      };
    }

    if (valueAsArray.length === 1) {
      return {
        [Op.or]: [
          { [colName]: { [Op.is]: null } },
          ...valueAsArray.map(v => ({
            [colName]: { [Op.ne]: v },
          })),
        ],
      };
    }

    if (valueAsArray.length === 0) return { [colName]: { [Op.notIn]: [] } };

    return {
      [Op.or]: [{ [colName]: { [Op.notIn]: valueAsArray } }, { [colName]: { [Op.is]: null } }],
    };
  }

  private makeLikeWhereClause(
    colName: string,
    field: string,
    value: string,
    caseSensitive: boolean,
    not: boolean,
  ): WhereOptions {
    const op = not ? 'NOT LIKE' : 'LIKE';
    let condition: WhereOptions;

    // using safeField in fn that will be injected literally inside the query
    const safeField = unAmbigousField(this.model, field, true);

    if (caseSensitive) {
      if (this.dialect === 'sqlite') {
        const sqLiteOp = not ? 'NOT GLOB' : 'GLOB';

        condition = this.where(
          this.col(field),
          sqLiteOp,
          value.replace(/%/g, '*').replace(/_/g, '?'),
        );
      } else if (this.dialect === 'mysql' || this.dialect === 'mariadb') {
        condition = this.where(this.fn('BINARY', this.col(safeField)), op, value);
      } else {
        condition = { [colName]: { [not ? Op.notLike : Op.like]: value } };
      }

      // Case insensitive
    } else if (this.dialect === 'postgres') {
      condition = { [colName]: { [not ? Op.notILike : Op.iLike]: value } };
    } else if (
      this.dialect === 'mysql' ||
      this.dialect === 'mariadb' ||
      this.dialect === 'sqlite'
    ) {
      condition = { [colName]: { [not ? Op.notLike : Op.like]: value } };
    } else {
      condition = this.where(this.fn('LOWER', this.col(safeField)), op, value.toLocaleLowerCase());
    }

    return not ? { [Op.or]: [condition, { [colName]: { [Op.is]: null } }] } : condition;
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

    if ((conditionTree as ConditionTreeBranch).aggregator !== undefined) {
      const { aggregator, conditions } = conditionTree as ConditionTreeBranch;

      if (aggregator === null) {
        throw new Error('Invalid (null) aggregator.');
      }

      const sequelizeOperator = aggregator === 'And' ? Op.and : Op.or;

      if (!Array.isArray(conditions)) {
        throw new Error('Conditions must be an array.');
      }

      return {
        [sequelizeOperator]: conditions.map(condition => this.getWhereFromConditionTree(condition)),
      };
    }

    if ((conditionTree as ConditionTreeLeaf).operator !== undefined) {
      const { field, operator, value } = conditionTree as ConditionTreeLeaf;
      const isRelation = field.includes(':');

      const safeField = unAmbigousField(this.model, field);

      return this.makeWhereClause(
        isRelation ? `$${safeField}$` : safeField,
        safeField,
        operator,
        value,
      );
    }

    throw new Error('Invalid ConditionTree.');
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
