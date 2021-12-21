import {
  Collection,
  ColumnSchema,
  CompositeId,
  PrimitiveTypes,
  RecordData,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';

export default class IdUtils {
  static packId(collection: Collection, record: RecordData): string {
    return SchemaUtils.getPrimaryKeys(collection.schema)
      .map(pk => String(record[pk]))
      .join('|');
  }

  static unpackId(collection: Collection, packedId: string): CompositeId {
    const parts = packedId.split('|');

    return SchemaUtils.getPrimaryKeys(collection.schema).map((pk, index) => {
      const { columnType } = collection.schema.fields[pk] as ColumnSchema;

      switch (columnType) {
        case PrimitiveTypes.Number:
          return Number(parts[index]);
        case PrimitiveTypes.Enum:
        case PrimitiveTypes.String:
        case PrimitiveTypes.Uuid:
          return parts[index];

        default:
          throw new Error(`Unexpected type for composite primary key: ${columnType}`);
      }
    });
  }
}
