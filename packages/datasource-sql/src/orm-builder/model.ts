import { Logger } from '@forestadmin/datasource-toolkit';
import { ModelAttributes, Sequelize } from 'sequelize';
import { ModelAttributeColumnOptions } from 'sequelize/types/model';

import SequelizeTypeFactory from './helpers/sequelize-type';
import { Table } from '../introspection/types';

export default class ModelBuilder {
  static defineModels(sequelize: Sequelize, logger: Logger, tables: Table[]): void {
    for (const table of tables) {
      this.defineModel(sequelize, logger, table);
    }
  }

  private static defineModel(sequelize: Sequelize, logger: Logger, table: Table): void {
    const hasTimestamps = this.hasTimestamps(table);
    const isParanoid = this.isParanoid(table);
    const dialect = sequelize.getDialect();
    const modelAttrs = this.buildModelAttributes(table, hasTimestamps, isParanoid, dialect);

    try {
      const model = sequelize.define(table.name, modelAttrs, {
        tableName: table.name,
        timestamps: hasTimestamps,
        paranoid: isParanoid,
      });

      // @see https://sequelize.org/docs/v6/other-topics/legacy/#primary-keys
      // Tell sequelize NOT to invent primary keys when we don't provide them.
      // (Note that this does not seem to work)
      if (!modelAttrs.id && model.getAttributes().id) {
        model.removeAttribute('id');
      }
    } catch (e) {
      logger?.('Warn', `Skipping table "${table.name}" because of error: ${e.message}`);
    }
  }

  private static buildModelAttributes(
    table: Table,
    hasTimestamps: boolean,
    isParanoid: boolean,
    dialect: string,
  ): ModelAttributes {
    const modelAttrs: ModelAttributes = {};

    for (const column of table.columns) {
      const isExplicit =
        !(hasTimestamps && (column.name === 'updatedAt' || column.name === 'createdAt')) &&
        !(isParanoid && column.name === 'deletedAt');

      // Clone object, because sequelize modifies it.
      if (isExplicit)
        modelAttrs[column.name] = {
          ...column,
          type: SequelizeTypeFactory.makeType(dialect, column.type, table.name, column.name),
        };
    }

    // When a user missing the primary key, we add it to avoid sequelize to throw an error and
    // to be consistent with the JSON API specification.
    if (!table.columns.find(column => column.primaryKey)) {
      const columnId = table.columns.find(c => c.name === 'id');
      if (columnId) (modelAttrs[columnId.name] as ModelAttributeColumnOptions).primaryKey = true;
    }

    return modelAttrs;
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
