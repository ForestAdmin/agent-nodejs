import type { ActivityLogPort, CreateActivityLogArgs } from '../ports/activity-log-port';
import type {
  AgentPort,
  ExecuteActionQuery,
  GetRecordQuery,
  GetRelatedDataQuery,
  GetSingleRelatedDataQuery,
  UpdateRecordQuery,
} from '../ports/agent-port';
import type { WorkflowPort } from '../ports/workflow-port';
import type SchemaCache from '../schema-cache';
import type { StepUser } from '../types/execution-context';
import type { RecordData } from '../types/validated/collection';

import { WorkflowExecutorError } from '../errors';

// The audit-log target minus renderingId, which audit() stamps centrally.
export type AuditTarget = Omit<CreateActivityLogArgs, 'renderingId'>;

type WriteOptions = { beforeCall: () => Promise<void> };

export interface AgentWithLogDeps {
  agentPort: AgentPort;
  activityLogPort: ActivityLogPort;
  workflowPort: WorkflowPort;
  schemaCache: SchemaCache;
  user: StepUser;
  runId: string;
}

// Wraps AgentPort and emits an activity-log entry around each data-access call
// (pending → success/failed). The audit target is derived from the call: the numeric
// collectionId is resolved from the call's collection name, the recordId from its id.
// Idempotency stays in the executors: write methods run a `beforeCall` thunk between
// createPending and the side effect (the executor persists its write-ahead marker there),
// so AgentWithLog never reaches into run state.
export default class AgentWithLog {
  private readonly agentPort: AgentPort;
  private readonly activityLogPort: ActivityLogPort;
  private readonly workflowPort: WorkflowPort;
  private readonly schemaCache: SchemaCache;
  private readonly user: StepUser;
  private readonly runId: string;

  constructor(deps: AgentWithLogDeps) {
    this.agentPort = deps.agentPort;
    this.activityLogPort = deps.activityLogPort;
    this.workflowPort = deps.workflowPort;
    this.schemaCache = deps.schemaCache;
    this.user = deps.user;
    this.runId = deps.runId;
  }

  async getRecord(query: GetRecordQuery): Promise<RecordData> {
    const collectionId = await this.resolveCollectionId(query.collection);

    return this.audit({ action: 'index', type: 'read', collectionId, recordId: query.id }, () =>
      this.agentPort.getRecord(query, this.user),
    );
  }

  async getRelatedData(query: GetRelatedDataQuery): Promise<RecordData[]> {
    const collectionId = await this.resolveCollectionId(query.collection);

    return this.audit(
      { action: 'listRelatedData', type: 'read', collectionId, recordId: query.id },
      () => this.agentPort.getRelatedData(query, this.user),
    );
  }

  async getSingleRelatedData(query: GetSingleRelatedDataQuery): Promise<RecordData | null> {
    const collectionId = await this.resolveCollectionId(query.collection);

    return this.audit(
      { action: 'listRelatedData', type: 'read', collectionId, recordId: query.id },
      () => this.agentPort.getSingleRelatedData(query, this.user),
    );
  }

  async updateRecord(query: UpdateRecordQuery, opts: WriteOptions): Promise<RecordData> {
    const collectionId = await this.resolveCollectionId(query.collection);

    return this.audit(
      { action: 'update', type: 'write', collectionId, recordId: query.id },
      () => this.agentPort.updateRecord(query, this.user),
      opts.beforeCall,
    );
  }

  async executeAction(query: ExecuteActionQuery, opts: WriteOptions): Promise<unknown> {
    const collectionId = await this.resolveCollectionId(query.collection);

    return this.audit(
      { action: 'action', type: 'write', collectionId, recordId: query.id },
      () => this.agentPort.executeAction(query, this.user),
      opts.beforeCall,
    );
  }

  // For operations that are not AgentPort calls (e.g. MCP tool invocation): the caller
  // supplies the full audit target since there is no collection name to resolve.
  logged<T>(
    target: AuditTarget,
    run: () => Promise<T>,
    opts?: { beforeCall?: () => Promise<void> },
  ): Promise<T> {
    return this.audit(target, run, opts?.beforeCall);
  }

  private async audit<T>(
    args: AuditTarget,
    run: () => Promise<T>,
    beforeCall?: () => Promise<void>,
  ): Promise<T> {
    const handle = await this.activityLogPort.createPending({
      renderingId: this.user.renderingId,
      ...args,
    });

    try {
      if (beforeCall) await beforeCall();
      const result = await run();
      void this.activityLogPort.markSucceeded(handle);

      return result;
    } catch (err) {
      const errorMessage =
        err instanceof WorkflowExecutorError ? err.userMessage : 'Unexpected error';
      void this.activityLogPort.markFailed(handle, errorMessage);
      throw err;
    }
  }

  private async resolveCollectionId(collectionName: string): Promise<string> {
    const schema = await this.schemaCache.getOrLoad(collectionName, () =>
      this.workflowPort.getCollectionSchema(collectionName, this.runId),
    );

    return schema.collectionId;
  }
}
