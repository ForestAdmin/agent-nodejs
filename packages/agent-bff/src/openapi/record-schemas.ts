import type { ProjectableField, UnfoldedCollection } from './unfolding';
import type { ReferenceObject, SchemaObject } from 'openapi3-ts/oas31';

import Inflector from 'inflected';

import toFieldSchema from './field-schemas';
import { quoted } from './names';
import { PACKED_ID_SEPARATOR } from '../data/pack-id';

/**
 * The key a field really carries in a response record. `agent-client` deserializes the agent's
 * JSON:API with `keyForAttribute: 'camelCase'` (`http-requester.ts`), which is exactly this pair of
 * `inflected` calls (`jsonapi-serializer/lib/inflector.js`), so a `first_name` column is PROJECTED
 * under that name and RETURNED as `firstName`. The same library rather than a transcription: the
 * transform handles acronyms and non-ASCII, and a mirror would drift from the deserializer without
 * anything failing.
 */
export function recordKey(field: string): string {
  return Inflector.camelize(Inflector.underscore(field), false);
}

// The flat id is the JSON:API resource id, which is a string by specification whatever the key
// column holds. `__forest.primaryKey` is the same id unpacked and typed, so the two forms of one
// record disagree by construction — the trap this schema exists to name.
const ID_SCHEMA: SchemaObject = {
  type: 'string',
  description:
    'The record id, always a string — the agent serializes it as the JSON:API resource id, even ' +
    'when the key column is a Number. `__forest.primaryKey` carries the same id TYPED, so ' +
    `comparing the two without coercion fails. A composite key is its values joined by ` +
    `${quoted(PACKED_ID_SEPARATOR)}.`,
};

function isReference(schema: SchemaObject | ReferenceObject): schema is ReferenceObject {
  return '$ref' in schema;
}

function collapsedSchema(names: string[], tail: string): SchemaObject {
  return {
    description:
      `${names.join(', ')} all reach the response under this single key, so which one it holds ` +
      `is not determined here.${tail}`,
  };
}

/**
 * One published field, at every depth: renamed to the key the response carries it under, and
 * widened to accept null. The capabilities report a column type and never its nullability, so a
 * nullable column answers `null` against a type this schema would otherwise declare non-null — a
 * generated client validating the response would reject what the runtime really sends. An
 * unconstrained schema already accepts null and keeps its type as it is. Renaming and widening are
 * one traversal because they visit the same structure. The rename is as lossy one level down as it
 * is at the top: two members collapsing onto one key would silently drop one, so that key is
 * published unconstrained and names them all instead.
 */
function publishedSchema(schema: SchemaObject): SchemaObject {
  const published: SchemaObject =
    typeof schema.type === 'string' ? { ...schema, type: [schema.type, 'null'] } : { ...schema };

  if (schema.items !== undefined && !isReference(schema.items)) {
    published.items = publishedSchema(schema.items);
  }

  const { properties } = schema;

  if (properties !== undefined) {
    const byKey = new Map<string, string[]>();

    Object.keys(properties).forEach(name => {
      const key = recordKey(name);
      const collapsed = byKey.get(key);

      if (collapsed) collapsed.push(name);
      else byKey.set(key, [name]);
    });

    published.properties = Object.fromEntries(
      [...byKey].map(([key, names]) => {
        if (names.length > 1) return [key, collapsedSchema(names.map(quoted), '')];

        const nested = properties[names[0]];

        return [key, isReference(nested) ? nested : publishedSchema(nested)];
      }),
    );
  }

  return published;
}

/**
 * The schema of one field, under the key the response carries it as. Several fields can collapse to
 * the same key — the transform is lossy, `first_name` and `firstName` both yield `firstName` — and
 * which one wins depends on the order the agent serialized them in, so the type is left open rather
 * than picked.
 */
function propertySchema(key: string, fields: ProjectableField[]): SchemaObject {
  const names = fields.map(field => quoted(field.name));

  if (fields.length > 1) {
    return collapsedSchema(names, ' Project one of them at a time to know.');
  }

  const [field] = fields;
  const schema = publishedSchema(toFieldSchema(field.type));

  if (field.name === key) return schema;

  const description = [schema.description, `The ${names.join(', ')} field.`]
    .filter(Boolean)
    .join(' ');

  return { ...schema, description };
}

function fieldProperties(projectable: ProjectableField[]): Record<string, SchemaObject> {
  const byKey = new Map<string, ProjectableField[]>();

  projectable.forEach(field => {
    const key = recordKey(field.name);
    const collapsed = byKey.get(key);

    if (collapsed) collapsed.push(field);
    else byKey.set(key, [field]);
  });

  return Object.fromEntries([...byKey].map(([key, fields]) => [key, propertySchema(key, fields)]));
}

/**
 * The record shape of one collection. The properties are what the capabilities report, and nothing
 * more is forbidden: the capabilities route leaves out a OneToOne relation that the default
 * projection returns, so a closed schema would reject responses the runtime really sends. `id` wins
 * over any field of that name, because the deserializer overwrites the attribute with the resource
 * id.
 */
export default function recordSchema(
  collection: UnfoldedCollection,
  forestMeta: ReferenceObject,
): SchemaObject {
  return {
    type: 'object',
    description:
      `A record of ${quoted(collection.name)}. It carries the fields the request projected — ` +
      'omit `projection` and the agent returns them all. The properties below are the ones the ' +
      "collection's capabilities report; a record can carry more, such as a to-one relation. " +
      'Every field is nullable: the capabilities report a column type and never its nullability, ' +
      'so a null is always possible whatever the type says.',
    properties: {
      ...fieldProperties(collection.fields.projectable),
      id: ID_SCHEMA,
      __forest: forestMeta,
    },
    required: ['id', '__forest'],
  };
}

export function listResponseSchema(
  collection: UnfoldedCollection,
  record: ReferenceObject,
): SchemaObject {
  return {
    type: 'object',
    description:
      `A page of ${quoted(collection.name)} records. The list never carries a total: call the ` +
      'count endpoint for that, which is why `countStatus` is always `not_requested`.',
    properties: {
      data: { type: 'array', items: record },
      meta: {
        type: 'object',
        properties: { countStatus: { type: 'string', const: 'not_requested' } },
        required: ['countStatus'],
      },
    },
    required: ['data', 'meta'],
  };
}
