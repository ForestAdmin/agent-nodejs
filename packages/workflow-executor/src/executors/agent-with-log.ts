import type ActivityLog from './activity-log';
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

type WriteOptions = { beforeCall: () => Promise<void> };

export interface AgentWithLogDeps {
  agentPort: AgentPort;
  schemaResolver: SchemaResolver;
  user: StepUser;
  activityLog: ActivityLog;
}

// Wraps AgentPort and runs each data-access call through the ActivityLog so it records an
// activity-log entry. The audit target is derived from the call: the numeric collectionId is
// resolved from the call's collection name, the recordId from its id. Idempotency stays in the
// executors: write methods forward a `beforeCall` thunk (the executor's write-ahead marker).
export default class AgentWithLog {
  private readonly agentPort: AgentPort;

  private readonly schemaResolver: SchemaResolver;

  private readonly user: StepUser;

  private readonly activityLog: ActivityLog;

  constructor(deps: AgentWithLogDeps) {
    this.agentPort = deps.agentPort;
    this.schemaResolver = deps.schemaResolver;
    this.user = deps.user;
    this.activityLog = deps.activityLog;
  }

  async getRecord(query: GetRecordQuery): Promise<RecordData> {
    const collectionId = await this.resolveCollectionId(query.collection);

    return this.activityLog.track(
      { action: 'index', type: 'read', collectionId, recordId: query.id },
      { operation: () => this.agentPort.getRecord(query, this.user) },
    );
  }

  async getRelatedData(query: GetRelatedDataQuery): Promise<RecordData[]> {
    const collectionId = await this.resolveCollectionId(query.collection);

    return this.activityLog.track(
      { action: 'listRelatedData', type: 'read', collectionId, recordId: query.id },
      { operation: () => this.agentPort.getRelatedData(query, this.user) },
    );
  }

  async getSingleRelatedData(query: GetSingleRelatedDataQuery): Promise<RecordData | null> {
    const collectionId = await this.resolveCollectionId(query.collection);

    return this.activityLog.track(
      { action: 'listRelatedData', type: 'read', collectionId, recordId: query.id },
      { operation: () => this.agentPort.getSingleRelatedData(query, this.user) },
    );
  }

  async updateRecord(query: UpdateRecordQuery, opts: WriteOptions): Promise<RecordData> {
    const collectionId = await this.resolveCollectionId(query.collection);

    return this.activityLog.track(
      { action: 'update', type: 'write', collectionId, recordId: query.id },
      {
        operation: () => this.agentPort.updateRecord(query, this.user),
        beforeCall: opts.beforeCall,
      },
    );
  }

  async executeAction(query: ExecuteActionQuery, opts: WriteOptions): Promise<unknown> {
    const collectionId = await this.resolveCollectionId(query.collection);

    return this.activityLog.track(
      { action: 'action', type: 'write', collectionId, recordId: query.id },
      {
        operation: () => this.agentPort.executeAction(query, this.user),
        beforeCall: opts.beforeCall,
      },
    );
  }

  // Unaudited passthrough: form-info is a read-only probe (does this action have a form?),
  // not a data access, so unlike the methods above it records NO activity-log entry.
  getActionFormInfo(query: GetActionFormInfoQuery): Promise<{ hasForm: boolean }> {
    return this.agentPort.getActionFormInfo(query, this.user);
  }

  private async resolveCollectionId(collectionName: string): Promise<string> {
    const schema = await this.schemaResolver.resolve(collectionName);

    return schema.collectionId;
  }
}
