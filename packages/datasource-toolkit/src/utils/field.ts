import { Collection } from '../interfaces/collection';
import { FieldTypes } from '../interfaces/schema';

export default class FieldUtils {
  static validate(collection: Collection, field: string, values: any[] = undefined) {
    const dotIndex = field.indexOf(':');

    if (dotIndex === -1) {
      const schema = collection.schema.fields[field];

      if (schema.type !== FieldTypes.Column) {
        throw new Error(`Unexpected field type: ${schema.type} for field ${field}`);
      }

      if (values !== undefined) {
        // Validate value based on column type
        throw new Error('Implement me.');
      }
    } else {
      const prefix = field.substring(0, dotIndex);
      const schema = collection.schema.fields[prefix];

      if (schema.type === FieldTypes.Column) {
        throw new Error(`Unexpected field type: ${schema.type} for field ${field}`);
      }

      const suffix = field.substring(dotIndex + 1);
      const association = collection.dataSource.getCollection(schema.foreignCollection);
      FieldUtils.validate(association, suffix, values);
    }
  }
}
