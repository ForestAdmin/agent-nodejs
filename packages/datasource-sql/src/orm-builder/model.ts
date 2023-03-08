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
    const attributes = this.buildModelAttributes(logger, table, hasTimestamps, isParanoid, dialect);

    try {
      const model = sequelize.define(table.name, attributes, {
        tableName: table.name,
        timestamps: hasTimestamps,
        paranoid: isParanoid,
      });

      // @see https://sequelize.org/docs/v6/other-topics/legacy/#primary-keys
      // Tell sequelize NOT to invent primary keys when we don't provide them.
      // (Note that this does not seem to work)
      if (!attributes.id && model.getAttributes().id) {
        model.removeAttribute('id');
      }
    } catch (e) {
      // In practice, now that we added the primary key guessing, this should not happen anymore.
      // But we keep it here just in case.
      logger?.('Warn', `Skipping table "${table.name}" because of error: ${e.message}`);
    }
  }

  private static buildModelAttributes(
    logger: Logger,
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
          unique: table.unique.some(u => u.length === 1 && u[0] === column.name),
        };
    }

    // If there is no primary key, we try to guess one.
    if (!table.columns.some(c => c.primaryKey)) {
      this.guessPrimaryKeyInPlace(logger, table, modelAttrs);
    }

    return modelAttrs;
  }

  /**
   * When the primary key is missing, we attempt to find a column that may act as such.
   * This enables us to support tables that have no primary key.
   */
  private static guessPrimaryKeyInPlace(logger: Logger, table: Table, attributes: ModelAttributes) {
    // Try to find a column named "id".
    let primaryKeys = table.columns.some(c => c.name === 'id') ? ['id'] : [];

    // If there is no id column, look at unique indexes, and use the shortest one.
    // (hopefully only one column, but this can also be a composite key for many-to-many tables)
    if (!primaryKeys.length && table.unique.length) {
      [primaryKeys] = [...table.unique].sort((a, b) => a.length - b.length);
    }

    // If all the columns have contraints (e.g. foreign keys), use all of them as a composite key.
    if (
      !primaryKeys.length &&
      table.columns.length === 2 &&
      table.columns.every(c => c.constraints.length)
    ) {
      primaryKeys = table.columns.map(c => c.name);
    }

    for (const column of primaryKeys)
      (attributes[column] as ModelAttributeColumnOptions).primaryKey = true;

    if (primaryKeys.length) {
      logger?.(
        'Warn',
        `Table "${table.name}" has no primary key. Using "${primaryKeys.join(', ')}".`,
      );
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
