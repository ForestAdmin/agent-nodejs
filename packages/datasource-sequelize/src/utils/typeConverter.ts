import { PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import { DataTypes } from 'sequelize/dist';

export default class TypeConverter {
  private static readonly dataTypeToColumnType = {
    STRING: PrimitiveTypes.String,
    CHAR: PrimitiveTypes.String,
    TEXT: PrimitiveTypes.String,
    CITEXT: PrimitiveTypes.String,
    NUMBER: PrimitiveTypes.Number,
    INTEGER: PrimitiveTypes.Number,
    TINYINT: PrimitiveTypes.Number,
    SMALLINT: PrimitiveTypes.Number,
    MEDIUMINT: PrimitiveTypes.Number,
    BIGINT: PrimitiveTypes.Number,
    FLOAT: PrimitiveTypes.Number,
    REAL: PrimitiveTypes.Number,
    DOUBLE: PrimitiveTypes.Number,
    DECIMAL: PrimitiveTypes.Number,
    BOOLEAN: PrimitiveTypes.Boolean,
    TIME: PrimitiveTypes.Timeonly,
    DATE: PrimitiveTypes.Date,
    DATEONLY: PrimitiveTypes.Dateonly,
    HSTORE: null,
    JSONTYPE: null,
    JSONB: PrimitiveTypes.Json,
    NOW: PrimitiveTypes.Date,
    BLOB: null,
    RANGE: null,
    UUID: PrimitiveTypes.Uuid,
    UUIDV1: PrimitiveTypes.Uuid,
    UUIDV4: PrimitiveTypes.Uuid,
    VIRTUAL: null,
    ENUM: PrimitiveTypes.Enum,
    ARRAY: null,
    GEOMETRY: null,
    GEOGRAPHY: null,
    CIDR: null,
    INET: null,
    MACADDR: null,
    TSVECTOR: null,
  };

  public static fromDataType(dataType) {
    const columnType = TypeConverter.dataTypeToColumnType[dataType];

    if (!columnType) throw new Error(`Unsupported data type: ${dataType}`);

    return columnType;
  }

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

  public static fromColumnType(columnType) {
    const dataType = TypeConverter.columnTypeToDataType[columnType];

    if (!dataType) throw new Error(`Unsupported data type: ${columnType}`);

    return dataType;
  }
}
