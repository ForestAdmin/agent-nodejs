import { ModelAttributes, Sequelize } from 'sequelize';

import { FieldDescription } from './types';

export default class ModelFactory {
  static build(
    tableName: string,
    fieldDescriptions: FieldDescription[],
    sequelize: Sequelize,
  ): void {
    let model: ModelAttributes = Object.fromEntries(fieldDescriptions);

    const columnNames = Object.keys(model);
    const timestamps = ModelFactory.hasTimestamps(columnNames);
    const paranoid = ModelFactory.isParanoid(columnNames);

    if (timestamps) {
      model = ModelFactory.removeTimeStampColumns(model);
    }

    if (paranoid) {
      model = ModelFactory.removeParanoidColumn(model);
    }

    sequelize.define(tableName, model, {
      tableName,
      timestamps,
      paranoid,
    });
  }

  private static removeTimeStampColumns(modelDefinition: ModelAttributes): ModelAttributes {
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
