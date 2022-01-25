import { DateTime } from 'luxon';
import { Collection } from '../interfaces/collection';
import { ColumnSchema, FieldTypes, PrimitiveTypes } from '../interfaces/schema';

export default class FieldUtils {
  static validate(collection: Collection, field: string, values?: unknown[]) {
    const dotIndex = field.indexOf(':');

    if (dotIndex === -1) {
      const schema = collection.schema.fields[field];

      if (schema.type !== FieldTypes.Column) {
        throw new Error(`Unexpected field type: ${schema.type} for field ${field}`);
      }

      if (values !== undefined) {
        // Validate value based on column type
        values.forEach(value => FieldUtils.validateValue(field, schema, value));
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

  static validateValue(field: string, schema: ColumnSchema, value: unknown): void {
    if (value !== null) {
      let message = `Wrong type for "${field}": ${value}. Expects ${schema.columnType}`;

      let success = true;

      switch (schema.columnType) {
        case PrimitiveTypes.Boolean:
          success = typeof value === 'boolean';
          break;
        case PrimitiveTypes.Number:
          success = typeof value === 'number';
          break;
        case PrimitiveTypes.String:
          success = typeof value === 'string';
          break;
        case PrimitiveTypes.Enum:
          success = typeof value === 'string' && schema.enumValues.includes(value);
          message += ` to be in ${schema.enumValues}`;
          break;
        case PrimitiveTypes.Json:
          try {
            if (typeof value === 'string') {
              JSON.parse(value as string);
            } else if (typeof value === 'object') {
              success = true;
            }
          } catch {
            success = false;
          }

          break;
        case PrimitiveTypes.Uuid:
          success =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
              `${value}`,
            );
          break;
        case PrimitiveTypes.Date:
        case PrimitiveTypes.Dateonly:
        case PrimitiveTypes.Timeonly:
          if (typeof value === 'string') {
            success = DateTime.fromISO(value).isValid;
          } else if (value instanceof Date) {
            success = DateTime.fromJSDate(value).isValid;
          }

          break;
        case PrimitiveTypes.Point:
          if (typeof value === 'string') {
            const [x, y] = value.split(',');
            success = !Number.isNaN(Number(x)) && !Number.isNaN(Number(y));
          }

          break;
        default:
          throw new Error(`Unexpected schema type: ${schema.columnType}`);
      }

      if (!success) {
        throw new Error(message);
      }
    }
  }
}
