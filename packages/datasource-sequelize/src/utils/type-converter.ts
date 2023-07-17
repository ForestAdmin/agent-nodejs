import { ColumnType, Operator, PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import { DataTypeInstance, DataTypes } from '@sequelize/core';
import { ARRAY } from '@sequelize/core/types/dialects/abstract/data-types';

export default class TypeConverter {
  private static getColumnTypeFromDataType(dataType: DataTypeInstance): PrimitiveTypes {
    // See postgres enum handling in @datasource-sql
    if ((dataType as { isDataSourceSqlEnum?: boolean }).isDataSourceSqlEnum) return 'Enum';

    switch (dataType.getDataTypeId()) {
      case DataTypes.BLOB.getDataTypeId():
        return 'Binary';
      case DataTypes.BOOLEAN.getDataTypeId():
        return 'Boolean';
      case DataTypes.DATE.getDataTypeId():
      case DataTypes.NOW.getDataTypeId():
        return 'Date';
      case DataTypes.DATEONLY.getDataTypeId():
        return 'Dateonly';
      case DataTypes.ENUM.getDataTypeId():
        return 'Enum';
      case DataTypes.JSON.getDataTypeId():
      case DataTypes.JSONB.getDataTypeId():
        return 'Json';
      case DataTypes.BIGINT.getDataTypeId():
      case DataTypes.DECIMAL.getDataTypeId():
      case DataTypes.DOUBLE.getDataTypeId():
      case DataTypes.FLOAT.getDataTypeId():
      case DataTypes.INTEGER.getDataTypeId():
      case DataTypes.MEDIUMINT.getDataTypeId():
      case DataTypes.REAL.getDataTypeId():
      case DataTypes.SMALLINT.getDataTypeId():
      case DataTypes.TINYINT.getDataTypeId():
        return 'Number';
      case DataTypes.CHAR.getDataTypeId():
      case DataTypes.CITEXT.getDataTypeId():
      case DataTypes.STRING.getDataTypeId():
      case DataTypes.TEXT.getDataTypeId():
        return 'String';
      case DataTypes.TIME.getDataTypeId():
        return 'Timeonly';
      case DataTypes.UUID.getDataTypeId():
      case DataTypes.UUIDV1.getDataTypeId():
      case DataTypes.UUIDV4.getDataTypeId():
        return 'Uuid';
      default:
        throw new Error(`Unsupported data type: "${dataType}"`);
    }
  }

  public static fromDataType(dataType: DataTypeInstance): ColumnType {
    if (dataType.getDataTypeId() === DataTypes.ARRAY.getDataTypeId()) {
      const arrayDataType = dataType as ARRAY<any>;

      return [TypeConverter.fromDataType(arrayDataType.options.type as DataTypeInstance)];
    }

    return TypeConverter.getColumnTypeFromDataType(dataType);
  }

  public static operatorsForColumnType(columnType: ColumnType): Set<Operator> {
    const result: Operator[] = ['Present', 'Missing'];
    const equality: Operator[] = ['Equal', 'NotEqual', 'In', 'NotIn'];

    if (typeof columnType === 'string') {
      const orderables: Operator[] = ['LessThan', 'GreaterThan'];
      const strings: Operator[] = ['Like', 'ILike', 'NotContains'];

      if (['Boolean', 'Binary', 'Enum', 'Uuid'].includes(columnType)) {
        result.push(...equality);
      }

      if (['Date', 'Dateonly', 'Number'].includes(columnType)) {
        result.push(...equality, ...orderables);
      }

      if (['String'].includes(columnType)) {
        result.push(...equality, ...orderables, ...strings);
      }
    }

    if (Array.isArray(columnType)) {
      result.push(...equality, 'IncludesAll');
    }

    return new Set(result);
  }
}
