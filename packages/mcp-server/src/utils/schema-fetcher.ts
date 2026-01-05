import type {
  ForestSchemaAction,
  ForestSchemaCollection,
  ForestSchemaField,
  McpHttpClient,
} from '../http-client';

/**
 * Schema Fetcher Utility
 *
 * Fetches the Forest Admin schema from the `/liana/forest-schema` endpoint
 * and caches it for 24 hours.
 */

// Re-export types for backwards compatibility
export type ForestField = ForestSchemaField;
export type ForestAction = ForestSchemaAction;
export type ForestCollection = ForestSchemaCollection;

export interface ForestSchema {
  collections: ForestCollection[];
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
 * @param httpClient - The HTTP client to use for fetching the schema
 * @returns The Forest Admin schema containing collections
 */
export async function fetchForestSchema(httpClient: McpHttpClient): Promise<ForestSchema> {
  const now = Date.now();

  // Return cached schema if it's still valid (less than 24 hours old)
  if (schemaCache && now - schemaCache.fetchedAt < ONE_DAY_MS) {
    return schemaCache.schema;
  }

  const collections = await httpClient.fetchSchema();

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

/**
 * Extracts actions from a collection in the Forest Admin schema.
 */
export function getActionsOfCollection(
  schema: ForestSchema,
  collectionName: string,
): ForestAction[] {
  const collection = schema.collections.find(col => col.name === collectionName);

  if (!collection) {
    throw new Error(`Collection "${collectionName}" not found in schema`);
  }

  return collection.actions || [];
}
