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
    const pkNames = SchemaUtils.getPrimaryKeys(schema);

    if (!pkNames.length) {
      throw new Error('This collection has no primary key');
    }

    if (pkNames.some(pkName => record[pkName] === undefined)) {
      throw new Error(`Missing one of expected fields: '${pkNames.join("', '")}'`);
    }

    return pkNames.map(pk => String(record[pk])).join('|');
  }

  static unpackIds(schema: CollectionSchema, packedIds: string[]): CompositeId[] {
    return packedIds.map(packedId => IdUtils.unpackId(schema, packedId));
  }

  static unpackId(schema: CollectionSchema, packedId: string): CompositeId {
    const pkNames = SchemaUtils.getPrimaryKeys(schema);
    const pkValues = packedId.split('|');

    if (pkValues.length !== pkNames.length) {
      throw new Error(`Expected ${pkNames.length} values, found ${pkValues.length}`);
    }

    return pkNames.map((pkName, index) => {
      const { columnType } = schema.fields[pkName] as ColumnSchema;
      const part = pkValues[index];

      if (columnType === PrimitiveTypes.Number) {
        const partAsNumber = Number(part);

        if (!Number.isFinite(partAsNumber)) {
          throw new Error(`Failed to parse number from ${pkValues[index]}`);
        }

        return partAsNumber;
      }

      return part;
    });
  }
}
