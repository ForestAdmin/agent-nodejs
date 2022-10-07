import { ColumnDescription, Sequelize } from 'sequelize';
import { ColumnType } from '../types';
import ArrayTypeGetter from './array-type-getter';

export default class SqlTypeConverter {
  private readonly enumRegex = /ENUM\((.*)\)/i;
  private readonly arrayTypeGetter: ArrayTypeGetter;

  constructor(sequelize: Sequelize) {
    this.arrayTypeGetter = new ArrayTypeGetter(sequelize);
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

  private convertToEnum(type: string): ColumnType {
    const enumOptions = this.enumRegex.exec(type)?.[1];

    return { type: 'enum', values: enumOptions.replace(/'/g, '').split(',') };
  }

  private getTypeForUserDefined(columnInfo: ColumnDescription): ColumnType {
    const { special } = columnInfo;

    if (special && special.length > 0) {
      return { type: 'enum', values: special };
    }

    // User-defined enum with no values will default to string
    return { type: 'scalar', subType: 'STRING' };
  }

  private async getTypeForArray(tableName: string, columnName: string): Promise<ColumnType> {
    const { type, special } = await this.arrayTypeGetter.getType(tableName, columnName);
    const columnInfo = { type, special } as ColumnDescription;
    const arrayType = await this.convert(tableName, columnName, columnInfo);

    return { type: 'array', subType: arrayType };
  }

  async convert(
    tableName: string,
    columnName: string,
    columnInfo: ColumnDescription,
  ): Promise<ColumnType> {
    const { type } = columnInfo;

    switch (type) {
      case 'JSON':
        return { type: 'scalar', subType: 'JSON' };
      case 'TINYINT(1)': // MYSQL bool
      case 'BIT': // NOTICE: MSSQL type.
      case 'BOOLEAN':
        return { type: 'scalar', subType: 'BOOLEAN' };
      case 'CHARACTER VARYING':
      case 'TEXT':
      case 'NTEXT': // MSSQL type
      case this.typeContains(type, 'TEXT'):
      case this.typeContains(type, 'VARCHAR'):
      case this.typeContains(type, 'CHAR'):
      case 'NVARCHAR': // NOTICE: MSSQL type.
        return { type: 'scalar', subType: 'STRING' };
      case 'USER-DEFINED':
        return this.getTypeForUserDefined(columnInfo);
      case this.typeMatch(type, this.enumRegex):
        return this.convertToEnum(type);
      case 'UNIQUEIDENTIFIER':
      case 'UUID':
        return { type: 'scalar', subType: 'UUID' };
      case 'JSONB':
        return { type: 'scalar', subType: 'JSONB' };
      case 'INTEGER':
      case 'SERIAL':
      case 'BIGSERIAL':
      case this.typeStartsWith(type, 'INT'):
      case this.typeStartsWith(type, 'SMALLINT'):
      case this.typeStartsWith(type, 'TINYINT'):
      case this.typeStartsWith(type, 'MEDIUMINT'):
        return { type: 'scalar', subType: 'NUMBER' };
      case this.typeStartsWith(type, 'BIGINT'):
        return { type: 'scalar', subType: 'BIGINT' };
      case this.typeContains(type, 'FLOAT'):
        return { type: 'scalar', subType: 'FLOAT' };
      case 'NUMERIC':
      case 'REAL':
      case 'DOUBLE':
      case 'DOUBLE PRECISION':
      case this.typeContains(type, 'DECIMAL'):
        return { type: 'scalar', subType: 'DOUBLE' };
      case 'DATE':
        return { type: 'scalar', subType: 'DATEONLY' };
      case this.typeStartsWith(type, 'DATETIME'):
      case this.typeStartsWith(type, 'TIMESTAMP'):
        return { type: 'scalar', subType: 'DATE' };
      case 'TIME':
      case 'TIME WITHOUT TIME ZONE':
        return { type: 'scalar', subType: 'TIME' };
      case 'ARRAY':
        return this.getTypeForArray(tableName, columnName);
      case 'INET':
        return { type: 'scalar', subType: 'INET' };
      default:
        throw new Error(`Unsupported type: ${type}`);
    }
  }
}
