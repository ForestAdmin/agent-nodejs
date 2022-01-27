import { Collection } from '../interfaces/collection';
import Projection from '../interfaces/query/projection';
import { CompositeId, RecordData } from '../interfaces/record';
import { CollectionSchema, RelationSchema } from '../interfaces/schema';
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

    return current;
  }

  static unflattenRecord(collection: Collection, flatRecord: RecordData): RecordData {
    // If the pks are not defined, we consider the subRecord to be null.
    // Maybe we should do that with a special key to avoid playing so much with projections.
    const primaryKeys = SchemaUtils.getPrimaryKeys(collection.schema);

    if (primaryKeys.some(pk => flatRecord[pk] === undefined || flatRecord[pk] === null)) {
      return null;
    }

    const record = {};
    const projection = new Projection(...Object.keys(flatRecord));

    for (const field of projection.columns) {
      record[field] = flatRecord[field];
    }

    for (const [relation, childProjection] of Object.entries(projection.relations)) {
      const schema = collection.schema.fields[relation] as RelationSchema;
      const association = collection.dataSource.getCollection(schema.foreignCollection);
      const subRecord = {};
      for (const path of childProjection) subRecord[path] = flatRecord[`${relation}:${path}`];

      record[relation] = RecordUtils.unflattenRecord(association, subRecord);
    }

    return record;
  }
}
