import type { FieldType } from '../read-model/field-type';
import type { SchemaObject } from 'openapi3-ts/oas31';

import { primitiveShapeOf } from '../read-model/field-type';

const FORMATS = new Map([
  ['Date', 'date-time'],
  ['Dateonly', 'date'],
  ['Uuid', 'uuid'],
]);

const DESCRIPTIONS = new Map([['File', 'A data URI.']]);

/**
 * Turns a Forest column type into a JSON Schema, off the shared primitive table in
 * `read-model/field-type`. Anything unrecognized — a relation marker such as `ManyToOne`, or a type
 * a newer agent introduced — maps to an unconstrained schema rather than a guess, so the document
 * never rejects a value the runtime accepts.
 */
export default function toFieldSchema(type: FieldType): SchemaObject {
  if (Array.isArray(type)) {
    const [item] = type;

    return { type: 'array', items: item === undefined ? {} : toFieldSchema(item) };
  }

  // Null-checked, and its elements checked rather than trusted: the payload a column type comes from
  // is cast from untyped JSON, so nothing guarantees the declared shape. A malformed entry is dropped
  // instead of aborting the whole document — one bad field is not worth losing the spec over.
  if (typeof type === 'object' && type !== null && Array.isArray(type.fields)) {
    const named = type.fields.filter(
      field => typeof field === 'object' && field !== null && typeof field.field === 'string',
    );

    return {
      type: 'object',
      properties: Object.fromEntries(named.map(field => [field.field, toFieldSchema(field.type)])),
    };
  }

  if (typeof type !== 'string') return {};

  const shape = primitiveShapeOf(type);

  if (shape === 'any') return {};

  const format = FORMATS.get(type);
  const description = DESCRIPTIONS.get(type);

  return {
    type: shape,
    ...(format !== undefined && { format }),
    ...(description !== undefined && { description }),
  };
}
