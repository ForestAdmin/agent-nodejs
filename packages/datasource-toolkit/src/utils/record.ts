import { Collection } from '../interfaces/collection';

import Projection from '../interfaces/query/projection';
import { CompositeId, RecordData } from '../interfaces/record';
import { CollectionSchema, FieldTypes, RelationSchema } from '../interfaces/schema';
import SchemaUtils from './schema';
import FieldValidator from '../validation/field';

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

    return current;
  }

  static unflattenRecord(collection: Collection, flatRecord: RecordData): RecordData {
    // If the pks are not defined, we consider the subRecord to be null.
    // Maybe we should do that with a special key to avoid playing so much with projections.
    const primaryKeys = SchemaUtils.getPrimaryKeys(collection.schema);

    if (primaryKeys.some(pk => flatRecord[pk] === undefined || flatRecord[pk] === null)) {
      return null;
    }

    const record: RecordData = {};
    const projection = new Projection(...Object.keys(flatRecord));

    for (const field of projection.columns) {
      record[field] = flatRecord[field];
    }

    for (const [relation, childProjection] of Object.entries(projection.relations)) {
      const schema = collection.schema.fields[relation] as RelationSchema;
      const association = collection.dataSource.getCollection(schema.foreignCollection);
      const subRecord: RecordData = {};
      for (const path of childProjection) subRecord[path] = flatRecord[`${relation}:${path}`];

      record[relation] = RecordUtils.unflattenRecord(association, subRecord);
    }

    return record;
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
