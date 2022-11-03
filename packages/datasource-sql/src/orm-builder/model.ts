import { Logger } from '@forestadmin/datasource-toolkit';
import { ModelAttributes, Sequelize } from 'sequelize';

import { Table } from '../introspection/types';
import SequelizeTypeFactory from './helpers/sequelize-type';

export default class ModelBuilder {
  static defineModels(sequelize: Sequelize, logger: Logger, tables: Table[]): void {
    for (const table of tables) {
      this.defineModel(sequelize, logger, table);
    }
  }

  private static defineModel(sequelize: Sequelize, logger: Logger, table: Table): void {
    const modelAttrs: ModelAttributes = {};
    const hasTimestamps = this.hasTimestamps(table);
    const isParanoid = this.isParanoid(table);

    for (const column of table.columns) {
      const isExplicit =
        !(hasTimestamps && (column.name === 'updatedAt' || column.name === 'createdAt')) &&
        !(isParanoid && column.name === 'deletedAt');

      // Clone object, because sequelize modifies it.
      if (isExplicit)
        modelAttrs[column.name] = {
          ...column,
          type: SequelizeTypeFactory.makeSequelizeType(column.type),
        };
    }

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
