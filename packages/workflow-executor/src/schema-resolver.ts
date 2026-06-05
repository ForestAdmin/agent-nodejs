import type { WorkflowPort } from './ports/workflow-port';
import type SchemaCache from './schema-cache';
import type { CollectionSchema } from './types/validated/collection';

// Per-run schema resolution: binds the shared SchemaCache, the orchestrator port and the
// current runId once, so callers never thread a loader. Writes into the SAME SchemaCache
// instance AgentClientAgentPort reads from (get/iterate) — that shared instance is the
// invariant that keeps the agent-port's SchemaNotCachedError guard unreachable in normal flow.
export default class SchemaResolver {
  private readonly cache: SchemaCache;
  private readonly workflowPort: WorkflowPort;
  private readonly runId: string;

  constructor(cache: SchemaCache, workflowPort: WorkflowPort, runId: string) {
    this.cache = cache;
    this.workflowPort = workflowPort;
    this.runId = runId;
  }

  async resolve(collectionName: string): Promise<CollectionSchema> {
    const cached = this.cache.get(collectionName);
    if (cached) return cached;

    const schema = await this.workflowPort.getCollectionSchema(collectionName, this.runId);
    this.cache.set(collectionName, schema);

    return schema;
  }
}
