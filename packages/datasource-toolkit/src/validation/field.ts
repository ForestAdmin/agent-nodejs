import { Collection } from '../interfaces/collection';
import { ColumnSchema, PrimitiveTypes } from '../interfaces/schema';
import { ValidationError } from '../errors';
import { ValidationPrimaryTypes, ValidationTypes, ValidationTypesArray } from './types';
import TypeGetter from './type-getter';

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
        values.forEach(value =>
          FieldValidator.validateValue(field, schema, value, [
            schema.columnType as PrimitiveTypes,
            ValidationPrimaryTypes.Null,
          ]),
        );
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

  static validateValue(
    field: string,
    schema: ColumnSchema,
    value: unknown,
    allowedTypes: readonly (PrimitiveTypes | ValidationTypes)[] = [
      schema.columnType as PrimitiveTypes,
    ],
  ): void {
    // FIXME: handle complex type from ColumnType
    if (typeof schema.columnType !== 'string') {
      return;
    }

    const type = TypeGetter.get(value, schema.columnType as PrimitiveTypes);

    if (schema.columnType === 'Enum') {
      FieldValidator.checkEnumValue(type, schema, value);
    }

    if (allowedTypes && !allowedTypes.includes(type)) {
      throw new ValidationError(`Wrong type for "${field}": ${value}. Expects ${allowedTypes}`);
    }
  }

  private static checkEnumValue(
    type: PrimitiveTypes | ValidationTypes,
    columnSchema: ColumnSchema,
    enumValue: unknown,
  ) {
    let isEnumAllowed: boolean;

    if (type === ValidationTypesArray.Enum) {
      const enumValuesConditionTree = enumValue as Array<string>;
      isEnumAllowed = enumValuesConditionTree.every(value =>
        columnSchema.enumValues.includes(value),
      );
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
