import { Collection } from '../interfaces/collection';
import { ColumnSchema, FieldTypes, PrimitiveTypes } from '../interfaces/schema';
import TypeGetter from './type-getter';
import ValidationError from '../errors';
import ValidationTypes from './types';

export default class FieldValidator {
  static validate(collection: Collection, field: string, values?: unknown[]) {
    const dotIndex = field.indexOf(':');

    if (dotIndex === -1) {
      const schema = collection.schema.fields[field];

      if (!schema) {
        throw new ValidationError(`Column not found: '${collection.name}.${field}'`);
      }

      if (schema.type !== FieldTypes.Column) {
        throw new ValidationError(
          `Unexpected field type: '${collection.name}.${field}' ` +
            `(found '${schema.type}' expected '${FieldTypes.Column}')`,
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

      if (schema.type !== FieldTypes.ManyToOne && schema.type !== FieldTypes.OneToOne) {
        throw new ValidationError(
          `Unexpected field type: '${collection.name}.${prefix}' (found ` +
            `'${schema.type}' expected '${FieldTypes.ManyToOne}' or '${FieldTypes.OneToOne}')`,
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
    allowedTypes?: readonly (PrimitiveTypes | ValidationTypes)[],
  ): void {
    // FIXME: handle complex type from ColumnType
    if (typeof schema.columnType !== 'string') {
      return;
    }

    const type = TypeGetter.get(value, schema.columnType as PrimitiveTypes, true);

    if (schema.columnType === PrimitiveTypes.Enum) {
      FieldValidator.checkEnumValue(type, schema, value);
    }

    if (allowedTypes) {
      if (!allowedTypes.includes(type)) {
        throw new ValidationError(`Wrong type for "${field}": ${value}. Expects [${allowedTypes}]`);
      }
    } else if (type !== schema.columnType || FieldValidator.isStringNumber(value, type, schema)) {
      throw new ValidationError(
        `Wrong type for "${field}": ${value}. Expects ${schema.columnType}`,
      );
    }
  }

  public static checkEnumValue(
    type: PrimitiveTypes | ValidationTypes,
    columnSchema: ColumnSchema,
    enumValue: unknown,
  ) {
    let isEnumAllowed: boolean;

    if (type === ValidationTypes.ArrayOfEnum) {
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

  private static isStringNumber(value: unknown, type: PrimitiveTypes, schema: ColumnSchema) {
    return (
      type === schema.columnType && typeof value === 'string' && type === PrimitiveTypes.Number
    );
  }
}
