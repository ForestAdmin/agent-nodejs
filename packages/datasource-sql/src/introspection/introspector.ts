import { Logger } from '@forestadmin/datasource-toolkit';
import { Dialect, QueryTypes, Sequelize } from 'sequelize';

import DefaultValueParser from './helpers/default-value-parser';
import SqlTypeConverter from './helpers/sql-type-converter';
import {
  QueryInterfaceExt,
  SequelizeColumn,
  SequelizeReference,
  SequelizeTableIdentifier,
  SequelizeWithOptions,
} from './type-overrides';
import { Table } from './types';

export default class Introspector {
  static async introspect(sequelize: Sequelize, logger?: Logger): Promise<Table[]> {
    const tableNames = await this.getTableNames(sequelize as SequelizeWithOptions);
    const promises = tableNames.map(name => this.getTable(sequelize, logger, name));
    const tables = await Promise.all(promises);

    this.sanitizeInPlace(tables);

    return tables;
  }

  /** Get names of all tables in the public schema of the db */
  private static async getTableNames(
    sequelize: SequelizeWithOptions,
  ): Promise<SequelizeTableIdentifier[]> {
    const tableIdentifiers: ({ tableName: string } | string)[] = await sequelize
      .getQueryInterface()
      .showAllTables();

    const defaultSchema = sequelize.options.schema || this.getDefaultSchema(sequelize);

    // Sometimes sequelize returns only strings,
    // and sometimes objects with a tableName and schema property.
    // @see https://github.com/sequelize/sequelize/blob/main/src/dialects/mariadb/query.js#L295
    return tableIdentifiers.map((tableIdentifier: string | SequelizeTableIdentifier) =>
      typeof tableIdentifier === 'string'
        ? { tableName: tableIdentifier, schema: defaultSchema }
        : {
            schema: tableIdentifier.schema || defaultSchema,
            tableName: tableIdentifier.tableName,
          },
    );
  }

  private static getDefaultSchema(sequelize: SequelizeWithOptions): string | undefined {
    switch (sequelize.getDialect()) {
      case 'postgres':
        return 'public';
      case 'mssql':
        return 'dbo';
      default:
        return undefined;
    }
  }

  /** Instrospect a single table */
  private static async getTable(
    sequelize: Sequelize,
    logger: Logger,
    tableIdentifier: SequelizeTableIdentifier,
  ): Promise<Table> {
    const queryInterface = sequelize.getQueryInterface() as QueryInterfaceExt;

    const [columnDescriptions, tableIndexes, tableReferences] = await Promise.all([
      queryInterface.describeTable(tableIdentifier),
      queryInterface.showIndex(tableIdentifier),

      queryInterface.getForeignKeyReferencesForTable(tableIdentifier),
    ]);

    await this.detectBrokenRelationship(tableIdentifier, sequelize, tableReferences, logger);

    const columns = await Promise.all(
      Object.entries(columnDescriptions).map(async ([name, description]) => {
        const references = tableReferences.filter(
          // There is a bug right now with sequelize on postgresql: returned association
          // are not filtered on the schema. So we have to filter them manually.
          // Should be fixed with Sequelize v7
          r =>
            r.columnName === name &&
            // MySQL returns schema = databaseName instead of schema = null
            (!tableIdentifier.schema || r.tableSchema === tableIdentifier.schema),
        );
        const options = { name, description, references };

        return this.getColumn(sequelize, logger, tableIdentifier, options);
      }),
    );

    return {
      name: tableIdentifier.tableName,
      schema: tableIdentifier.schema,
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
      description: SequelizeColumn;
      references: SequelizeReference[];
    },
  ): Promise<Table['columns'][number]> {
    const { name, description, references } = options;
    const dialect = sequelize.getDialect() as Dialect;
    const typeConverter = new SqlTypeConverter(sequelize);

    try {
      const type = await typeConverter.convert(tableIdentifier, name, description);
      const parser = new DefaultValueParser(dialect);

      // Workaround autoincrement flag not being properly set when using postgres
      const autoIncrement = Boolean(
        description.autoIncrement || description.defaultValue?.match?.(/^nextval\(.+\)$/),
      );

      return {
        type,
        autoIncrement,
        defaultValue: autoIncrement ? null : parser.parse(description.defaultValue, type),
        isLiteralDefaultValue: autoIncrement
          ? false
          : parser.isLiteral(description.defaultValue, type),
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
  private static sanitizeInPlace(tables: Table[]): void {
    for (const table of tables) {
      // Remove unique indexes which depennd on columns that are not present in the table.
      table.unique = table.unique.filter(unique =>
        unique.every(column => table.columns.find(c => c.name === column)),
      );

      for (const column of table.columns) {
        // Remove references to tables that are not present in the schema.
        column.constraints = column.constraints.filter(constraint => {
          const refTable = tables.find(t => t.name === constraint.table);
          const refColumn = refTable?.columns.find(c => c.name === constraint.column);

          return refTable && refColumn;
        });
      }
    }
  }

  private static async detectBrokenRelationship(
    tableIdentifier: SequelizeTableIdentifier,
    sequelize: Sequelize,
    tableReferences: SequelizeReference[],
    logger: Logger,
  ) {
    let constraintNamesForForeignKey: Array<{ constraint_name: string; table_name: string }> = [];
    const dialect = sequelize.getDialect() as Dialect;

    if (dialect === 'sqlite') {
      constraintNamesForForeignKey = await sequelize.query<{
        constraint_name: string;
        table_name: string;
      }>(
        `SELECT "from" as constraint_name, :tableName as table_name
        from pragma_foreign_key_list(:tableName);`,
        {
          replacements: { tableName: tableIdentifier.tableName },
          type: QueryTypes.SELECT,
        },
      );
    } else {
      constraintNamesForForeignKey = await sequelize.query<{
        constraint_name: string;
        table_name: string;
      }>(
        `
        SELECT constraint_name, table_name
          FROM information_schema.table_constraints
          WHERE table_name = :tableName 
            AND constraint_type = 'FOREIGN KEY'
            AND (:schema IS NULL OR table_schema = :schema);
        `,
        {
          replacements: {
            tableName: tableIdentifier.tableName,
            schema: tableIdentifier.schema || null,
          },
          type: QueryTypes.SELECT,
        },
      );
    }

    this.logBrokenRelationship(constraintNamesForForeignKey, tableReferences, logger);
  }

  private static logBrokenRelationship(
    constraintNamesForForeignKey: unknown[],
    tableReferences: SequelizeReference[],
    logger: Logger,
  ) {
    if (constraintNamesForForeignKey.length !== tableReferences.length) {
      const constraintNames = new Set(
        (constraintNamesForForeignKey as [{ constraint_name: string; table_name: string }]).map(
          c => ({ constraint_name: c.constraint_name, table_name: c.table_name }),
        ),
      );
      tableReferences.forEach(({ constraintName }) => {
        constraintNames.forEach(obj => {
          if (obj.constraint_name === constraintName) {
            constraintNames.delete(obj);
          }
        });
      });

      constraintNames.forEach(obj => {
        logger?.(
          'Error',
          // eslint-disable-next-line max-len
          `Failed to load constraints on relation '${obj.constraint_name}' on table '${obj.table_name}'. The relation will be ignored.`,
        );
      });
    }
  }
}
