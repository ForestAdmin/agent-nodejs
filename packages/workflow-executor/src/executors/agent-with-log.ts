import type { ActivityLogPort, CreateActivityLogArgs } from '../ports/activity-log-port';
import type {
  AgentPort,
  ExecuteActionQuery,
  GetActionFormInfoQuery,
  GetRecordQuery,
  GetRelatedDataQuery,
  GetSingleRelatedDataQuery,
  UpdateRecordQuery,
} from '../ports/agent-port';
import type SchemaResolver from '../schema-resolver';
import type { StepUser } from '../types/execution-context';
import type { RecordData } from '../types/validated/collection';

// The audit-log target minus renderingId, which audit() stamps centrally.
export type AuditTarget = Omit<CreateActivityLogArgs, 'renderingId'>;

type WriteOptions = { beforeCall: () => Promise<void> };

export interface AgentWithLogDeps {
  agentPort: AgentPort;
  activityLogPort: ActivityLogPort;
  schemaResolver: SchemaResolver;
  user: StepUser;
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
  private readonly schemaResolver: SchemaResolver;
  private readonly user: StepUser;

  constructor(deps: AgentWithLogDeps) {
    this.agentPort = deps.agentPort;
    this.activityLogPort = deps.activityLogPort;
    this.schemaResolver = deps.schemaResolver;
    this.user = deps.user;
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
      opts,
    );
  }

  async executeAction(query: ExecuteActionQuery, opts: WriteOptions): Promise<unknown> {
    const collectionId = await this.resolveCollectionId(query.collection);

    return this.audit(
      { action: 'action', type: 'write', collectionId, recordId: query.id },
      () => this.agentPort.executeAction(query, this.user),
      opts,
    );
  }

  // Unaudited passthrough: form-info is a read-only probe (does this action have a form?),
  // not a data access, so unlike the methods above it emits NO activity-log entry.
  getActionFormInfo(query: GetActionFormInfoQuery): Promise<{ hasForm: boolean }> {
    return this.agentPort.getActionFormInfo(query, this.user);
  }

  // For operations that are not AgentPort calls (e.g. MCP tool invocation): the caller
  // supplies the full audit target since there is no collection name to resolve.
  logged<T>(target: AuditTarget, run: () => Promise<T>, opts: WriteOptions): Promise<T> {
    return this.audit(target, run, opts);
  }

  private async audit<T>(
    args: AuditTarget,
    run: () => Promise<T>,
    opts?: WriteOptions,
  ): Promise<T> {
    const handle = await this.activityLogPort.createPending({
      renderingId: this.user.renderingId,
      ...args,
    });

    try {
      if (opts) await opts.beforeCall();
      const result = await run();
      void this.activityLogPort.markSucceeded(handle);

      return result;
    } catch (err) {
      // The step error is logged/surfaced by base-step-executor when rethrown, so the audit
      // transition only needs the handle.
      void this.activityLogPort.markFailed(handle);
      throw err;
    }
  }

  private async resolveCollectionId(collectionName: string): Promise<string> {
    const schema = await this.schemaResolver.resolve(collectionName);

    return schema.collectionId;
  }
}
