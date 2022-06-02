import { AggregateResult, Aggregation, ValidationError } from '@forestadmin/datasource-toolkit';
import {
  Dialect,
  GroupOption,
  Model,
  ModelDefined,
  OrderItem,
  ProjectionAlias,
  col,
} from 'sequelize';
import { Fn } from 'sequelize/types/utils';

import DateAggregationConverter from './date-aggregation-converter';
import Serializer from './serializer';

export default class AggregationUtils {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private model: ModelDefined<any, any>;
  private dialect: Dialect;

  readonly aggregateFieldName = '__aggregate__';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(model: ModelDefined<any, any>) {
    this.model = model;
    this.dialect = this.model.sequelize.getDialect() as Dialect;
  }

  getGroupFieldName(groupField: string) {
    return `${groupField}__grouped__`;
  }

  unAmbigousField(field: string) {
    let tableName: string;
    let fieldName: string;

    if (field.includes(':')) {
      const [associationName, nestedField] = field.split(':');
      const association = this.model.associations[associationName];

      if (!association) {
        throw new ValidationError(
          `${this.model.name} model does not have association "${associationName}".`,
        );
      }

      const associationField = association.target.getAttributes()[nestedField];

      if (!associationField) {
        throw new ValidationError(`${associationName} model does not have field "${nestedField}".`);
      }

      tableName = associationName;
      fieldName = associationField.field;
    } else {
      const modelField = this.model.getAttributes()[field];

      if (!modelField) {
        throw new ValidationError(`${this.model.name} model does not have field "${field}".`);
      }

      tableName = this.model.name;
      fieldName = modelField.field;
    }

    return this.model.sequelize.getQueryInterface().quoteIdentifiers(`${tableName}.${fieldName}`);
  }

  getGroupAndAttributesFromAggregation(aggregationQueryGroup: Aggregation['groups']): {
    groups: GroupOption;
    attributes: ProjectionAlias[];
  } {
    const attributes = [];
    const groups = aggregationQueryGroup?.map(group => {
      const { field } = group;
      const groupFieldName = this.getGroupFieldName(field);
      const groupField = this.unAmbigousField(field);

      if (group.operation) {
        const groupFunction = DateAggregationConverter.convertToDialect(
          this.dialect,
          groupField,
          group.operation,
        );

        attributes.push([groupFunction, groupFieldName]);

        return this.dialect === 'mssql' ? groupFunction : groupFieldName;
      }

      attributes.push([col(groupField), groupFieldName]);

      return this.dialect === 'mssql' ? groupField : groupFieldName;
    });

    return { groups, attributes };
  }

  getOrder(aggregationFunction: Fn) {
    let order: OrderItem;

    // FIXME handle properly order
    switch (this.dialect) {
      case 'postgres':
        order = [col(this.aggregateFieldName), 'DESC NULLS LAST'];
        break;
      case 'mssql':
        order = [aggregationFunction, 'DESC'];
        break;
      default:
        order = [col(this.aggregateFieldName), 'DESC'];
    }

    return order;
  }

  computeResult(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rows: Model<any, any>[],
    aggregationQueryGroup: Aggregation['groups'],
  ): AggregateResult[] {
    return rows.map(aggregate => {
      const aggregateResult = {
        value: aggregate[this.aggregateFieldName] as number,
        group: {},
      };

      aggregationQueryGroup?.forEach(({ field }) => {
        aggregateResult.group[field] = Serializer.serializeValue(
          aggregate[this.getGroupFieldName(field)],
        );
      });

      return aggregateResult;
    });
  }
}
