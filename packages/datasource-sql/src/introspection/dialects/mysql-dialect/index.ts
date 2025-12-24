import type {
  SequelizeColumn,
  SequelizeTableIdentifier,
  SequelizeWithOptions,
} from '../../type-overrides';
import type { ColumnDescription } from '../dialect.interface';
import type IntrospectionDialect from '../dialect.interface';
import type { Sequelize } from 'sequelize';

import { QueryTypes } from 'sequelize';

import parseEnum from './parse-enum';

export type MySQLDBColumn = {
  Table: string;
  Field: string;
  Default: string;
  Null: 'YES' | 'NO';
  Type: string;
  Extra: string;
  Comment: string;
  Key: string;
};

export default class MySQLDialect implements IntrospectionDialect {
  getDefaultSchema(sequelize: Sequelize): string {
    return sequelize.getDatabaseName();
  }

  getTableIdentifier(tableIdentifier: SequelizeTableIdentifier): SequelizeTableIdentifier {
    return { tableName: tableIdentifier.tableName };
  }

  async listColumns(
    tableNames: SequelizeTableIdentifier[],
    sequelize: Sequelize,
  ): Promise<ColumnDescription[][]> {
    if (!sequelize.getDatabaseName()) {
      throw new Error('Database name is required. Please check your connection settings.');
    }

    if (!tableNames?.length) return Promise.resolve([]);

    const columns = await sequelize.query<MySQLDBColumn>(
      `
      SELECT TABLE_NAME AS 'Table',
        COLUMN_NAME AS 'Field',
        COLUMN_DEFAULT AS 'Default',
        IS_NULLABLE AS 'Null',
        COLUMN_TYPE AS 'Type',
        EXTRA AS 'Extra',
        COLUMN_COMMENT AS 'Comment',
        COLUMN_KEY AS 'Key'
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = :databaseName
      AND TABLE_NAME IN (:tableNames)
      ORDER BY TABLE_NAME, ORDINAL_POSITION
      `,
      {
        type: QueryTypes.SELECT,
        replacements: {
          databaseName: sequelize.getDatabaseName(),
          tableNames: tableNames.map(t => t.tableName),
        },
      },
    );

    return tableNames.map(table => {
      const tableColumns = columns.filter(c => c.Table === table.tableName);

      return tableColumns.map(c => this.getColumnDescription(c));
    });
  }

  async listViews(sequelize: SequelizeWithOptions): Promise<SequelizeTableIdentifier[]> {
    const dbName = sequelize.getDatabaseName();

    return sequelize.query<SequelizeTableIdentifier>(
      `SELECT TABLE_NAME as "tableName" 
      FROM information_schema.tables 
      WHERE TABLE_TYPE LIKE 'VIEW'
        AND TABLE_SCHEMA = :dbName;`,
      {
        type: QueryTypes.SELECT,
        replacements: { dbName },
      },
    );
  }

  private getColumnDescription(dbColumn: MySQLDBColumn): ColumnDescription {
    const type = dbColumn.Type.startsWith('enum')
      ? dbColumn.Type.replace(/^enum/, 'ENUM')
      : dbColumn.Type.toUpperCase();

    const sequelizeColumn: SequelizeColumn = {
      type,
      allowNull: dbColumn.Null === 'YES',
      comment: dbColumn.Comment || null,
      primaryKey: dbColumn.Key === 'PRI',
      defaultValue: dbColumn.Default,
      autoIncrement: dbColumn.Extra?.toLowerCase() === 'auto_increment',
    };

    const { defaultValue, isLiteralDefaultValue } = this.mapDefaultValue(dbColumn);

    return {
      ...sequelizeColumn,
      name: dbColumn.Field,
      defaultValue,
      isLiteralDefaultValue,
      enumValues: parseEnum(type),
    };
  }

  /**
   * Fixes the default behavior of Sequelize that does not allow us to
   * detect if a value is a function call or a constant value
   */
  protected mapDefaultValue(dbColumn: MySQLDBColumn): {
    defaultValue: string;
    isLiteralDefaultValue: boolean;
  } {
    if (dbColumn.Default === null) {
      return {
        defaultValue: null,
        isLiteralDefaultValue: false,
      };
    }

    const extra = dbColumn.Extra?.toUpperCase();

    if (extra?.includes('DEFAULT_GENERATED') || extra?.includes('AUTO_INCREMENT')) {
      return {
        defaultValue: dbColumn.Default,
        isLiteralDefaultValue: true,
      };
    }

    // For MySQL 5
    if (
      dbColumn.Type?.toLowerCase() === 'datetime' &&
      dbColumn.Default?.toLowerCase() === 'current_timestamp'
    ) {
      return {
        defaultValue: dbColumn.Default,
        isLiteralDefaultValue: true,
      };
    }

    return {
      defaultValue: dbColumn.Default,
      isLiteralDefaultValue: false,
    };
  }
}
