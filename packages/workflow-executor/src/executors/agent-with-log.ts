import type ActivityLogger from './activity-logger';
import type { AuditOptions } from './activity-logger';
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

export interface AgentWithLogDeps {
  agentPort: AgentPort;
  schemaResolver: SchemaResolver;
  user: StepUser;
  activityLogger: ActivityLogger;
}

// Wraps AgentPort and runs each data-access call through the ActivityLogger so it emits an
// activity-log entry. The audit target is derived from the call: the numeric collectionId is
// resolved from the call's collection name, the recordId from its id. Idempotency stays in the
// executors: write methods forward a `beforeCall` thunk (the executor's write-ahead marker).
export default class AgentWithLog {
  private readonly agentPort: AgentPort;

  private readonly schemaResolver: SchemaResolver;

  private readonly user: StepUser;

  private readonly activityLogger: ActivityLogger;

  constructor(deps: AgentWithLogDeps) {
    this.agentPort = deps.agentPort;
    this.schemaResolver = deps.schemaResolver;
    this.user = deps.user;
    this.activityLogger = deps.activityLogger;
  }

  async getRecord(query: GetRecordQuery): Promise<RecordData> {
    const collectionId = await this.resolveCollectionId(query.collection);

    return this.activityLogger.run(
      { action: 'index', type: 'read', collectionId, recordId: query.id },
      () => this.agentPort.getRecord(query, this.user),
    );
  }

  async getRelatedData(query: GetRelatedDataQuery): Promise<RecordData[]> {
    const collectionId = await this.resolveCollectionId(query.collection);

    return this.activityLogger.run(
      { action: 'listRelatedData', type: 'read', collectionId, recordId: query.id },
      () => this.agentPort.getRelatedData(query, this.user),
    );
  }

  async getSingleRelatedData(query: GetSingleRelatedDataQuery): Promise<RecordData | null> {
    const collectionId = await this.resolveCollectionId(query.collection);

    return this.activityLogger.run(
      { action: 'listRelatedData', type: 'read', collectionId, recordId: query.id },
      () => this.agentPort.getSingleRelatedData(query, this.user),
    );
  }

  async updateRecord(query: UpdateRecordQuery, opts: AuditOptions): Promise<RecordData> {
    const collectionId = await this.resolveCollectionId(query.collection);

    return this.activityLogger.run(
      { action: 'update', type: 'write', collectionId, recordId: query.id },
      () => this.agentPort.updateRecord(query, this.user),
      opts,
    );
  }

  async executeAction(query: ExecuteActionQuery, opts: AuditOptions): Promise<unknown> {
    const collectionId = await this.resolveCollectionId(query.collection);

    return this.activityLogger.run(
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

  private async resolveCollectionId(collectionName: string): Promise<string> {
    const schema = await this.schemaResolver.resolve(collectionName);

    return schema.collectionId;
  }
}
