import { AbstractDataType, AbstractDataTypeConstructor, ArrayDataType, DataTypes } from 'sequelize';

import { ColumnType, Operator, PrimitiveTypes } from '@forestadmin/datasource-toolkit';

export default class TypeConverter {
  // TODO: Allow to differentiate NUMBER and INTEGER.
  private static readonly columnTypeToDataType = {
    [PrimitiveTypes.Boolean]: DataTypes.BOOLEAN,
    [PrimitiveTypes.Date]: DataTypes.DATE,
    [PrimitiveTypes.Dateonly]: DataTypes.DATEONLY,
    [PrimitiveTypes.Enum]: DataTypes.ENUM,
    [PrimitiveTypes.Json]: DataTypes.JSON,
    [PrimitiveTypes.Number]: DataTypes.NUMBER,
    [PrimitiveTypes.Point]: null,
    [PrimitiveTypes.String]: DataTypes.STRING,
    [PrimitiveTypes.Timeonly]: DataTypes.TIME,
    [PrimitiveTypes.Uuid]: DataTypes.UUID,
  };

  // TODO: Handle all ColumnTypes, not only PrimitiveTypes?
  public static fromColumnType(columnType: PrimitiveTypes): AbstractDataTypeConstructor {
    const dataType = TypeConverter.columnTypeToDataType[columnType];

    if (!dataType) throw new Error(`Unsupported column type: "${columnType}".`);

    return dataType;
  }

  private static readonly dataTypeToColumnType = {
    BIGINT: PrimitiveTypes.Number,
    BLOB: null,
    BOOLEAN: PrimitiveTypes.Boolean,
    CHAR: PrimitiveTypes.String,
    CIDR: null,
    CITEXT: PrimitiveTypes.String,
    DATE: PrimitiveTypes.Date,
    DATEONLY: PrimitiveTypes.Dateonly,
    DECIMAL: PrimitiveTypes.Number,
    DOUBLE: PrimitiveTypes.Number,
    ENUM: PrimitiveTypes.Enum,
    FLOAT: PrimitiveTypes.Number,
    GEOGRAPHY: null,
    GEOMETRY: null,
    HSTORE: null,
    INET: null,
    INTEGER: PrimitiveTypes.Number,
    JSONB: PrimitiveTypes.Json,
    JSONTYPE: null,
    MACADDR: null,
    MEDIUMINT: PrimitiveTypes.Number,
    NOW: PrimitiveTypes.Date,
    NUMBER: PrimitiveTypes.Number,
    RANGE: null,
    REAL: PrimitiveTypes.Number,
    SMALLINT: PrimitiveTypes.Number,
    STRING: PrimitiveTypes.String,
    TEXT: PrimitiveTypes.String,
    TIME: PrimitiveTypes.Timeonly,
    TINYINT: PrimitiveTypes.Number,
    TSVECTOR: null,
    UUID: PrimitiveTypes.Uuid,
    UUIDV1: PrimitiveTypes.Uuid,
    UUIDV4: PrimitiveTypes.Uuid,
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
    Operator.Blank,
    Operator.Equal,
    Operator.Missing,
    Operator.NotEqual,
    Operator.Present,
  ];

  public static operatorsForDataType(
    dataType: AbstractDataTypeConstructor | ArrayDataType<AbstractDataTypeConstructor>,
  ): Set<Operator> {
    const dataTypeName = dataType?.key;

    if (dataTypeName === 'ARRAY') {
      return new Set<Operator>([
        ...this.baseOperators,
        Operator.In,
        Operator.IncludesAll,
        Operator.NotIn,
      ]);
    }

    switch (dataTypeName) {
      case 'BOOLEAN':
        return new Set<Operator>([...this.baseOperators]);
      case 'UUID':
      case 'UUIDV1':
      case 'UUIDV4':
        return new Set<Operator>([
          ...this.baseOperators,
          Operator.Contains,
          Operator.EndsWith,
          Operator.Like,
          Operator.StartsWith,
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
        return new Set<Operator>([
          ...this.baseOperators,
          Operator.GreaterThan,
          Operator.In,
          Operator.LessThan,
          Operator.NotIn,
        ]);
      case 'CHAR':
      case 'CITEXT':
      case 'STRING':
      case 'TEXT':
        return new Set<Operator>([
          ...this.baseOperators,
          Operator.Contains,
          Operator.EndsWith,
          Operator.In,
          Operator.Like,
          Operator.LongerThan,
          Operator.NotContains,
          Operator.NotIn,
          Operator.ShorterThan,
          Operator.StartsWith,
        ]);
      case 'DATE':
      case 'DATEONLY':
      case 'NOW':
      case 'TIME':
        return new Set<Operator>([...this.baseOperators, Operator.GreaterThan, Operator.LessThan]);
      case 'ENUM':
        return new Set<Operator>([...this.baseOperators, Operator.In, Operator.NotIn]);
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
