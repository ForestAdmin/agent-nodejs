import {
  AbstractDataType,
  AbstractDataTypeConstructor,
  ColumnDescription,
  DataTypes,
  EnumDataType,
  Sequelize,
} from 'sequelize';

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

  private convertToEnum(type: string): EnumDataType<string> {
    const enumOptions = this.enumRegex.exec(type)?.[1];

    return DataTypes.ENUM(...enumOptions.replace(/'/g, '').split(','));
  }

  private getTypeForUserDefined(
    columnInfo: ColumnDescription,
  ): AbstractDataType | AbstractDataTypeConstructor {
    const { special } = columnInfo;

    if (special) {
      return DataTypes.ENUM(...special);
    }

    return DataTypes.STRING;
  }

  private async getTypeForArray(tableName: string, columnName: string): Promise<AbstractDataType> {
    const { type, special } = await this.arrayTypeGetter.getType(tableName, columnName);

    const arrayType = await this.convert(tableName, columnName, {
      type,
      special,
    } as ColumnDescription);

    return DataTypes.ARRAY(arrayType);
  }

  async convert(
    tableName: string,
    columnName: string,
    columnInfo: ColumnDescription,
  ): Promise<AbstractDataType | AbstractDataTypeConstructor> {
    const { type } = columnInfo;

    switch (type) {
      case 'JSON':
        return DataTypes.JSON;
      case 'TINYINT(1)': // MYSQL bool
      case 'BIT': // NOTICE: MSSQL type.
      case 'BOOLEAN':
        return DataTypes.BOOLEAN;
      case 'CHARACTER VARYING':
      case 'TEXT':
      case 'NTEXT': // MSSQL type
      case this.typeContains(type, 'TEXT'):
      case this.typeContains(type, 'VARCHAR'):
      case this.typeContains(type, 'CHAR'):
      case 'NVARCHAR': // NOTICE: MSSQL type.
        return DataTypes.STRING;
      case 'USER-DEFINED':
        return this.getTypeForUserDefined(columnInfo);
      case this.typeMatch(type, this.enumRegex):
        return this.convertToEnum(type);
      case 'UNIQUEIDENTIFIER':
      case 'UUID':
        return DataTypes.UUID;
      case 'JSONB':
        return DataTypes.JSONB;
      case 'INTEGER':
      case 'SERIAL':
      case 'BIGSERIAL':
      case this.typeStartsWith(type, 'INT'):
      case this.typeStartsWith(type, 'SMALLINT'):
      case this.typeStartsWith(type, 'TINYINT'):
      case this.typeStartsWith(type, 'MEDIUMINT'):
        return DataTypes.NUMBER;
      case this.typeStartsWith(type, 'BIGINT'):
        return DataTypes.BIGINT;
      case this.typeContains(type, 'FLOAT'):
        return DataTypes.FLOAT;
      case 'NUMERIC':
      case 'DECIMAL':
      case 'REAL':
      case 'DOUBLE':
      case 'DOUBLE PRECISION':
      case this.typeContains(type, 'DECIMAL'):
      case 'DATE':
        return DataTypes.DATEONLY;
      case this.typeStartsWith(type, 'DATETIME'):
      case this.typeStartsWith(type, 'TIMESTAMP'):
        return DataTypes.DATE;
      case 'TIME':
      case 'TIME WITHOUT TIME ZONE':
        return DataTypes.TIME;
      case 'ARRAY':
        return this.getTypeForArray(tableName, columnName);
      case 'INET':
        return DataTypes.INET;
      default:
        // TODO put logging warning
        console.warn(type, columnInfo);
    }
  }
}
