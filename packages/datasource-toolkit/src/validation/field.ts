import { Collection } from '../interfaces/collection';
import { ColumnSchema, FieldTypes, PrimitiveTypes } from '../interfaces/schema';
import TypeGetter from './type-getter';
import ValidationTypes from './types';

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
        values.forEach(value => FieldValidator.validateValue(field, schema, value));
      }
    } else {
      const prefix = field.substring(0, dotIndex);
      const schema = collection.schema.fields[prefix];

      if (!schema) {
        throw new Error(`Relation not found: '${collection.name}.${prefix}'`);
      }

      if (schema.type !== FieldTypes.ManyToOne && schema.type !== FieldTypes.OneToOne) {
        throw new Error(
          `Unexpected field type: '${collection.name}.${prefix}' (found ` +
            `'${schema.type}' expected '${FieldTypes.ManyToOne}' or '${FieldTypes.OneToOne}')`,
        );
      }

      const suffix = field.substring(dotIndex + 1);
      const association = collection.dataSource.getCollection(schema.foreignCollection);
      FieldValidator.validate(association, suffix, values);
    }
  }

  static validateValue(field: string, schema: ColumnSchema, value: unknown): void {
    const type = TypeGetter.get(value, schema.columnType as PrimitiveTypes);

    if ([ValidationTypes.ArrayOfEnum, PrimitiveTypes.Enum].includes(type)) {
      FieldValidator.checkEnumValue(type, schema, value);
    }

    if (type !== schema.columnType) {
      throw new Error(`Wrong type for "${field}": ${value}. Expects ${schema.columnType}`);
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
      throw new Error(
        `The given enum value(s) [${enumValue}] is not listed in [${columnSchema.enumValues}]`,
      );
    }
  }
}
