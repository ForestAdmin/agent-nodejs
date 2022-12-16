import { ColumnType, Operator, PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import { AbstractDataType, AbstractDataTypeConstructor, ArrayDataType, DataTypes } from 'sequelize';

export default class TypeConverter {
  // TODO: Allow to differentiate NUMBER and INTEGER.
  private static readonly columnTypeToDataType: Record<
    PrimitiveTypes,
    AbstractDataTypeConstructor
  > = {
    Boolean: DataTypes.BOOLEAN,
    Date: DataTypes.DATE,
    Dateonly: DataTypes.DATEONLY,
    Enum: DataTypes.ENUM,
    Json: DataTypes.JSON,
    Number: DataTypes.NUMBER,
    Point: null,
    String: DataTypes.STRING,
    Timeonly: DataTypes.TIME,
    Uuid: DataTypes.UUID,
  };

  // TODO: Handle all ColumnTypes, not only PrimitiveTypes?
  public static fromColumnType(columnType: PrimitiveTypes): AbstractDataTypeConstructor {
    const dataType = TypeConverter.columnTypeToDataType[columnType];

    if (!dataType) throw new Error(`Unsupported column type: "${columnType}".`);

    return dataType;
  }

  private static getColumnTypeFromDataType(dataType: AbstractDataType): PrimitiveTypes {
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

  private static readonly baseOperators: Operator[] = ['Equal', 'Missing', 'NotEqual', 'Present'];

  public static operatorsForColumnType(columnType: ColumnType): Set<Operator> {
    if (Array.isArray(columnType)) {
      return new Set<Operator>([...TypeConverter.baseOperators, 'In', 'IncludesAll', 'NotIn']);
    }

    switch (columnType) {
      case 'Boolean':
        return new Set<Operator>([...TypeConverter.baseOperators]);
      case 'Uuid':
        return new Set<Operator>([
          ...TypeConverter.baseOperators,
          'Contains',
          'EndsWith',
          'Like',
          'StartsWith',
        ]);
      case 'Number':
        return new Set<Operator>([
          ...TypeConverter.baseOperators,
          'GreaterThan',
          'In',
          'LessThan',
          'NotIn',
        ]);
      case 'String':
        return new Set<Operator>([
          ...TypeConverter.baseOperators,
          'In',
          'Like',
          'ILike',
          'LongerThan',
          'NotContains',
          'NotIn',
          'ShorterThan',
        ]);
      case 'Date':
      case 'Dateonly':
        return new Set<Operator>([...TypeConverter.baseOperators, 'GreaterThan', 'LessThan']);
      case 'Enum':
        return new Set<Operator>([...TypeConverter.baseOperators, 'In', 'NotIn']);
      case 'Json':
        return new Set<Operator>([...TypeConverter.baseOperators]);
      default:
        return new Set<Operator>();
    }
  }
}
