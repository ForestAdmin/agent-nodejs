import { AbstractDataTypeConstructor, ArrayDataType, DataType, DataTypes } from 'sequelize';

import { ColumnType, Operator, PrimitiveTypes } from '@forestadmin/datasource-toolkit';

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

  private static getColumnTypeFromDataType(dataType: DataType): PrimitiveTypes {
    switch (true) {
      case dataType instanceof DataTypes.BOOLEAN:
        return 'Boolean';
      case dataType instanceof DataTypes.DATE:
      case dataType instanceof DataTypes.NOW:
        return 'Date';
      case dataType instanceof DataTypes.DATEONLY:
        return 'Dateonly';
      case dataType instanceof DataTypes.ENUM:
        return 'Enum';
      case dataType instanceof DataTypes.JSON:
      case dataType instanceof DataTypes.JSONB:
        return 'Json';
      case dataType instanceof DataTypes.BIGINT:
      case dataType instanceof DataTypes.DECIMAL:
      case dataType instanceof DataTypes.DOUBLE:
      case dataType instanceof DataTypes.FLOAT:
      case dataType instanceof DataTypes.INTEGER:
      case dataType instanceof DataTypes.MEDIUMINT:
      case dataType instanceof DataTypes.NUMBER:
      case dataType instanceof DataTypes.REAL:
      case dataType instanceof DataTypes.SMALLINT:
      case dataType instanceof DataTypes.TINYINT:
        return 'Number';
      case dataType instanceof DataTypes.CHAR:
      case dataType instanceof DataTypes.CITEXT:
      case dataType instanceof DataTypes.STRING:
      case dataType instanceof DataTypes.TEXT:
        return 'String';
      case dataType instanceof DataTypes.TIME:
        return 'Timeonly';
      case dataType instanceof DataTypes.UUID:
      case dataType instanceof DataTypes.UUIDV1:
      case dataType instanceof DataTypes.UUIDV4:
        return 'Uuid';
      default:
        // TODO put logging warning
        console.warn(`Unsupported data type: "${dataType}".`);
    }
  }

  public static fromDataType(dataType: DataType): ColumnType {
    if (dataType instanceof DataTypes.ARRAY) {
      const arrayDataType = dataType as ArrayDataType<AbstractDataTypeConstructor>;

      return [TypeConverter.fromDataType(arrayDataType.type)];
    }

    return TypeConverter.getColumnTypeFromDataType(dataType);
  }

  private static readonly baseOperators: Operator[] = [
    'Blank',
    'Equal',
    'Missing',
    'NotEqual',
    'Present',
  ];

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
          'Contains',
          'EndsWith',
          'In',
          'Like',
          'LongerThan',
          'NotContains',
          'NotIn',
          'ShorterThan',
          'StartsWith',
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
