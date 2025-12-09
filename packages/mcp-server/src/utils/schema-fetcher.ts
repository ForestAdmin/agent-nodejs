import JsonApiSerializer from 'jsonapi-serializer';

/**
 * Schema Fetcher Utility
 *
 * Fetches the Forest Admin schema from the `/liana/forest-schema` endpoint
 * and caches it for 24 hours.
 */

export interface ForestField {
  field: string;
  type: string;
  isFilterable?: boolean;
  isSortable?: boolean;
  enum: string[] | null;
  inverseOf?: string | null;
  reference: string | null;
  isReadOnly: boolean;
  isRequired: boolean;
  integration?: string | null;
  validations?: unknown[];
  defaultValue?: unknown;
  isPrimaryKey: boolean;
  relationship?: 'HasMany' | 'BelongsTo' | 'HasOne' | null;
}

export interface ForestCollection {
  name: string;
  fields: ForestField[];
}

export interface ForestSchema {
  collections: ForestCollection[];
}

interface JSONAPIItem {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
  relationships: Record<string, { data: { id: string; type: string } }>;
}

interface SchemaCache {
  schema: ForestSchema;
  fetchedAt: number;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

let schemaCache: SchemaCache | null = null;

/**
 * Fetches the Forest Admin schema from the server.
 * The schema is cached for 24 hours to reduce API calls.
 *
 * @param forestServerUrl - The Forest Admin server URL
 * @returns The Forest Admin schema containing collections
 */
export async function fetchForestSchema(forestServerUrl: string): Promise<ForestSchema> {
  const now = Date.now();

  // Return cached schema if it's still valid (less than 24 hours old)
  if (schemaCache && now - schemaCache.fetchedAt < ONE_DAY_MS) {
    return schemaCache.schema;
  }

  const envSecret = process.env.FOREST_ENV_SECRET;

  if (!envSecret) {
    throw new Error('FOREST_ENV_SECRET environment variable is not set');
  }

  const response = await fetch(`${forestServerUrl}/liana/forest-schema`, {
    method: 'GET',
    headers: {
      'forest-secret-key': envSecret,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch forest schema: ${errorText}`);
  }

  const schema = (await response.json()) as {
    data: JSONAPIItem[];
    included?: JSONAPIItem[];
    meta: { liana: string; liana_version: string; liana_features: string[] | null };
  };
  const serializer = new JsonApiSerializer.Deserializer({
    keyForAttribute: 'camelCase',
  });
  const collections = (await serializer.deserialize(schema)) as ForestCollection[];

  // Update cache
  schemaCache = {
    schema: { collections },
    fetchedAt: now,
  };

  return { collections };
}

/**
 * Extracts collection names from the Forest Admin schema.
 *
 * @param schema - The Forest Admin schema
 * @returns Array of collection names
 */
export function getCollectionNames(schema: ForestSchema): string[] {
  return schema.collections.map(collection => collection.name);
}

export function getFieldsOfCollection(schema: ForestSchema, collectionName: string): ForestField[] {
  const collection = schema.collections.find(col => col.name === collectionName);

  if (!collection) {
    throw new Error(`Collection "${collectionName}" not found in schema`);
  }

  return collection.fields;
}

/**
 * Clears the schema cache. Useful for testing.
 */
export function clearSchemaCache(): void {
  schemaCache = null;
}

/**
 * Sets the schema cache. Useful for testing.
 */
export function setSchemaCache(schema: ForestSchema, fetchedAt?: number): void {
  schemaCache = {
    schema,
    fetchedAt: fetchedAt ?? Date.now(),
  };
}
