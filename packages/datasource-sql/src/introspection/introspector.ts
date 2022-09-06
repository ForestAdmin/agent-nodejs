import { Dialect, Sequelize } from 'sequelize';
import { Logger } from '@forestadmin/datasource-toolkit';

import { SequelizeColumn, SequelizeIndex, SequelizeReference, Table } from './types';
import DefaultValueParser from './helpers/default-value-parser';
import SqlTypeConverter from './helpers/sql-type-converter';

export default class Introspector {
  static async instrospect(sequelize: Sequelize, logger?: Logger): Promise<Table[]> {
    const tableNames = await this.getTableNames(sequelize);

    return Promise.all(tableNames.map(name => this.getTable(sequelize, logger, name)));
  }

  /** Get names of all tables in the public schema of the db */
  private static async getTableNames(sequelize: Sequelize): Promise<string[]> {
    const names: ({ tableName: string } | string)[] = await sequelize
      .getQueryInterface()
      .showAllTables();

    // Fixes Sequelize behavior incorrectly implemented.
    // Types indicate that showAllTables() should return a list of string, but it
    // returns a list of object for both mariadb & mssql
    // @see https://github.com/sequelize/sequelize/blob/main/src/dialects/mariadb/query.js#L295
    return names.map(name => (typeof name === 'string' ? name : name?.tableName));
  }

  /** Instrospect a single table */
  private static async getTable(
    sequelize: Sequelize,
    logger: Logger,
    tableName: string,
  ): Promise<Table> {
    // Load columns descriptions, indexes and references of the current table.
    const columnDescriptions = await sequelize.getQueryInterface().describeTable(tableName);
    const tableIndexes = await sequelize.getQueryInterface().showIndex(tableName);
    const tableReferences = await sequelize
      .getQueryInterface()
      .getForeignKeyReferencesForTable(tableName);

    // Create columns
    const columns = Object.entries(columnDescriptions).map(([name, description]) => {
      const indexes = tableIndexes.filter(i => i.fields.find(f => f.attribute === name));
      const references = tableReferences.filter(r => r.columnName === name);
      const options = { name, description, indexes, references };

      return this.getColumn(sequelize, logger, tableName, options);
    });

    return {
      name: tableName,
      columns: (await Promise.all(columns)).filter(Boolean),
    };
  }

  private static async getColumn(
    sequelize: Sequelize,
    logger: Logger,
    tableName: string,
    options: {
      name: string;
      description: SequelizeColumn;
      indexes: SequelizeIndex[];
      references: SequelizeReference[];
    },
  ): Promise<Table['columns'][number]> {
    const { name, description, indexes, references } = options;
    const dialect = sequelize.getDialect() as Dialect;
    const typeConverter = new SqlTypeConverter(sequelize);

    try {
      const type = await typeConverter.convert(tableName, name, description);
      const defaultValue = new DefaultValueParser(dialect).parse(description.defaultValue, type);
      const unique = !!indexes.find(
        i => i.fields.length === 1 && i.fields[0].attribute === name && i.unique,
      );

      // Workaround autoincrement flag not being properly set when using postgres
      const autoIncrement = Boolean(
        description.autoIncrement || description.defaultValue?.match?.(/^nextval\(.+\)$/),
      );

      return {
        type,
        autoIncrement,
        defaultValue: autoIncrement ? null : defaultValue,
        name,
        allowNull: description.allowNull,
        unique,
        primaryKey: description.primaryKey,
        constraints: references.map(r => ({
          table: r.referencedTableName,
          column: r.referencedColumnName,
        })),
      };
    } catch (e) {
      logger?.('Warn', `Skipping column ${tableName}.${name} (${e.message})`);
    }
  }
}
