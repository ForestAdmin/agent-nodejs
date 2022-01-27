import { Collection } from '../interfaces/collection';
import { FieldTypes } from '../interfaces/schema';

export default class FieldValidator {
  static validate(collection: Collection, field: string, values?: unknown[]) {
    const dotIndex = field.indexOf(':');

    if (dotIndex === -1) {
      const schema = collection.schema.fields[field];

      if (!schema) {
        throw new Error(`Column not found: '${collection.name}.${field}'`);
      }

      if (schema.type !== FieldTypes.Column) {
        throw new Error(
          `Unexpected field type: '${collection.name}.${field}' ` +
            `(found '${schema.type}' expected '${FieldTypes.Column}')`,
        );
      }

      if (values !== undefined) {
        // Validate value based on column type
        throw new Error('Implement me.');
      }
    } else {
      const prefix = field.substring(0, dotIndex);
      const schema = collection.schema.fields[prefix];

      if (!schema) {
        throw new Error(`Relation not found: '${collection.name}.${field}'`);
      }

      if (schema.type !== FieldTypes.ManyToOne && schema.type !== FieldTypes.OneToOne) {
        throw new Error(
          `Unexpected field type: '${collection.name}.${field}'. (found ` +
            `'${schema.type}' expected '${FieldTypes.ManyToOne}' or '${FieldTypes.OneToOne}')`,
        );
      }

      const suffix = field.substring(dotIndex + 1);
      const association = collection.dataSource.getCollection(schema.foreignCollection);
      FieldValidator.validate(association, suffix, values);
    }
  }
}
