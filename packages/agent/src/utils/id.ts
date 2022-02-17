import {
  CollectionSchema,
  ColumnSchema,
  CompositeId,
  PrimitiveTypes,
  RecordData,
  SchemaUtils,
  ValidationError,
} from '@forestadmin/datasource-toolkit';
import TypeGetter from '@forestadmin/datasource-toolkit/dist/src/validation/type-getter';

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
      const { columnType } = schema.fields[pkName] as ColumnSchema;
<<<<<<< HEAD
      const value = pkValues[index];

      if (
        TypeGetter.get(value, columnType as PrimitiveTypes) !== columnType ||
        (columnType === PrimitiveTypes.Number && !Number.isFinite(Number(value)))
      ) {
        throw new ValidationError(`Failed to parse ${columnType} from ${pkValues[index]}`);
      }

      return columnType === PrimitiveTypes.Number ? Number(value) : value;
=======
      const part = pkValues[index];

      if (TypeGetter.get(part, columnType as PrimitiveTypes) === columnType) {
        const partAsNumber = Number(part);

        if (columnType === PrimitiveTypes.Number && !Number.isFinite(partAsNumber)) {
          throw new ValidationError(`Failed to parse ${columnType} from ${pkValues[index]}`);
        }

        return columnType === PrimitiveTypes.Number ? partAsNumber : part;
      }

      throw new ValidationError(`Failed to parse ${columnType} from ${pkValues[index]}`);
>>>>>>> de360fb (fix(unpack): throw error when the column schema has not the same type of the value)
    });
  }
}
