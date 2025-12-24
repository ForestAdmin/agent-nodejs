import type {
  SequelizeColumn,
  SequelizeTableIdentifier,
  SequelizeWithOptions,
} from '../../type-overrides';
import type { ColumnDescription } from '../dialect.interface';
import type IntrospectionDialect from '../dialect.interface';
import type { Sequelize } from 'sequelize';

import { QueryTypes } from 'sequelize';

import parseArray from './parse-array';

type DBColumn = {
  Schema: string;
  Table: string;
  Field: string;
  Constraint: string;
  Default: string;
  Null: 'YES' | 'NO';
  Type: string;
  ElementType: string | null;
  TechnicalElementType: string | null;
  Special: string;
  Comment: string;
  Identity: 'BY DEFAULT' | 'ALWAYS' | null;
};

export default class PostgreSQLDialect implements IntrospectionDialect {
  getDefaultSchema(): string {
    return 'public';
  }

  getTableIdentifier(tableIdentifier: SequelizeTableIdentifier): SequelizeTableIdentifier {
    return tableIdentifier;
  }

  async listColumns(
    tableNames: SequelizeTableIdentifier[],
    sequelize: Sequelize,
  ): Promise<ColumnDescription[][]> {
    if (!sequelize.getDatabaseName()) {
      throw new Error('Database name is required. Please check your connection settings.');
    }

    if (!tableNames?.length) return [];

    const conditions = `(${tableNames
      .map(
        (_, index) =>
          `(columns.table_schema = :schemaName${index}
            AND columns.table_name = :tableName${index}
            )`,
      )
      .join(' OR ')})`;

    // Query inspired by Sequelize, but adapted for multiple tables
    // and support of multiple databases
    const query = `
    SELECT
      "Schema",
      "Table",
      "Field",
      "Constraint",
      "Default",
      "Null",
      "Identity",
      "Type",
      "ElementType",
      "Comment",
      CASE WHEN SUBSTRING("TechnicalElementType", 1, LENGTH("Schema") + 1) = "Schema" || '.' 
        THEN SUBSTRING("TechnicalElementType", LENGTH("Schema") + 2)
        ELSE "TechnicalElementType"
      END AS "TechnicalElementType",
      (SELECT array_agg(en.enumlabel) 
        FROM pg_catalog.pg_type t 
        JOIN pg_catalog.pg_enum en ON t.oid = en.enumtypid 
        INNER JOIN pg_catalog.pg_namespace ON pg_namespace.oid = t.typnamespace
        WHERE (pg_namespace.nspname = "Schema" AND t.typname = udt_name) 
          OR (pg_namespace.nspname = 'public' AND t.typname = "TechnicalElementType")
          OR CONCAT(pg_namespace.nspname, '.', t.typname) = "TechnicalElementType"
      ) AS "Special"
      FROM (
        SELECT       
          *,
          (CASE 
            WHEN "ElementType" LIKE '"%"[]' 
              THEN SUBSTRING("ElementType", 2, LENGTH("ElementType") - 4)
            WHEN "ElementType" LIKE '%[]' 
              THEN SUBSTRING("ElementType", 1, LENGTH("ElementType") - 2)
            ELSE NULL 
          END) AS "TechnicalElementType"
        FROM (
          SELECT 
            columns.table_schema as "Schema",
            columns.table_name as "Table",
            columns.column_name as "Field", 
            pk.constraint_type as "Constraint",
            columns.column_default as "Default",
            columns.is_nullable as "Null", 
            columns.identity_generation as "Identity",
            columns.udt_name as "udt_name",
            (CASE 
              WHEN columns.udt_name = 'hstore' 
                THEN columns.udt_name 
              ELSE columns.data_type
            END)
            || 
            (CASE 
              WHEN columns.character_maximum_length IS NOT NULL 
              THEN '(' || columns.character_maximum_length || ')' 
              ELSE '' 
            END) as "Type", 
            pg_catalog.format_type(pg_attribute.atttypid, pg_attribute.atttypmod) AS "ElementType",
            (SELECT pgd.description 
              FROM pg_catalog.pg_statio_all_tables AS st
              INNER JOIN pg_catalog.pg_description pgd on (pgd.objoid=st.relid) 
              WHERE columns.ordinal_position=pgd.objsubid AND columns.table_name=st.relname
            ) AS "Comment"
          FROM 
            information_schema.columns 
          LEFT JOIN (
            SELECT tc.table_schema, tc.table_name, 
            cu.column_name, tc.constraint_type 
            FROM information_schema.TABLE_CONSTRAINTS tc 
            JOIN information_schema.KEY_COLUMN_USAGE  cu 
            ON tc.table_schema=cu.table_schema 
              AND tc.table_name=cu.table_name 
              AND tc.constraint_name=cu.constraint_name 
              AND tc.constraint_type='PRIMARY KEY'
              AND tc.constraint_catalog=:database
          ) pk ON pk.table_schema=columns.table_schema 
            AND pk.table_name=columns.table_name 
            AND pk.column_name=columns.column_name 
          INNER JOIN pg_catalog.pg_namespace ON (
            pg_namespace.nspname = columns.table_schema  
          )
          INNER JOIN pg_catalog.pg_class ON (
            pg_class.relname = columns.table_name
            AND pg_namespace.oid = pg_class.relnamespace
          )
          INNER JOIN pg_catalog.pg_attribute ON (
            pg_class.oid = pg_attribute.attrelid
            AND pg_attribute.attname = columns.column_name
          )
          WHERE columns.table_catalog = :database 
            AND ${conditions}
          ORDER BY columns.table_schema, columns.table_name, columns.ordinal_position
        ) as raw_info
      ) as with_technical_element_type;
    `;

    const replacements = tableNames.reduce(
      (acc, tableName, index) => ({
        ...acc,
        [`tableName${index}`]: tableName.tableName,
        [`schemaName${index}`]: tableName.schema || 'public',
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
            column.Table === tableName.tableName &&
            column.Schema === (tableName.schema || 'public'),
        )
        .map(column => this.getColumnDescription(column));
    });
  }

