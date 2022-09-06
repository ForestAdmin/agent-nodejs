import { Logger } from '@forestadmin/datasource-toolkit';
import { ModelAttributes, Sequelize } from 'sequelize';
import { Table } from '../introspection/types';

export default class ModelBuilder {
  static defineModels(sequelize: Sequelize, logger: Logger, tables: Table[]): void {
    for (const table of tables) {
      this.defineModel(sequelize, logger, table);
    }
  }

  private static defineModel(sequelize: Sequelize, logger: Logger, table: Table): void {
    const model: ModelAttributes = {};
    const hasTimestamps = this.hasTimestamps(table);
    const isParanoid = this.isParanoid(table);

    for (const column of table.columns) {
      const isExplicit =
        !(hasTimestamps && (column.name === 'updatedAt' || column.name === 'createdAt')) &&
        !(isParanoid && column.name === 'deletedAt');

      // Clone object, because sequelize modifies it.
      if (isExplicit) model[column.name] = { ...column };
    }

    try {
      sequelize.define(table.name, model, {
        tableName: table.name,
        timestamps: hasTimestamps,
        paranoid: isParanoid,
      });
    } catch (e) {
      logger?.('Warn', `Skipping table "${table.name}" because of error: ${e.message}`);
    }
  }

  private static hasTimestamps(table: Table): boolean {
    return (
      !!table.columns.find(c => c.name === 'createdAt') &&
      !!table.columns.find(c => c.name === 'updatedAt')
    );
  }

  private static isParanoid(table: Table): boolean {
    return !!table.columns.find(c => c.name === 'deletedAt');
  }
}
