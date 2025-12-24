import type { ColumnDescription } from '../dialects/dialect.interface';
import type { SequelizeTableIdentifier } from '../type-overrides';
import type { ColumnType, ScalarSubType } from '../types';

export default class SqlTypeConverter {
  private static readonly enumRegex = /ENUM\((.*)\)/i;

  static async convert(
    tableIdentifier: SequelizeTableIdentifier,
    columnInfo: ColumnDescription,
  ): Promise<ColumnType> {
    switch (columnInfo.type) {
      case 'ARRAY':
        return this.getArrayTypeForPostgres(tableIdentifier, columnInfo);

      case 'USER-DEFINED':
      case this.typeMatch(columnInfo.type, SqlTypeConverter.enumRegex):
        return this.getEnumType(columnInfo);

      default:
        return { type: 'scalar', subType: this.getScalarType(columnInfo.type) };
    }
  }

  /** Get the type of an enum from sequelize column description */
  private static getEnumType(columnInfo: ColumnDescription): ColumnType {
    return columnInfo.enumValues?.length > 0
      ? { type: 'enum', values: columnInfo.enumValues }
      : // User-defined enum with no values will default to string
        { type: 'scalar', subType: 'STRING' };
  }

  /**
   * Get the type of an array from sequelize column description
   * Note that we don't need to write multiple SQL queries, because arrays are only supported by
   * Postgres
   */
  private static async getArrayTypeForPostgres(
    tableIdentifier: SequelizeTableIdentifier,
    columnDescription: ColumnDescription,
  ): Promise<ColumnType> {
    let subType: ColumnType;

    if (columnDescription.enumValues?.length) {
      subType = {
        type: 'enum',
        schema: tableIdentifier.schema,
        name: columnDescription.elementType,
        values: columnDescription.enumValues.sort(),
      };
    } else {
      subType = {
        type: 'scalar',
        subType: this.getScalarType(columnDescription.elementType),
      };
    }

    return { type: 'array', subType };
  }

  private static getScalarType(type: string): ScalarSubType {
    const upType = type.toUpperCase();

    switch (upType) {
      case 'JSON':
        return 'JSON';
      case 'BIT(1)': // In MySQL / MariaDB / Postgres, BIT(N) is used for bitmasks
      case 'TINYINT(1)': // MYSQL bool
      case 'BIT': // MSSQL type.
      case 'BOOLEAN':
        return 'BOOLEAN';
      case 'TEXT':
        return 'TEXT';
      case 'CHARACTER VARYING':
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
      case this.typeStartsWith(upType, 'INT'):
      case this.typeStartsWith(upType, 'SMALLINT'):
      case this.typeStartsWith(upType, 'TINYINT'):
      case this.typeStartsWith(upType, 'MEDIUMINT'):
        return 'INTEGER';
      case 'SERIAL':
      case 'BIGSERIAL':
        return 'NUMBER';
      case this.typeStartsWith(upType, 'BIGINT'):
        return 'BIGINT';
      case this.typeContains(upType, 'FLOAT'):
        return 'FLOAT';
      case 'REAL':
        return 'REAL';
      case 'NUMERIC':
      case this.typeStartsWith(upType, 'NUMERIC'):
      case this.typeContains(upType, 'DECIMAL'):
        return 'DECIMAL';
      case 'DOUBLE':
      case 'DOUBLE PRECISION':
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

  private static typeMatch(type: string, value: string | RegExp) {
    return (type.match(value) || {}).input;
  }

  private static typeStartsWith(type: string, value: string) {
    return this.typeMatch(type, new RegExp(`^${value}.*`, 'i'));
  }

  private static typeContains(type: string, value: string) {
    return this.typeMatch(type, new RegExp(`${value}.*`, 'i'));
  }
}
