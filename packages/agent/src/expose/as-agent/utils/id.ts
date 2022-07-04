import {
  CollectionSchema,
  ColumnSchema,
  CompositeId,
  FieldValidator,
  RecordData,
  SchemaUtils,
  ValidationError,
} from '@forestadmin/datasource-toolkit';

export default class IdUtils {
  static packIds(schema: CollectionSchema, records: RecordData[]): string[] {
    return records.map(packedId => IdUtils.packId(schema, packedId));
  }

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
    if (!Array.isArray(packedIds)) {
      throw new ValidationError(`Expected array, received: ${typeof packedIds}`);
    }

    return packedIds.map(packedId => IdUtils.unpackId(schema, packedId));
  }

  static unpackId(schema: CollectionSchema, packedId: string): CompositeId {
    if (typeof packedId !== 'string') {
      throw new ValidationError(`Expected string, received: ${typeof packedId}`);
    }

    const pkNames = SchemaUtils.getPrimaryKeys(schema);
    const pkValues = packedId.split('|');

    if (pkValues.length !== pkNames.length) {
      throw new ValidationError(`Expected ${pkNames.length} values, found ${pkValues.length}`);
    }

    return pkNames.map((pkName, index) => {
      const schemaField = schema.fields[pkName] as ColumnSchema;
      const value = pkValues[index];

      const castedValue = schemaField.columnType === 'Number' ? Number(value) : value;
      FieldValidator.validateValue(pkName, schemaField, castedValue);

      return castedValue;
    });
  }
}
