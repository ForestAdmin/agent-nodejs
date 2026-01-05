import type { ColumnDescription } from './dialect.interface';
import type IntrospectionDialect from './dialect.interface';
import type {
  SequelizeColumn,
  SequelizeTableIdentifier,
  SequelizeWithOptions,
} from '../type-overrides';
import type { Sequelize } from 'sequelize';

import { QueryTypes } from 'sequelize';

type DBColumn = {
  Schema: string;
  Table: string;
  Name: string;
  Type: string;
  Length: number;
  IsNull: 'YES' | 'NO';
  Default: string;
  Constraint: string;
  IsIdentity: number;
  Comment: string;
};
export default class MsSQLDialect implements IntrospectionDialect {
  getDefaultSchema(): string {
    return 'dbo';
  }

  getTableIdentifier(tableIdentifier: SequelizeTableIdentifier): SequelizeTableIdentifier {
    return tableIdentifier;
  }

  async listViews(sequelize: SequelizeWithOptions): Promise<SequelizeTableIdentifier[]> {
    return sequelize.query(
      `
      SELECT 
        SCHEMA_NAME(schema_id) AS [schema],
        Name as [tableName]
      FROM sys.views
        
    `,
      {
        type: QueryTypes.SELECT,
        replacements: {
          databaseName: sequelize.getDatabaseName(),
          schema: sequelize.options.schema || this.getDefaultSchema(),
        },
      },
    );
  }

  async listColumns(
    tableNames: SequelizeTableIdentifier[],
    sequelize: Sequelize,
  ): Promise<ColumnDescription[][]> {
    if (!sequelize.getDatabaseName()) {
      throw new Error('Database name is required. Please check your connection settings.');
    }

    if (!tableNames?.length) return Promise.resolve([]);

    const conditions = `(${tableNames
      .map(
        (_, index) =>
          `(c.table_schema = :schemaName${index}
            AND c.table_name = :tableName${index}
            )`,
      )
      .join(' OR ')})`;

    const query = `
      SELECT 
        c.TABLE_SCHEMA AS 'Schema',
        c.TABLE_NAME AS 'Table',
        c.COLUMN_NAME AS 'Name',
        c.DATA_TYPE AS 'Type',
        c.CHARACTER_MAXIMUM_LENGTH AS 'Length',
        c.IS_NULLABLE as 'IsNull',
        COLUMN_DEFAULT AS 'Default',
        pk.CONSTRAINT_TYPE AS 'Constraint',
        COLUMNPROPERTY(
          OBJECT_ID('['+c.TABLE_SCHEMA+'].['+c.TABLE_NAME+']'),
          c.COLUMN_NAME, 'IsIdentity'
        ) as 'IsIdentity',
        CAST(prop.value AS NVARCHAR) AS 'Comment'
      FROM INFORMATION_SCHEMA.TABLES t
      INNER JOIN INFORMATION_SCHEMA.COLUMNS c
        ON t.TABLE_NAME = c.TABLE_NAME
        AND t.TABLE_SCHEMA = c.TABLE_SCHEMA
      LEFT JOIN (
        SELECT tc.table_schema, tc.table_name, 
          cu.column_name, tc.CONSTRAINT_TYPE 
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc 
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE  cu 
          ON tc.table_schema=cu.table_schema
          AND tc.table_name=cu.table_name 
          AND tc.constraint_name=cu.constraint_name 
          AND tc.CONSTRAINT_TYPE='PRIMARY KEY'
        ) pk 
        ON pk.table_schema=c.table_schema 
        AND pk.table_name=c.table_name 
        AND pk.column_name=c.column_name 
      INNER JOIN sys.columns AS sc
      ON sc.object_id = OBJECT_ID('['+t.table_schema + '].[' + t.table_name+']')
        AND sc.name = c.column_name
      LEFT JOIN sys.extended_properties prop ON prop.major_id = sc.object_id
      AND prop.minor_id = sc.column_id
      AND prop.name = 'MS_Description'
      WHERE 
        t.TABLE_CATALOG = :database
        AND ${conditions}`;

    const replacements = tableNames.reduce(
      (acc, tableName, index) => ({
        ...acc,
        [`tableName${index}`]: tableName.tableName,
        [`schemaName${index}`]: tableName.schema || 'dbo',
      }),
      {
        database: sequelize.getDatabaseName(),
      },
    );

    const results = await sequelize.query<DBColumn>(query, {
      replacements,
      type: QueryTypes.SELECT,
      logging: false,
    });

    return tableNames.map(tableName => {
      return results
        .filter(
          column =>
            column.Table === tableName.tableName && column.Schema === (tableName.schema || 'dbo'),
        )
        .map(column => this.getColumnDescription(column));
    });
  }

  private getColumnDescription(dbColumn: DBColumn): ColumnDescription {
    let type = dbColumn.Type.toUpperCase();

    if (type.includes('CHAR')) {
      type = `${type}(${dbColumn.Length === -1 ? 'MAX' : dbColumn.Length})`;
    }

    const sequelizeColumn: SequelizeColumn = {
      type,
      allowNull: dbColumn.IsNull === 'YES',
      comment: dbColumn.Comment,
      primaryKey: dbColumn.Constraint === 'PRIMARY KEY',
      defaultValue: dbColumn.Default,
      autoIncrement: dbColumn.IsIdentity === 1,
      special: [],
    };

    const { defaultValue, isLiteralDefaultValue } = this.mapDefaultValue(sequelizeColumn);

    return {
      ...sequelizeColumn,
      name: dbColumn.Name,
      defaultValue,
      isLiteralDefaultValue,
      enumValues: null,
    };
  }

  /**
   * Fixes the default behavior of Sequelize that does not allow us to
   * detect if a value is a function call or a constant value
   */
  private mapDefaultValue(description: SequelizeColumn): {
    defaultValue: string;
    isLiteralDefaultValue: boolean;
  } {
    if (
      description.defaultValue === null ||
      !description.defaultValue?.startsWith('(') ||
      !description.defaultValue?.endsWith(')')
    ) {
      // Strange case if not null
      return {
        defaultValue: null,
        isLiteralDefaultValue: false,
      };
    }

    const defaultValueWithoutParenthesis = description.defaultValue.slice(1, -1);

    if (
      defaultValueWithoutParenthesis.startsWith("N'") &&
      defaultValueWithoutParenthesis.endsWith("'")
    ) {
      return {
        defaultValue: this.extractConstantValue(defaultValueWithoutParenthesis.slice(2, -1)),
        isLiteralDefaultValue: false,
      };
    }

    if (
      defaultValueWithoutParenthesis.startsWith("'") &&
      defaultValueWithoutParenthesis.endsWith("'")
    ) {
      return {
        defaultValue: this.extractConstantValue(defaultValueWithoutParenthesis.slice(1, -1)),
        isLiteralDefaultValue: false,
      };
    }

    if (
      defaultValueWithoutParenthesis.startsWith('(') &&
      defaultValueWithoutParenthesis.endsWith(')') &&
      !Number.isNaN(Number(defaultValueWithoutParenthesis.slice(1, -1)))
    ) {
      return {
        defaultValue: defaultValueWithoutParenthesis.slice(1, -1),
        isLiteralDefaultValue: false,
      };
    }

    if (defaultValueWithoutParenthesis === 'NULL') {
      return {
        defaultValue: null,
        isLiteralDefaultValue: false,
      };
    }

    return {
      defaultValue: defaultValueWithoutParenthesis,
      isLiteralDefaultValue: true,
    };
  }

  private extractConstantValue(value: string): string {
    return value.replace(/''/g, "'");
  }
}
