import { ModelAttributes, Sequelize } from 'sequelize';

import { FieldDescription } from './types';

export default class SequelizeModelFactory {
  static build(
    tableName: string,
    fieldDescriptions: FieldDescription[],
    sequelize: Sequelize,
  ): void {
    let model: ModelAttributes = Object.fromEntries(fieldDescriptions);

    const columnNames = Object.keys(model);
    const timestamps = SequelizeModelFactory.hasTimestamps(columnNames);
    const paranoid = SequelizeModelFactory.isParanoid(columnNames);

    if (timestamps) {
      model = SequelizeModelFactory.removeTimestampColumns(model);
    }

    if (paranoid) {
      model = SequelizeModelFactory.removeParanoidColumn(model);
    }

    sequelize.define(tableName, model, { tableName, timestamps, paranoid });
  }

  private static removeTimestampColumns(modelDefinition: ModelAttributes): ModelAttributes {
    const copy = { ...modelDefinition };
    delete copy.createdAt;
    delete copy.updatedAt;

    return copy;
  }

  private static isParanoid(columnNames: string[]): boolean {
    return columnNames.includes('deletedAt');
  }

  private static removeParanoidColumn(modelDefinition: ModelAttributes): ModelAttributes {
    const copy = { ...modelDefinition };
    delete copy.deletedAt;

    return copy;
  }

  private static hasTimestamps(columnNames: string[]): boolean {
    const hasCreatedAt = columnNames.includes('createdAt');
    const hasUpdatedAt = columnNames.includes('updatedAt');

    return hasCreatedAt && hasUpdatedAt;
  }
}
