import {
  MAP_ALLOWED_TYPES_FOR_COLUMN_TYPE,
  MAP_ALLOWED_TYPES_FOR_COLUMN_TYPE_CONDITION_TREE,
} from './rules';
import TypeGetter from './type-getter';
import { ValidationTypes, ValidationTypesArray } from './types';
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
        values.forEach(value => FieldValidator.validateValueForField(field, schema, value));
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

  static validateValueForField(field: string, schema: ColumnSchema, value: unknown): void {
    FieldValidator.validateValue(
      field,
      schema,
      value,
      MAP_ALLOWED_TYPES_FOR_COLUMN_TYPE[schema.columnType as PrimitiveTypes],
    );
  }

  static validateValueForConditionTree(field: string, schema: ColumnSchema, value: unknown): void {
    FieldValidator.validateValue(
      field,
      schema,
      value,
      MAP_ALLOWED_TYPES_FOR_COLUMN_TYPE_CONDITION_TREE[schema.columnType as PrimitiveTypes],
    );
  }

  private static validateValue(
    field: string,
    schema: ColumnSchema,
    value: unknown,
    allowedTypes: readonly (PrimitiveTypes | ValidationTypes)[],
  ): void {
    // FIXME: handle complex type from ColumnType
    if (typeof schema.columnType !== 'string') {
      return;
    }

    const type = TypeGetter.get(value, schema.columnType as PrimitiveTypes);

    if (allowedTypes && !allowedTypes.includes(type)) {
      throw new ValidationError(`Wrong type for "${field}": ${value}. Expects ${allowedTypes}`);
    }

    if (value && schema.columnType === 'Enum') {
      FieldValidator.checkEnumValue(type, schema, value);
    }
  }

  private static checkEnumValue(
    type: PrimitiveTypes | ValidationTypes,
    columnSchema: ColumnSchema,
    enumValue: unknown,
  ) {
    let isEnumAllowed: boolean;

    if (type === ValidationTypesArray.Enum) {
      isEnumAllowed = (enumValue as Array<string>).every(v => columnSchema.enumValues.includes(v));
    } else {
      isEnumAllowed = columnSchema.enumValues.includes(enumValue as string);
    }

    if (!isEnumAllowed) {
      throw new ValidationError(
        `The given enum value(s) [${enumValue}] is not listed in [${columnSchema.enumValues}]`,
      );
    }
  }
}
