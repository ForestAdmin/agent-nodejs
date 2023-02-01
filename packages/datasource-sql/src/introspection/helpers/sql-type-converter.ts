import { ColumnDescription, QueryTypes, Sequelize } from 'sequelize';

import { ColumnType, ScalarSubType } from '../types';

export default class SqlTypeConverter {
  private static readonly enumRegex = /ENUM\((.*)\)/i;
  private readonly sequelize: Sequelize;

  constructor(sequelize: Sequelize) {
    this.sequelize = sequelize;
  }

  async convert(
    tableName: string,
    columnName: string,
    columnInfo: ColumnDescription,
  ): Promise<ColumnType> {
    switch (columnInfo.type) {
      case 'ARRAY':
        return this.getArrayType(tableName, columnName);

      case 'USER-DEFINED':
      case this.typeMatch(columnInfo.type, SqlTypeConverter.enumRegex):
        return this.getEnumType(columnInfo);

      default:
        return { type: 'scalar', subType: this.getScalarType(columnInfo.type) };
    }
  }

  /** Get the type of an enum from sequelize column description */
  private getEnumType(columnInfo: ColumnDescription): ColumnType {
    if (columnInfo.type === 'USER-DEFINED') {
      // Postgres enum
      return columnInfo?.special?.length > 0
        ? { type: 'enum', values: columnInfo.special }
        : // User-defined enum with no values will default to string
          { type: 'scalar', subType: 'STRING' };
    }

    // Other SGDB
    const enumOptions = SqlTypeConverter.enumRegex.exec(columnInfo.type)?.[1];

    return { type: 'enum', values: enumOptions.replace(/'/g, '').split(',') };
  }

  /** Get the type of an array from sequelize column description */
  private async getArrayType(tableName: string, columnName: string): Promise<ColumnType> {
    // Get the type of the elements in the array from the database
    const [{ udtName, dataType, charLength, rawEnumValues }] = await this.sequelize.query<{
      udtName: string;
      charLength: number;
      dataType: string;
      rawEnumValues: string;
    }>(
      `SELECT
        e.udt_name AS "udtName",
        e.data_type AS "dataType",
        e.character_maximum_length as "charLength",
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
        c.dtd_identifier = e.collection_type_identifier
      )
      WHERE table_name = :tableName AND c.column_name = :columnName;`.replace(/\s+/g, ' '),
      { replacements: { tableName, columnName }, type: QueryTypes.SELECT },
    );

    let subType: ColumnType;

    if (rawEnumValues !== null) {
      const queryInterface = this.sequelize.getQueryInterface();
      const queryGen = queryInterface.queryGenerator as { fromArray: (values: string) => string[] };
      const enumValues = queryGen.fromArray(rawEnumValues);

      subType = { type: 'enum', name: udtName, values: enumValues };
    } else {
      const dataTypeWithLength = charLength ? `${dataType}(${charLength})` : dataType;

      subType = { type: 'scalar', subType: this.getScalarType(dataTypeWithLength) };
    }

    return { type: 'array', subType };
  }

  private getScalarType(type: string): ScalarSubType {
    switch (type.toUpperCase()) {
      case 'JSON':
        return 'JSON';
      case 'TINYINT(1)': // MYSQL bool
      case 'BIT': // NOTICE: MSSQL type.
      case 'BOOLEAN':
        return 'BOOLEAN';
      case 'CHARACTER VARYING':
      case 'TEXT':
      case 'NTEXT': // MSSQL type
      case this.typeContains(type, 'TEXT'):
      case this.typeContains(type, 'VARCHAR'):
      case this.typeContains(type, 'CHAR'):
      case 'NVARCHAR': // NOTICE: MSSQL type.
        return 'STRING';
      case 'UNIQUEIDENTIFIER':
      case 'UUID':
        return 'UUID';
      case 'JSONB':
        return 'JSONB';
      case 'INTEGER':
      case 'SERIAL':
      case 'BIGSERIAL':
      case this.typeStartsWith(type, 'INT'):
      case this.typeStartsWith(type, 'SMALLINT'):
      case this.typeStartsWith(type, 'TINYINT'):
      case this.typeStartsWith(type, 'MEDIUMINT'):
        return 'NUMBER';
      case this.typeStartsWith(type, 'BIGINT'):
        return 'BIGINT';
      case this.typeContains(type, 'FLOAT'):
        return 'FLOAT';
      case 'NUMERIC':
      case 'REAL':
      case 'DOUBLE':
      case 'DOUBLE PRECISION':
      case this.typeContains(type, 'DECIMAL'):
        return 'DOUBLE';
      case 'DATE':
        return 'DATEONLY';
      case this.typeStartsWith(type, 'DATETIME'):
      case this.typeStartsWith(type, 'TIMESTAMP'):
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
