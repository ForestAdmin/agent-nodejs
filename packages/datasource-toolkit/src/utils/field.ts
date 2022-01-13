import { Collection } from '../interfaces/collection';
import { FieldTypes } from '../interfaces/schema';

export default class FieldUtils {
  static validate(collection: Collection, field: string) {
    const schema = collection.schema.fields[field];

    if (schema.type !== FieldTypes.Column) {
      throw new Error(`Unexpected field type: ${schema.type} for field ${field}`);
    }
  }
}
