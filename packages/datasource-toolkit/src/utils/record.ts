import { Collection } from '../interfaces/collection';
import { CollectionSchema, FieldTypes } from '../interfaces/schema';
import { CompositeId, RecordData } from '../interfaces/record';
import FieldValidator from '../validation/field';
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

  static validate(collection: Collection, recordData: RecordData): void {
    if (!recordData || Object.keys(recordData).length === 0) {
      throw new Error('The record data is empty');
    }

    for (const key of Object.keys(recordData)) {
      const schema = collection.schema.fields[key];

      if (!schema) {
        throw new Error(`Unknown field "${key}"`);
      } else if (schema.type === FieldTypes.Column) {
        FieldValidator.validate(collection, key, [recordData[key]]);
      } else if (schema.type === FieldTypes.OneToOne || schema.type === FieldTypes.OneToMany) {
        const subRecord = recordData[key] as RecordData;

        const association = collection.dataSource.getCollection(schema.foreignCollection);
        RecordUtils.validate(association, subRecord);
      } else {
        throw new Error(`Unexpected schema type '${schema.type}' while traversing record`);
      }
    }
  }
}
