import type { WorkflowPort } from './ports/workflow-port';
import type SchemaCache from './schema-cache';
import type { CollectionSchema } from './types/validated/collection';

// Per-run schema resolution: binds the shared SchemaCache, the orchestrator port, the current
// runId and its renderingId once, so callers never thread a loader. Cache reads/writes are scoped
// to the rendering so a run never reuses another rendering's schema (PRD-440). Writes into the
// SAME SchemaCache instance AgentClientAgentPort reads from (scoped by the same renderingId): the
// resolver always populates an entry before the agent-port reads it, so the agent-port's
// SchemaNotCachedError guard does not fire under normal TTLs (a TTL shorter than a single step's
// round-trip could still evict).
export default class SchemaResolver {
  private readonly cache: SchemaCache;
  private readonly workflowPort: WorkflowPort;
  private readonly runId: string;
  private readonly renderingId: number;

  constructor(cache: SchemaCache, workflowPort: WorkflowPort, runId: string, renderingId: number) {
    this.cache = cache;
    this.workflowPort = workflowPort;
    this.runId = runId;
    this.renderingId = renderingId;
  }

  async resolve(collectionName: string): Promise<CollectionSchema> {
    const cached = this.cache.get(this.renderingId, collectionName);
    if (cached) return cached;

    const schema = await this.workflowPort.getCollectionSchema(collectionName, this.runId);
    this.cache.set(this.renderingId, collectionName, schema);

    return schema;
  }
}
