import type { FieldType } from '../read-model/capabilities-cache';
import type { SchemaObject } from 'openapi3-ts/oas31';

// Forest primitives, mapped to the closest JSON Schema shape. `Json` maps to no constraint at all,
// which is honest: any JSON value is accepted there.
const PRIMITIVE_SCHEMAS: Record<string, SchemaObject> = {
  Binary: { type: 'string' },
  Boolean: { type: 'boolean' },
  Date: { type: 'string', format: 'date-time' },
  Dateonly: { type: 'string', format: 'date' },
  Enum: { type: 'string' },
  File: { type: 'string', description: 'A data URI.' },
  Json: {},
  Number: { type: 'number' },
  Point: { type: 'string' },
  String: { type: 'string' },
  Time: { type: 'string' },
  Timeonly: { type: 'string' },
  Uuid: { type: 'string', format: 'uuid' },
};

/**
 * Turns a Forest column type into a JSON Schema. Anything unrecognized — a relation marker such as
 * `ManyToOne`, or a type a newer agent introduced — maps to an unconstrained schema rather than a
 * guess, so the document never rejects a value the runtime accepts.
 */
export default function toFieldSchema(type: FieldType): SchemaObject {
  if (Array.isArray(type)) {
    const [item] = type;

    return { type: 'array', items: item === undefined ? {} : toFieldSchema(item) };
  }

  // Null-checked because the capabilities payload is cast from untyped JSON, so nothing guarantees a
  // column type is one of the three shapes the type declares.
  if (typeof type === 'object' && type !== null && Array.isArray(type.fields)) {
    return {
      type: 'object',
      properties: Object.fromEntries(
        type.fields.map(field => [field.field, toFieldSchema(field.type)]),
      ),
    };
  }

  return typeof type === 'string' ? PRIMITIVE_SCHEMAS[type] ?? {} : {};
}
