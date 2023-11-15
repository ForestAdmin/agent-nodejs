import { Logger } from '@forestadmin/datasource-toolkit';
import { Dialect, QueryTypes, Sequelize } from 'sequelize';

import IntrospectionDialect, { ColumnDescription } from './dialects/dialect.interface';
import MariadbDialect from './dialects/mariadb-dialect';
import MsSQLDialect from './dialects/mssql-dialect';
import MySQLDialect from './dialects/mysql-dialect';
import PostgreSQLDialect from './dialects/postgresql-dialect';
import SQLiteDialect from './dialects/sqlite-dialect';
import SqlTypeConverter from './helpers/sql-type-converter';
import {
  QueryInterfaceExt,
  SequelizeReference,
  SequelizeTableIdentifier,
  SequelizeWithOptions,
} from './type-overrides';
import { Table } from './types';

export default class Introspector {
  static async introspect(sequelize: Sequelize, logger?: Logger): Promise<Table[]> {
    const tableNames = await this.getTableNames(sequelize as SequelizeWithOptions);
    const tables = await this.getTables(tableNames, sequelize, logger);
    // const promises = tableNames.map(name => this.getTable(sequelize, logger, name));
    // const tables = await Promise.all(promises);

    this.sanitizeInPlace(tables, logger);

    return tables;
  }

  /** Get names of all tables in the public schema of the db */
  private static async getTableNames(
    sequelize: SequelizeWithOptions,
  ): Promise<SequelizeTableIdentifier[]> {
    const tableIdentifiers: ({ tableName: string } | string)[] = await sequelize
      .getQueryInterface()
      .showAllTables();

    const requestedSchema = sequelize.options.schema || this.getDefaultSchema(sequelize);

    // Sometimes sequelize returns only strings,
    // and sometimes objects with a tableName and schema property.
    // @see https://github.com/sequelize/sequelize/blob/main/src/dialects/mariadb/query.js#L295
    return (
      tableIdentifiers
        .map((tableIdentifier: string | SequelizeTableIdentifier) =>
          typeof tableIdentifier === 'string'
            ? { tableName: tableIdentifier, schema: requestedSchema }
            : {
                schema: tableIdentifier.schema || requestedSchema,
                tableName: tableIdentifier.tableName,
              },
        )
        // MSSQL returns all tables, not filtered by schema
        .filter(identifier => identifier.schema === requestedSchema)
    );
  }

  private static getDefaultSchema(sequelize: SequelizeWithOptions): string | undefined {
    switch (sequelize.getDialect()) {
      case 'postgres':
        return 'public';
      case 'mssql':
        return 'dbo';
      // MariaDB returns the database name as "schema" in table identifiers
      case 'mariadb':
      case 'mysql':
        return sequelize.getDatabaseName();
      default:
        return undefined;
    }
  }

  private static getTableIdentifier(
    tableIdentifier: SequelizeTableIdentifier,
    sequelize: Sequelize,
  ): SequelizeTableIdentifier {
    switch (sequelize.getDialect()) {
      case 'postgres':
      case 'mssql':
      case 'sqlite':
        return tableIdentifier;
      case 'mariadb':
      case 'mysql':
      default:
        return { tableName: tableIdentifier.tableName };
    }
  }

  private static async getTables(
    tableNames: SequelizeTableIdentifier[],
    sequelize: Sequelize,
    logger: Logger,
  ): Promise<Table[]> {
    const dialect = this.getDialect(sequelize);

    const tablesColumns = await dialect.listColumns(tableNames, sequelize);

    return Promise.all(
      tableNames.map((tableIdentifier, index) => {
        const columnDescriptions = tablesColumns[index];

        return this.getTable(sequelize, tableIdentifier, columnDescriptions, logger);
      }),
    );
  }

  private static getDialect(sequelize: Sequelize): IntrospectionDialect {
    switch (sequelize.getDialect()) {
      case 'postgres':
        return new PostgreSQLDialect();
      case 'mssql':
        return new MsSQLDialect();
      case 'mysql':
        return new MySQLDialect();
      case 'mariadb':
        return new MariadbDialect();
      case 'sqlite':
        return new SQLiteDialect();
      default:
        throw new Error(`Unsupported dialect: ${sequelize.getDialect()}`);
    }
  }

