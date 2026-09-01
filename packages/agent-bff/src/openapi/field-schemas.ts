import type { FieldType } from '../read-model/capabilities-cache';
import type { SchemaObject } from 'openapi3-ts/oas31';

import { jsonShapeOf } from '../read-model/capabilities-cache';

const FORMATS: Record<string, string> = {
  Date: 'date-time',
  Dateonly: 'date',
  Uuid: 'uuid',
};

const DESCRIPTIONS: Record<string, string> = { File: 'A data URI.' };

/**
 * Turns a Forest column type into a JSON Schema, off the shared primitive table in
 * `read-model/capabilities-cache`. Anything unrecognized — a relation marker such as `ManyToOne`,
 * or a type a newer agent introduced — maps to an unconstrained schema rather than a guess, so the
 * document never rejects a value the runtime accepts.
 */
export default function toFieldSchema(type: FieldType): SchemaObject {
  const shape = jsonShapeOf(type);

  if (shape === 'array') {
    const [item] = type as FieldType[];

    return { type: 'array', items: item === undefined ? {} : toFieldSchema(item) };
  }

  // The `fields` payload is cast from untyped JSON, so its elements are checked rather than
  // trusted. A malformed entry is dropped instead of aborting the whole document — one bad field is
  // not worth losing the spec over.
  if (shape === 'object') {
    const named = (type as { fields: { field: string; type: FieldType }[] }).fields.filter(
      field => typeof field === 'object' && field !== null && typeof field.field === 'string',
    );

    return {
      type: 'object',
      properties: Object.fromEntries(named.map(field => [field.field, toFieldSchema(field.type)])),
    };
  }

  if (shape === 'any') return {};

  const name = type as string;

  return {
    type: shape,
    ...(FORMATS[name] !== undefined && { format: FORMATS[name] }),
    ...(DESCRIPTIONS[name] !== undefined && { description: DESCRIPTIONS[name] }),
  };
}
