import { AbstractDataType, AbstractDataTypeConstructor, ArrayDataType, DataTypes } from 'sequelize';

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

  private static readonly dataTypeToColumnType: Record<string, PrimitiveTypes> = {
    BIGINT: 'Number',
    BLOB: null,
    BOOLEAN: 'Boolean',
    CHAR: 'String',
    CIDR: null,
    CITEXT: 'String',
    DATE: 'Date',
    DATEONLY: 'Dateonly',
    DECIMAL: 'Number',
    DOUBLE: 'Number',
    ENUM: 'Enum',
    FLOAT: 'Number',
    GEOGRAPHY: null,
    GEOMETRY: null,
    HSTORE: null,
    INET: null,
    INTEGER: 'Number',
    JSON: 'Json',
    JSONB: 'Json',
    JSONTYPE: null,
    MACADDR: null,
    MEDIUMINT: 'Number',
    NOW: 'Date',
    NUMBER: 'Number',
    RANGE: null,
    REAL: 'Number',
    SMALLINT: 'Number',
    STRING: 'String',
    TEXT: 'String',
    TIME: 'Timeonly',
    TINYINT: 'Number',
    TSVECTOR: null,
    UUID: 'Uuid',
    UUIDV1: 'Uuid',
    UUIDV4: 'Uuid',
    VIRTUAL: null,
  };

  public static fromDataType(
    dataType: AbstractDataTypeConstructor | ArrayDataType<AbstractDataTypeConstructor>,
  ): ColumnType {
    const dataTypeName = (dataType as AbstractDataType).key;

    if (dataTypeName === 'ARRAY') {
      const arrayDataType = dataType as ArrayDataType<AbstractDataTypeConstructor>;

      return [this.fromDataType(arrayDataType.options.type)];
    }

    const columnType = TypeConverter.dataTypeToColumnType[dataTypeName];

    if (!columnType) throw new Error(`Unsupported data type: "${dataType}".`);

    return columnType;
  }

  private static readonly baseOperators: Operator[] = [
    'Blank',
    'Equal',
    'Missing',
    'NotEqual',
    'Present',
  ];

  public static operatorsForDataType(
    dataType: AbstractDataTypeConstructor | ArrayDataType<AbstractDataTypeConstructor>,
  ): Set<Operator> {
    const dataTypeName = dataType?.key;

    if (dataTypeName === 'ARRAY') {
      return new Set<Operator>([...this.baseOperators, 'In', 'IncludesAll', 'NotIn']);
    }

    switch (dataTypeName) {
      case 'BOOLEAN':
        return new Set<Operator>([...this.baseOperators]);
      case 'UUID':
      case 'UUIDV1':
      case 'UUIDV4':
        return new Set<Operator>([
          ...this.baseOperators,
          'Contains',
          'EndsWith',
          'Like',
          'StartsWith',
        ]);
      case 'BIGINT':
      case 'DECIMAL':
      case 'DOUBLE':
      case 'FLOAT':
      case 'INTEGER':
      case 'MEDIUMINT':
      case 'NUMBER':
      case 'REAL':
      case 'SMALLINT':
      case 'TINYINT':
        return new Set<Operator>([...this.baseOperators, 'GreaterThan', 'In', 'LessThan', 'NotIn']);
      case 'CHAR':
      case 'CITEXT':
      case 'STRING':
      case 'TEXT':
        return new Set<Operator>([
          ...this.baseOperators,
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
      case 'DATE':
      case 'DATEONLY':
      case 'NOW':
      case 'TIME':
        return new Set<Operator>([...this.baseOperators, 'GreaterThan', 'LessThan']);
      case 'ENUM':
        return new Set<Operator>([...this.baseOperators, 'In', 'NotIn']);
      case 'JSON':
      case 'JSONB':
        return new Set<Operator>([...this.baseOperators]);
      // Unsupported types.
      case 'BLOB':
      case 'CIDR':
      case 'GEOGRAPHY':
      case 'GEOMETRY':
      case 'HSTORE':
      case 'INET':
      case 'MACADDR':
      case 'RANGE':
      case 'TSVECTOR':
      case 'VIRTUAL':
      default:
        return new Set<Operator>();
    }
  }
}
