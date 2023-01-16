import { MAP_ALLOWED_TYPES_FOR_COLUMN_TYPE } from './rules';
import TypeGetter from './type-getter';
import { ValidationError } from '../errors';
import { Collection } from '../interfaces/collection';
import { ColumnSchema, PrimitiveTypes } from '../interfaces/schema';

export default class FieldValidator {
  static validate(collection: Collection, field: string, values?: unknown[]) {
    const dotIndex = field.indexOf(':');

    if (dotIndex === -1) {
      const schema = collection.schema.fields[field];

      if (!schema) {
        throw new ValidationError(`Column not found: '${collection.name}.${field}'`);
      }

      if (schema.type !== 'Column') {
        throw new ValidationError(
          `Unexpected field type: '${collection.name}.${field}' ` +
            `(found '${schema.type}' expected '${'Column'}')`,
        );
      }

      if (values !== undefined) {
        values.forEach(value => FieldValidator.validateValue(field, schema, value));
      }
    } else {
      const prefix = field.substring(0, dotIndex);
      const schema = collection.schema.fields[prefix];

      if (!schema) {
        throw new ValidationError(`Relation not found: '${collection.name}.${prefix}'`);
      }

      if (schema.type !== 'ManyToOne' && schema.type !== 'OneToOne') {
        throw new ValidationError(
          `Unexpected field type: '${collection.name}.${prefix}' (found ` +
            `'${schema.type}' expected '${'ManyToOne'}' or '${'OneToOne'}')`,
        );
      }

      const suffix = field.substring(dotIndex + 1);
      const association = collection.dataSource.getCollection(schema.foreignCollection);
      FieldValidator.validate(association, suffix, values);
    }
  }

  static validateValueForId(field: string, schema: ColumnSchema, value: unknown): void {
    FieldValidator.validateValue(field, schema, value, [schema.columnType as PrimitiveTypes]);
  }

  static validateValue(
    field: string,
    schema: ColumnSchema,
    value: unknown,
    allowedTypes: readonly PrimitiveTypes[] = MAP_ALLOWED_TYPES_FOR_COLUMN_TYPE[
      schema.columnType as PrimitiveTypes
    ],
  ): void {
    // FIXME: handle complex type from ColumnType
    if (typeof schema.columnType !== 'string') {
      return;
    }

    const type = TypeGetter.get(value, schema.columnType as PrimitiveTypes);

    if (!allowedTypes?.includes(type)) {
      throw new ValidationError(
        `The given value has a wrong type for "${field}": ${value}.\n Expects ${JSON.stringify(
          allowedTypes,
        ).slice(1, -1)}`,
      );
    }

    if (value && schema.columnType === 'Enum') {
      FieldValidator.checkEnumValue(schema, value);
    }
  }

  private static checkEnumValue(columnSchema: ColumnSchema, enumValue: unknown) {
    const isEnumAllowed = columnSchema.enumValues.includes(enumValue as string);

    if (!isEnumAllowed) {
      throw new ValidationError(
        `The given enum value(s) ${enumValue} is not listed in [${columnSchema.enumValues}]`,
      );
    }
  }
}
