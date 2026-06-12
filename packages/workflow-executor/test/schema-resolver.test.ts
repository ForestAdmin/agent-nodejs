import type { WorkflowPort } from '../src/ports/workflow-port';
import type { CollectionSchema } from '../src/types/validated/collection';

import SchemaCache from '../src/schema-cache';
import SchemaResolver from '../src/schema-resolver';

const RENDERING_A = 100;
const RENDERING_B = 200;

function makeSchema(collectionName: string, displayName = collectionName): CollectionSchema {
  return {
    collectionName,
    collectionId: `col-${collectionName}`,
    collectionDisplayName: displayName,
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
    cache.set(RENDERING_A, 'customers', schema);
    const workflowPort = makeWorkflowPort(makeSchema('other'));
    const resolver = new SchemaResolver(cache, workflowPort, 'run-1', RENDERING_A);

    const result = await resolver.resolve('customers');

    expect(result).toBe(schema);
    expect(workflowPort.getCollectionSchema).not.toHaveBeenCalled();
  });

  it('fetches with the bound runId, caches, and skips the fetch on a subsequent hit', async () => {
    const cache = new SchemaCache();
    const schema = makeSchema('orders');
    const workflowPort = makeWorkflowPort(schema);
    const resolver = new SchemaResolver(cache, workflowPort, 'run-42', RENDERING_A);

    const result = await resolver.resolve('orders');

    expect(result).toBe(schema);
    expect(workflowPort.getCollectionSchema).toHaveBeenCalledTimes(1);
    expect(workflowPort.getCollectionSchema).toHaveBeenCalledWith('orders', 'run-42');

    // second call hits the cache — orchestrator not queried again
    await resolver.resolve('orders');
    expect(workflowPort.getCollectionSchema).toHaveBeenCalledTimes(1);
  });

  it('writes the fetched schema into the shared cache scoped to its rendering', async () => {
    const cache = new SchemaCache();
    const schema = makeSchema('products');
    const resolver = new SchemaResolver(cache, makeWorkflowPort(schema), 'run-1', RENDERING_A);

    await resolver.resolve('products');

    // The same shared SchemaCache instance is what AgentClientAgentPort reads via .get().
    expect(cache.get(RENDERING_A, 'products')).toBe(schema);
  });

  it('does not reuse another rendering schema for the same collection (PRD-440)', async () => {
    const cache = new SchemaCache();
    const schemaA = makeSchema('customers', 'Customers');
    cache.set(RENDERING_A, 'customers', schemaA);

    const schemaB = makeSchema('customers', 'Clients');
    const workflowPort = makeWorkflowPort(schemaB);
    const resolverB = new SchemaResolver(cache, workflowPort, 'run-B', RENDERING_B);

    const result = await resolverB.resolve('customers');

    // Rendering B must fetch its own schema instead of reusing rendering A's cached one.
    expect(workflowPort.getCollectionSchema).toHaveBeenCalledWith('customers', 'run-B');
    expect(result).toBe(schemaB);
    expect(result.collectionDisplayName).toBe('Clients');
  });
});
