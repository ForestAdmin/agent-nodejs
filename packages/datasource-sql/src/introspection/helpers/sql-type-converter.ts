import { QueryTypes, Sequelize } from 'sequelize';

import { ColumnDescription } from '../dialects/dialect.interface';
import { SequelizeTableIdentifier } from '../type-overrides';
import { ColumnType, ScalarSubType } from '../types';

export default class SqlTypeConverter {
  private static readonly enumRegex = /ENUM\((.*)\)/i;
  private readonly sequelize: Sequelize;

  constructor(sequelize: Sequelize) {
    this.sequelize = sequelize;
  }

  async convert(
    tableIdentifier: SequelizeTableIdentifier,
    columnName: string,
    columnInfo: ColumnDescription,
  ): Promise<ColumnType> {
    switch (columnInfo.type) {
      case 'ARRAY':
        return this.getArrayType(tableIdentifier, columnName);

      case 'USER-DEFINED':
      case this.typeMatch(columnInfo.type, SqlTypeConverter.enumRegex):
        return this.getEnumType(columnInfo);

      default:
        return { type: 'scalar', subType: this.getScalarType(columnInfo.type) };
    }
  }

  /** Get the type of an enum from sequelize column description */
  private getEnumType(columnInfo: ColumnDescription): ColumnType {
    return columnInfo.enumValues.length > 0
      ? { type: 'enum', values: columnInfo.enumValues }
      : // User-defined enum with no values will default to string
        { type: 'scalar', subType: 'STRING' };
  }

  /**
   * Get the type of an array from sequelize column description
   * Note that we don't need to write multiple SQL queries, because arrays are only supported by
   * Postgres
   */
  private async getArrayType(
    tableIdentifier: SequelizeTableIdentifier,
    columnName: string,
  ): Promise<ColumnType> {
    // Get the type of the elements in the array from the database
    const [{ udtName, dataType, charLength, schema, rawEnumValues }] = await this.sequelize.query<{
      udtName: string;
      charLength: number;
      dataType: string;
      schema: string;
      rawEnumValues: string;
    }>(
      `SELECT
        e.udt_name AS "udtName",
        e.data_type AS "dataType",
        e.character_maximum_length as "charLength",
        (
          SELECT ns.nspname
          FROM pg_catalog.pg_namespace ns JOIN pg_catalog.pg_type t ON ns.oid = t.typnamespace
          WHERE t.typname = e.udt_name
        ) as "schema",
        (
          SELECT array_agg(en.enumlabel)
          FROM pg_catalog.pg_type t JOIN pg_catalog.pg_enum en ON t.oid = en.enumtypid
          WHERE t.typname = e.udt_name
        ) AS "rawEnumValues"
      FROM INFORMATION_SCHEMA.columns c
      LEFT JOIN INFORMATION_SCHEMA.element_types e ON (
        c.table_catalog = e.object_catalog AND
        c.table_schema = e.object_schema AND
        c.table_name = e.object_name AND
        'TABLE' = e.object_type AND
        (:schema IS NULL OR c.table_schema = :schema) AND
        c.dtd_identifier = e.collection_type_identifier
      )
      WHERE table_name = :tableName AND c.column_name = :columnName;`.replace(/\s+/g, ' '),
      {
        replacements: {
          tableName: tableIdentifier.tableName,
          schema: tableIdentifier.schema || null,
          columnName,
        },
        type: QueryTypes.SELECT,
      },
    );

    let subType: ColumnType;

    if (rawEnumValues !== null) {
      const queryInterface = this.sequelize.getQueryInterface();
      const queryGen = queryInterface.queryGenerator as { fromArray: (values: string) => string[] };
      const enumValues = queryGen.fromArray(rawEnumValues);

      subType = { type: 'enum', schema, name: udtName, values: [...enumValues].sort() };
    } else {
      const dataTypeWithLength = charLength ? `${dataType}(${charLength})` : dataType;

      subType = { type: 'scalar', subType: this.getScalarType(dataTypeWithLength) };
    }

    return { type: 'array', subType };
  }

  private getScalarType(type: string): ScalarSubType {
    const upType = type.toUpperCase();

    switch (upType) {
      case 'JSON':
        return 'JSON';
      case 'BIT(1)': // In MySQL / MariaDB / Postgres, BIT(N) is used for bitmasks
      case 'TINYINT(1)': // MYSQL bool
      case 'BIT': // MSSQL type.
      case 'BOOLEAN':
        return 'BOOLEAN';
      case 'CHARACTER VARYING':
      case 'TEXT':
      case 'NTEXT': // MSSQL type
      case this.typeContains(upType, 'TEXT'):
      case this.typeContains(upType, 'VARCHAR'):
      case this.typeContains(upType, 'CHAR'):
      case 'NVARCHAR': // NOTICE: MSSQL type
        return 'STRING';

      case this.typeStartsWith(upType, 'VARBINARY'):
      case this.typeStartsWith(upType, 'BINARY'):
      case 'TINYBLOB':
      case 'BLOB':
      case 'MEDIUMBLOB':
      case 'LONGBLOB':
      case 'BYTEA': // Postgres type
        return 'BLOB';

      case 'UNIQUEIDENTIFIER':
      case 'UUID':
        return 'UUID';
      case 'JSONB':
        return 'JSONB';
      case 'INTEGER':
      case 'SERIAL':
      case 'BIGSERIAL':
      case this.typeStartsWith(upType, 'INT'):
      case this.typeStartsWith(upType, 'SMALLINT'):
      case this.typeStartsWith(upType, 'TINYINT'):
      case this.typeStartsWith(upType, 'MEDIUMINT'):
        return 'NUMBER';
      case this.typeStartsWith(upType, 'BIGINT'):
        return 'BIGINT';
      case this.typeContains(upType, 'FLOAT'):
        return 'FLOAT';
      case 'NUMERIC':
      case 'REAL':
      case 'DOUBLE':
      case 'DOUBLE PRECISION':
      case this.typeContains(upType, 'DECIMAL'):
        return 'DOUBLE';
      case 'DATE':
        return 'DATEONLY';
      case this.typeStartsWith(upType, 'DATETIME'):
      case this.typeStartsWith(upType, 'TIMESTAMP'):
        return 'DATE';
      case 'TIME':
      case 'TIME WITHOUT TIME ZONE':
        return 'TIME';
      case 'INET':
        return 'INET';
      default:
        throw new Error(`Unsupported type: ${type}`);
    }
  }

  private typeMatch(type: string, value: string | RegExp) {
    return (type.match(value) || {}).input;
  }

  private typeStartsWith(type: string, value: string) {
    return this.typeMatch(type, new RegExp(`^${value}.*`, 'i'));
  }

  private typeContains(type: string, value: string) {
    return this.typeMatch(type, new RegExp(`${value}.*`, 'i'));
  }
}