  /** Instrospect a single table */
  private static async getTable(
    sequelize: Sequelize,
    tableIdentifier: SequelizeTableIdentifier,
    columnDescriptions: ColumnDescription[],
    logger: Logger,
  ): Promise<Table> {
    const queryInterface = sequelize.getQueryInterface() as QueryInterfaceExt;
    // Sequelize is not consistent in the way it handles table identifiers either when it returns
    // it, when it uses it internally, or when it is passed as an argument.
    // Plus it has some bugs with schema handling in postgresql that forces us to be sure that
    // the table identifier is correct on our side
    const tableIdentifierForQuery = Introspector.getTableIdentifier(tableIdentifier, sequelize);

    const [tableIndexes, tableReferences] = await Promise.all([
      queryInterface.showIndex(tableIdentifierForQuery),
      queryInterface.getForeignKeyReferencesForTable(tableIdentifierForQuery),
    ]);

    const references = tableReferences.filter(
      // There is a bug right now with sequelize on postgresql: returned association
      // are not filtered on the schema. So we have to filter them manually.
      // Should be fixed with Sequelize v7
      r => r.tableName === tableIdentifier.tableName && r.tableSchema === tableIdentifier.schema,
    );

    const columns = await Promise.all(
      columnDescriptions.map(async columnDescription => {
        const columnReferences = references.filter(r => r.columnName === columnDescription.name);

        const options = {
          name: columnDescription.name,
          description: columnDescription,
          references: columnReferences,
        };

        return this.getColumn(sequelize, logger, tableIdentifier, options);
      }),
    );

    return {
      name: tableIdentifierForQuery.tableName,
      schema: tableIdentifierForQuery.schema,
      columns: columns.filter(Boolean),
      unique: tableIndexes
        .filter(i => i.unique || i.primary)
        .map(i => i.fields.map(f => f.attribute)),
    };
  }

  private static async getColumn(
    sequelize: Sequelize,
    logger: Logger,
    tableIdentifier: SequelizeTableIdentifier,
    options: {
      name: string;
      description: ColumnDescription;
      references: SequelizeReference[];
    },
  ): Promise<Table['columns'][number]> {
    const { name, description, references } = options;
    const typeConverter = new SqlTypeConverter(sequelize);

    try {
      const type = await typeConverter.convert(tableIdentifier, name, description);

      return {
        type,
        autoIncrement: description.autoIncrement,
        defaultValue: description.autoIncrement ? null : description.defaultValue,
        isLiteralDefaultValue: description.isLiteralDefaultValue,
        name,
        allowNull: description.allowNull,
        primaryKey: description.primaryKey,
        constraints: references.map(r => ({
          table: r.referencedTableName,
          column: r.referencedColumnName,
        })),
      };
    } catch (e) {
      logger?.('Warn', `Skipping column ${tableIdentifier.tableName}.${name} (${e.message})`);
    }
  }

  /**
   * Remove references to entities that are not present in the schema
   * (happens when we skip entities because of errors)
   */
  private static sanitizeInPlace(tables: Table[], logger?: Logger): void {
    for (const table of tables) {
      // Remove unique indexes which depennd on columns that are not present in the table.
      table.unique = table.unique.filter(unique =>
        unique.every(column => table.columns.find(c => c.name === column)),
      );

      for (const column of table.columns) {
        const references = column.constraints || [];
        // Remove references to tables that are not present in the schema.
        column.constraints = references.filter(constraint => {
          const refTable = tables.find(t => t.name === constraint.table);
          const refColumn = refTable?.columns.find(c => c.name === constraint.column);

          return refTable && refColumn;
        });

        this.logBrokenRelationship(references, column.constraints, table.name, logger);
      }
    }
  }

  private static logBrokenRelationship(
    allConstraints: Table['columns'][number]['constraints'],
    sanitizedConstraints: Table['columns'][number]['constraints'],
    tableName: string,
    logger: Logger,
  ) {
    const missingConstraints = allConstraints.filter(
      constraint => !sanitizedConstraints.includes(constraint),
    );

    missingConstraints.forEach(constraint => {
      logger?.(
        'Error',
        // eslint-disable-next-line max-len
        `Failed to load constraints on relation on table '${tableName}' referencing '${constraint.table}.${constraint.column}'. The relation will be ignored.`,
      );
    });
  }
}
