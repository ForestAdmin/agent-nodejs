import FieldValidator from './field';
import { ValidationError } from '../errors';
import { SchemaUtils } from '../index';
import { Collection } from '../interfaces/collection';
import { RecordData } from '../interfaces/record';

export default class RecordValidator {
  static validate(collection: Collection, recordData: RecordData): void {
    if (!recordData || Object.keys(recordData).length === 0) {
      throw new ValidationError('The record data is empty');
    }

    for (const key of Object.keys(recordData)) {
      const schema = SchemaUtils.getField(collection.schema, key, collection.name);

      if (schema.type === 'Column') {
        FieldValidator.validate(collection, key, [recordData[key]]);
      } else if (schema.type === 'OneToOne' || schema.type === 'ManyToOne') {
        const subRecord = recordData[key] as RecordData;

        const association = collection.dataSource.getCollection(schema.foreignCollection);
        RecordValidator.validate(association, subRecord);
      } else {
        throw new ValidationError(
          `Unexpected schema type '${schema.type}' while traversing record`,
        );
      }
    }
  }
}
