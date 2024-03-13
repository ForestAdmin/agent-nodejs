import { QueryTypes, Sequelize } from 'sequelize';

import parseArray from './parse-array';
import { SequelizeColumn, SequelizeTableIdentifier } from '../../type-overrides';
import IntrospectionDialect, { ColumnDescription } from '../dialect.interface';

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
          `(c.table_schema = :schemaName${index}
            AND c.table_name = :tableName${index}
            )`,
      )
      .join(' OR ')})`;

    // Query inspired by Sequelize, but adapted for multiple tables
    // and support of multiple databases
    const query = `
    SELECT 
      c.table_schema as "Schema",
      c.table_name as "Table",
      c.column_name as "Field", 
      pk.constraint_type as "Constraint",
      c.column_default as "Default",
      c.is_nullable as "Null", 
      c.identity_generation as "Identity",
      (CASE WHEN c.udt_name = 'hstore' THEN c.udt_name ELSE c.data_type END) 
        || (CASE WHEN c.character_maximum_length IS NOT NULL 
            THEN '(' || c.character_maximum_length || ')' 
            ELSE '' END) as "Type", 
      (SELECT array_agg(en.enumlabel) 
        FROM pg_catalog.pg_type t JOIN pg_catalog.pg_enum en ON t.oid = en.enumtypid 
        WHERE t.typname = c.udt_name OR t.typname = e.udt_name
      ) AS "Special",
      (SELECT pgd.description 
        FROM pg_catalog.pg_statio_all_tables AS st
        INNER JOIN pg_catalog.pg_description pgd on (pgd.objoid=st.relid) 
        WHERE c.ordinal_position=pgd.objsubid AND c.table_name=st.relname
      ) AS "Comment",
      e.data_type AS "ElementType",
      e.udt_name AS "TechnicalElementType"
      FROM 
        information_schema.columns c 
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
      ) pk ON pk.table_schema=c.table_schema 
        AND pk.table_name=c.table_name 
        AND pk.column_name=c.column_name 
      LEFT JOIN INFORMATION_SCHEMA.element_types e ON (
        c.table_catalog = e.object_catalog AND
        c.table_schema = e.object_schema AND
        c.table_name = e.object_name AND
        'TABLE' = e.object_type AND
        c.dtd_identifier = e.collection_type_identifier
      )
      WHERE c.table_catalog = :database 
        AND ${conditions}
      ORDER BY c.table_schema, c.table_name, c.ordinal_position;
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

  private getColumnDescription(dbColumn: DBColumn): ColumnDescription {
    const type = dbColumn.Type.toUpperCase();
    const elementType =
      dbColumn.ElementType?.toUpperCase() === 'USER-DEFINED'
        ? dbColumn.TechnicalElementType
        : dbColumn.ElementType?.toUpperCase();

    const sequelizeColumn: SequelizeColumn = {
      type,
      elementType,
      allowNull: dbColumn.Null === 'YES',
      comment: dbColumn.Comment,
      special: parseArray(dbColumn.Special),
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
