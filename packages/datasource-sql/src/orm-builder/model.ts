import { Logger } from '@forestadmin/datasource-toolkit';
import { ModelAttributes, Sequelize, UUIDV4 } from 'sequelize';
import { ModelAttributeColumnOptions } from 'sequelize/types/model';
import { Literal } from 'sequelize/types/utils';

import SequelizeTypeFactory from './helpers/sequelize-type';
import { LatestIntrospection, Table } from '../introspection/types';

type TableOrView = Table & { view?: boolean };

const createdAtFields = ['createdAt', 'created_at'];
const updatedAtFields = ['updatedAt', 'updated_at'];
const deletedAtFields = ['deletedAt', 'deleted_at'];

const nonParanoidTimestampsField = [...createdAtFields, ...updatedAtFields];

export default class ModelBuilder {
  static defineModels(
    sequelize: Sequelize,
    logger: Logger,
    introspection: LatestIntrospection,
  ): void {
    for (const table of introspection.tables) {
      this.defineModelFromTable(sequelize, logger, table);
    }

    for (const table of introspection.views) {
      this.defineModelFromTable(sequelize, logger, { ...table, view: true });
    }
  }

  private static defineModelFromTable(
    sequelize: Sequelize,
    logger: Logger,
    table: TableOrView,
  ): void {
    const hasTimestamps = this.hasTimestamps(table);
    const isParanoid = this.isParanoid(table);
    const dialect = sequelize.getDialect();
    const attributes = this.buildModelAttributes(logger, table, hasTimestamps, isParanoid, dialect);

    try {
      const model = sequelize.define(table.name, attributes, {
        tableName: table.name,
        timestamps: hasTimestamps,
        paranoid: isParanoid,
        schema: table.schema,
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
    table: TableOrView,
    hasTimestamps: boolean,
    isParanoid: boolean,
    dialect: string,
  ): ModelAttributes {
    const modelAttrs: ModelAttributes = {};

    for (const column of table.columns) {
      const isExplicit =
        !(hasTimestamps && nonParanoidTimestampsField.includes(column.name)) &&
        !(isParanoid && deletedAtFields.includes(column.name));
      const type = SequelizeTypeFactory.makeType(dialect, column.type, table.name, column.name);

      if (column.defaultValue && column.isLiteralDefaultValue) {
        if (
          ['mysql', 'mariadb'].includes(dialect) &&
          /^uuid\(\)$/i.test((column.defaultValue as Literal).val as string)
        ) {
          // MySQL and MariaDB in sequelize do not support default values for UUIDs as literal
          // when creating records so we use the UUIDV4 function instead.
          column.defaultValue = UUIDV4;
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          column.defaultValue = Sequelize.literal((column.defaultValue as any).val);
        }
      }

      // Clone object, because sequelize modifies it.
      if (isExplicit) {
        modelAttrs[column.name] = {
          ...column,
          type,
          unique: table.unique.some(u => u.length === 1 && u[0] === column.name),
        };
      }
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
  private static guessPrimaryKeyInPlace(
    logger: Logger,
    table: TableOrView,
    attributes: ModelAttributes,
  ) {
    // Try to find a column named "id".
    const columnId = table.columns.find(c => c.name.toLowerCase() === 'id')?.name;
    let primaryKeys = columnId ? [columnId] : [];

    // If there is no id column, look at unique indexes, and use the shortest one.
    // (hopefully only one column, but this can also be a composite key for many-to-many tables)
    if (!primaryKeys.length && table.unique.length) {
      [primaryKeys] = [...table.unique].sort((a, b) => a.length - b.length);
    }

    // If all the columns have constraints (e.g. foreign keys), use all of them as a composite key.
    if (
      !primaryKeys.length &&
      table.columns.length === 2 &&
      table.columns.every(c => c.constraints.length)
    ) {
      primaryKeys = table.columns.map(c => c.name);
    }

    // in case of views, it may occur that there is no primary key defined
    // in this case, we just pick an arbitrary colum, since it will be read-only anyway
    if (!primaryKeys.length && table.view) {
      primaryKeys = Object.keys(attributes).slice(0, 1);
    }

    for (const column of primaryKeys) {
      (attributes[column] as ModelAttributeColumnOptions).primaryKey = true;
    }

    // View does not have primary key, so we don't need to warn about it. It is the normal behavior.
    if (primaryKeys.length && !table.view) {
      logger?.(
        'Warn',
        `Table "${table.name}" has no primary key. Using "${primaryKeys.join(', ')}".`,
      );
    }
  }

  private static hasTimestamps(table: Table): boolean {
    return (
      !!table.columns.find(c => createdAtFields.includes(c.name)) &&
      !!table.columns.find(c => updatedAtFields.includes(c.name))
    );
  }

  private static isParanoid(table: Table): boolean {
    return !!table.columns.find(c => deletedAtFields.includes(c.name));
  }
}
