import type { WorkflowPort } from '../ports/workflow-port';
import type SchemaCache from '../schema-cache';
import type { CollectionSchema } from '../types/validated/collection';

export default async function loadCollectionSchema(
  schemaCache: SchemaCache,
  workflowPort: WorkflowPort,
  runId: string,
  collectionName: string,
): Promise<CollectionSchema> {
  const cached = schemaCache.get(collectionName);
  if (cached) return cached;

  const schema = await workflowPort.getCollectionSchema(collectionName, runId);
  schemaCache.set(collectionName, schema);

  return schema;
}