  async listViews(sequelize: SequelizeWithOptions): Promise<SequelizeTableIdentifier[]> {
    const schema = sequelize.options.schema || this.getDefaultSchema();

    return sequelize.query<{ tableName: string; schema: string }>(
      `
      SELECT table_name as "tableName", table_schema as "schema"
      FROM information_schema.views
      WHERE table_schema = :schema
        AND table_catalog = :database;
      `,
      {
        type: QueryTypes.SELECT,
        replacements: { schema, database: sequelize.getDatabaseName() },
      },
    );
  }

  private getColumnDescription(dbColumn: DBColumn): ColumnDescription {
    const type = dbColumn.Type.toUpperCase();

    const special = parseArray(dbColumn.Special);

    const elementType = dbColumn.TechnicalElementType || dbColumn.ElementType;

    const sequelizeColumn: SequelizeColumn = {
      type,
      // Don't change the casing of types when it's an enum
      elementType: special ? elementType : elementType?.toUpperCase(),
      allowNull: dbColumn.Null === 'YES',
      comment: dbColumn.Comment,
      special,
      primaryKey: dbColumn.Constraint === 'PRIMARY KEY',
      defaultValue: dbColumn.Default,
      // Supabase databases do not expose a default value for auto-increment columns
      // but Identity is set to "BY DEFAULT" in this case
      autoIncrement:
        Boolean(dbColumn.Default?.startsWith('nextval(')) || dbColumn.Identity !== null,
    };

    const { defaultValue, isLiteralDefaultValue } = this.mapDefaultValue(sequelizeColumn);

    return {
      ...sequelizeColumn,
      name: dbColumn.Field,
      defaultValue,
      isLiteralDefaultValue,
      enumValues: sequelizeColumn.special,
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
    if (description.type === 'BOOLEAN' && !description.defaultValue) {
      return { defaultValue: 'false', isLiteralDefaultValue: false };
    }

    if (description.defaultValue === null || description.defaultValue?.startsWith('NULL::')) {
      return { defaultValue: null, isLiteralDefaultValue: false };
    }

    if (['true', 'false'].includes(description.defaultValue)) {
      return { defaultValue: description.defaultValue, isLiteralDefaultValue: false };
    }

    if (description.defaultValue && !Number.isNaN(Number(description.defaultValue))) {
      return { defaultValue: description.defaultValue, isLiteralDefaultValue: false };
    }

    if (description.defaultValue.startsWith("'")) {
      const constantValue = this.extractConstantValue(description.defaultValue);

      return { defaultValue: constantValue, isLiteralDefaultValue: false };
    }

    return {
      defaultValue: description.defaultValue,
      isLiteralDefaultValue: true,
    };
  }

  /**
   * Fixes the default behavior from Sequelize that does not support
   * default values containing "::"
   * And we don't want to make the same mistake with other characters
   * ex: ''rabbit'::character varying' returns 'rabbit'
   */
  private extractConstantValue(value: string): string {
    let buffer = '';

    for (let i = 1; i < value.length; i += 1) {
      const char = value[i];

      if (char === "'") {
        if (value[i + 1] === "'") {
          i += 1;
        } else {
          return buffer;
        }
      }

      buffer += char;
    }

    throw new Error(`Invalid constant value: ${value}`);
  }
}
