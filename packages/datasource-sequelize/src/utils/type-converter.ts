import { ColumnType, Operator, PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import { AbstractDataType, AbstractDataTypeConstructor, ArrayDataType, DataTypes } from 'sequelize';

export default class TypeConverter {
  private static getColumnTypeFromDataType(dataType: AbstractDataType): PrimitiveTypes {
    // See postgres enum handling in @datasource-sql
    if ((dataType as { isDataSourceSqlEnum?: boolean }).isDataSourceSqlEnum) return 'Enum';

    switch (dataType.key) {
      case DataTypes.BOOLEAN.key:
        return 'Boolean';
      case DataTypes.DATE.key:
      case DataTypes.NOW.key:
        return 'Date';
      case DataTypes.DATEONLY.key:
        return 'Dateonly';
      case DataTypes.ENUM.key:
        return 'Enum';
      case DataTypes.JSON.key:
      case DataTypes.JSONB.key:
        return 'Json';
      case DataTypes.BIGINT.key:
      case DataTypes.DECIMAL.key:
      case DataTypes.DOUBLE.key:
      case DataTypes.FLOAT.key:
      case DataTypes.INTEGER.key:
      case DataTypes.MEDIUMINT.key:
      case DataTypes.NUMBER.key:
      case DataTypes.REAL.key:
      case DataTypes.SMALLINT.key:
      case DataTypes.TINYINT.key:
        return 'Number';
      case DataTypes.CHAR.key:
      case DataTypes.CITEXT.key:
      case DataTypes.STRING.key:
      case DataTypes.TEXT.key:
        return 'String';
      case DataTypes.TIME.key:
        return 'Timeonly';
      case DataTypes.UUID.key:
      case DataTypes.UUIDV1.key:
      case DataTypes.UUIDV4.key:
        return 'Uuid';
      default:
        throw new Error(`Unsupported data type: "${dataType}"`);
    }
  }

  public static fromDataType(dataType: AbstractDataType): ColumnType {
    if (dataType.key === DataTypes.ARRAY.key) {
      const arrayDataType = dataType as ArrayDataType<AbstractDataTypeConstructor>;

      return [TypeConverter.fromDataType(arrayDataType.type as unknown as AbstractDataType)];
    }

    return TypeConverter.getColumnTypeFromDataType(dataType);
  }

  public static operatorsForColumnType(columnType: ColumnType): Set<Operator> {
    const result: Operator[] = ['Present', 'Missing'];
    const equality: Operator[] = ['Equal', 'NotEqual', 'In', 'NotIn'];

    if (typeof columnType === 'string') {
      const orderables: Operator[] = ['LessThan', 'GreaterThan'];
      const strings: Operator[] = ['Like', 'ILike', 'NotContains'];

      if (['Boolean', 'Enum', 'Uuid'].includes(columnType)) {
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
