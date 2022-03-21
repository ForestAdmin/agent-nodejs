import { Collection } from '../interfaces/collection';
import { FieldTypes } from '../interfaces/schema';
import { RecordData } from '../interfaces/record';
import FieldValidator from './field';
import ValidationError from '../errors';

export default class RecordValidator {
  static validate(collection: Collection, recordData: RecordData): void {
    if (!recordData || Object.keys(recordData).length === 0) {
      throw new ValidationError('The record data is empty');
    }

    for (const key of Object.keys(recordData)) {
      const schema = collection.schema.fields[key];

      if (!schema) {
        throw new ValidationError(`Unknown field "${key}"`);
      } else if (schema.type === FieldTypes.Column) {
        FieldValidator.validate(collection, key, [recordData[key]]);
      } else if (schema.type === FieldTypes.OneToOne || schema.type === FieldTypes.ManyToOne) {
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
