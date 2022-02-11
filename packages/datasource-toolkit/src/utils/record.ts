import { CollectionSchema } from '../interfaces/schema';
import { CompositeId, RecordData } from '../interfaces/record';
import SchemaUtils from './schema';

export default class RecordUtils {
  static getPrimaryKey(schema: CollectionSchema, record: RecordData): CompositeId {
    return SchemaUtils.getPrimaryKeys(schema).map(pk => {
      if (record[pk] === undefined) throw new Error(`Missing primary key: ${pk}`);

      return record[pk] as number | string;
    });
  }

  /**
   * Get value of field from record
   */
  static getFieldValue(record: RecordData, field: string): unknown {
    const path = field.split(':');
    let current = record;

    while (path.length && current) {
      current = current[path.shift()] as RecordData;
    }

    return path.length === 0 ? current : undefined;
  }
}
