import type { WorkflowPort } from '../src/ports/workflow-port';
import type { CollectionSchema } from '../src/types/validated/collection';

import SchemaCache from '../src/schema-cache';
import SchemaResolver from '../src/schema-resolver';

function makeSchema(collectionName: string): CollectionSchema {
  return {
    collectionName,
    collectionId: `col-${collectionName}`,
    collectionDisplayName: collectionName,
    primaryKeyFields: ['id'],
    fields: [],
    actions: [],
  };
}

function makeWorkflowPort(schema: CollectionSchema) {
  return {
    getCollectionSchema: jest.fn().mockResolvedValue(schema),
  } as unknown as WorkflowPort & { getCollectionSchema: jest.Mock };
}

describe('SchemaResolver', () => {
  it('returns the cached schema without calling the orchestrator on a hit', async () => {
    const cache = new SchemaCache();
    const schema = makeSchema('customers');
    cache.set('customers', schema);
    const workflowPort = makeWorkflowPort(makeSchema('other'));
    const resolver = new SchemaResolver(cache, workflowPort, 'run-1');

    const result = await resolver.resolve('customers');

    expect(result).toBe(schema);
    expect(workflowPort.getCollectionSchema).not.toHaveBeenCalled();
  });

  it('fetches with the bound runId, caches, and skips the fetch on a subsequent hit', async () => {
    const cache = new SchemaCache();
    const schema = makeSchema('orders');
    const workflowPort = makeWorkflowPort(schema);
    const resolver = new SchemaResolver(cache, workflowPort, 'run-42');

    const result = await resolver.resolve('orders');

    expect(result).toBe(schema);
    expect(workflowPort.getCollectionSchema).toHaveBeenCalledTimes(1);
    expect(workflowPort.getCollectionSchema).toHaveBeenCalledWith('orders', 'run-42');

    // second call hits the cache — orchestrator not queried again
    await resolver.resolve('orders');
    expect(workflowPort.getCollectionSchema).toHaveBeenCalledTimes(1);
  });

  it('writes the fetched schema into the shared cache (read back by other consumers)', async () => {
    const cache = new SchemaCache();
    const schema = makeSchema('products');
    const resolver = new SchemaResolver(cache, makeWorkflowPort(schema), 'run-1');

    await resolver.resolve('products');

    // The same shared SchemaCache instance is what AgentClientAgentPort reads via .get().
    expect(cache.get('products')).toBe(schema);
  });
});
