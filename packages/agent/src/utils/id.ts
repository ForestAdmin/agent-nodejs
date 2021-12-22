import {
  CollectionSchema,
  ColumnSchema,
  CompositeId,
  PrimitiveTypes,
  RecordData,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';

export default class IdUtils {
  static packId(schema: CollectionSchema, record: RecordData): string {
    const pks = SchemaUtils.getPrimaryKeys(schema);

    if (!pks.length) {
      throw new Error('This collection has no primary key');
    }

    return pks
      .map(pk => {
        if (record[pk] === undefined) {
          throw new Error(`RecordData is missing field ${pk}`);
        }

        return String(record[pk]);
      })
      .join('|');
  }

  static unpackId(schema: CollectionSchema, packedId: string): CompositeId {
    const parts = packedId.split('|');
    const pks = SchemaUtils.getPrimaryKeys(schema);

    if (parts.length !== pks.length) {
      throw new Error(`Expected ${pks.length} parts, found ${parts.length}`);
    }

    return pks.map((pk, index) => {
      const { columnType } = schema.fields[pk] as ColumnSchema;
      const part = parts[index];

      if (columnType !== PrimitiveTypes.Number) {
        return part;
      }

      const partAsNumber = Number(part);

      if (!Number.isFinite(partAsNumber)) {
        throw new Error(`Failed to parse number from ${parts[index]}`);
      }

      return partAsNumber;
    });
  }
}
