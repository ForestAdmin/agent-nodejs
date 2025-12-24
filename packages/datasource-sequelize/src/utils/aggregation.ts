import type { AggregateResult, Aggregation } from '@forestadmin/datasource-toolkit';
import type {
  Dialect,
  GroupOption,
  Model,
  ModelDefined,
  OrderItem,
  ProjectionAlias,
  Sequelize,
} from 'sequelize';
import type { Fn } from 'sequelize/types/utils';

import { ValidationError } from '@forestadmin/datasource-toolkit';

import DateAggregationConverter from './date-aggregation-converter';
import Serializer from './serializer';
import unAmbigousField from './un-ambigous';

export default class AggregationUtils {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private model: ModelDefined<any, any>;
  private dialect: Dialect;
  private col: Sequelize['col'];

  private dateAggregationConverter: DateAggregationConverter;

  readonly _aggregateFieldName = '__aggregate__';
  get aggregateFieldName() {
    if (
      (this.model.sequelize as unknown as { options: { minifyAliases: boolean } }).options
        .minifyAliases
    ) {
      // when minifyAliases, sequelize uses _0 as column name instead of __aggregate__
      // fixes https://app.clickup.com/t/86c04wd01
      return '_0';
    }

    return this._aggregateFieldName;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(model: ModelDefined<any, any>) {
    this.model = model;
    this.dialect = this.model.sequelize.getDialect() as Dialect;
    this.col = this.model.sequelize.col;

    this.dateAggregationConverter = new DateAggregationConverter(this.model.sequelize);
  }

  private getGroupFieldName(groupField: string) {
    return `${groupField}__grouped__`;
  }

  quoteField(field: string) {
    try {
      const safeField = unAmbigousField(this.model, field, true);

      return this.model.sequelize.getQueryInterface().quoteIdentifiers(safeField);
    } catch {
      throw new ValidationError(
        `Invalid access: "${field}" on "${this.model.name}" does not exist.`,
      );
    }
  }

  getGroupAndAttributesFromAggregation(aggregationQueryGroup: Aggregation['groups']): {
    groups: GroupOption;
    attributes: ProjectionAlias[];
  } {
    const attributes = [];
    const groups = aggregationQueryGroup?.map(group => {
      const { field } = group;
      const groupFieldName = this.getGroupFieldName(field);
      const groupField = this.quoteField(field);

      if (group.operation) {
        const groupFunction = this.dateAggregationConverter.convertToDialect(
          groupField,
          group.operation,
        );

        attributes.push([groupFunction, groupFieldName]);

        return this.dialect === 'mssql' ? groupFunction : groupFieldName;
      }

      attributes.push([this.col(groupField), groupFieldName]);

      return this.dialect === 'mssql' ? groupField : groupFieldName;
    });

    return { groups, attributes };
  }

  getOrder(aggregationFunction: Fn) {
    let order: OrderItem;

    // FIXME handle properly order
    switch (this.dialect) {
      case 'postgres':
        order = [this.col(this.aggregateFieldName), 'DESC NULLS LAST'];
        break;
      case 'mssql':
        order = [aggregationFunction, 'DESC'];
        break;
      default:
        order = [this.col(this.aggregateFieldName), 'DESC'];
    }

    return order;
  }

  computeResult(
    rows: Model<unknown, unknown>[],
    groups: Aggregation['groups'],
    expectsNumber: boolean,
  ): AggregateResult[] {
    return rows.map(row => {
      let value = row[this.aggregateFieldName];

      // Workaround Sequelize casting sums to strings.
      // This happens since sequelize@6.27.0 because sequelize implemented support for bigints.
      if (expectsNumber && typeof value === 'string' && !Number.isNaN(Number(value))) {
        value = Number(value);
      }

      return {
        value,
        group: (groups ?? []).reduce((memo, { field }) => {
          memo[field] = Serializer.serializeValue(row[this.getGroupFieldName(field)]);

          return memo;
        }, {}),
      };
    });
  }
}
