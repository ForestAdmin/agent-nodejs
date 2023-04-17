import { Logger } from '@forestadmin/datasource-toolkit';
import { Dialect, Sequelize } from 'sequelize';

import DefaultValueParser from './helpers/default-value-parser';
import SqlTypeConverter from './helpers/sql-type-converter';
import { SequelizeColumn, SequelizeReference, Table } from './types';

export default class Introspector {
  static async introspect(sequelize: Sequelize, logger?: Logger): Promise<Table[]> {
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
    const [columnDescriptions, tableIndexes, tableReferences] = await Promise.all([
      sequelize.getQueryInterface().describeTable(tableName),
      sequelize.getQueryInterface().showIndex(tableName),
      sequelize.getQueryInterface().getForeignKeyReferencesForTable(tableName),
    ]);

    // Create columns
    const columns = Object.entries(columnDescriptions).map(([name, description]) => {
      const references = tableReferences.filter(r => r.columnName === name);
      const options = { name, description, references };

      return this.getColumn(sequelize, logger, tableName, options);
    });

    return {
      name: tableName,
      columns: (await Promise.all(columns)).filter(Boolean),
      unique: tableIndexes
        .filter(i => i.unique || i.primary)
        .map(i => i.fields.map(f => f.attribute)),
    };
  }

  private static async getColumn(
    sequelize: Sequelize,
    logger: Logger,
    tableName: string,
    options: {
      name: string;
      description: SequelizeColumn;
      references: SequelizeReference[];
    },
  ): Promise<Table['columns'][number]> {
    const { name, description, references } = options;
    const dialect = sequelize.getDialect() as Dialect;
    const typeConverter = new SqlTypeConverter(sequelize);

    try {
      const type = await typeConverter.convert(tableName, name, description);
      const defaultValue = new DefaultValueParser(dialect).parse(description.defaultValue, type);

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
