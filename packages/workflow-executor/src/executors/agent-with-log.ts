import type ActivityLog from './activity-log';
import type {
  ActionForm,
  AgentPort,
  ExecuteActionQuery,
  GetActionFormInfoQuery,
  GetActionFormQuery,
  GetRecordQuery,
  GetRelatedDataQuery,
  GetSingleRelatedDataQuery,
  ResolvePolymorphicTypeQuery,
  UpdateRecordQuery,
} from '../ports/agent-port';
import type SchemaResolver from '../schema-resolver';
import type { StepUser } from '../types/execution-context';
import type { CollectionSchema, RecordData } from '../types/validated/collection';

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
    const { collectionId } = await this.resolveSchema(query.collection);

    return this.activityLog.track(
      { action: 'index', type: 'read', collectionId, recordId: query.id },
      { operation: () => this.agentPort.getRecord(query, this.user) },
    );
  }

  async getRelatedData(query: GetRelatedDataQuery): Promise<RecordData[]> {
    const schema = await this.resolveSchema(query.collection);

    return this.activityLog.track(
      {
        action: 'listRelatedData',
        type: 'read',
        collectionId: schema.collectionId,
        recordId: query.id,
        label: this.relationLabel(schema, query.relation),
      },
      { operation: () => this.agentPort.getRelatedData(query, this.user) },
    );
  }

  async getSingleRelatedData(query: GetSingleRelatedDataQuery): Promise<RecordData | null> {
    const schema = await this.resolveSchema(query.collection);

    return this.activityLog.track(
      {
        action: 'listRelatedData',
        type: 'read',
        collectionId: schema.collectionId,
        recordId: query.id,
        label: this.relationLabel(schema, query.relation),
      },
      { operation: () => this.agentPort.getSingleRelatedData(query, this.user) },
    );
  }

  async updateRecord(query: UpdateRecordQuery, opts: WriteOptions): Promise<RecordData> {
    const { collectionId } = await this.resolveSchema(query.collection);

    return this.activityLog.track(
      { action: 'update', type: 'write', collectionId, recordId: query.id, label: 'updated' },
      {
        operation: () => this.agentPort.updateRecord(query, this.user),
        beforeCall: opts.beforeCall,
      },
    );
  }

  async executeAction(query: ExecuteActionQuery, opts: WriteOptions): Promise<unknown> {
    const { collectionId } = await this.resolveSchema(query.collection);

    return this.activityLog.track(
      {
        action: 'action',
        type: 'write',
        collectionId,
        recordId: query.id,
        label: `triggered the action "${query.action}"`,
      },
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

  // Unaudited passthrough: reading the form structure (and applying values to reveal dependent
  // fields via change hooks) is read-only — the actual execution is what gets logged (PRD-509/511).
  getActionForm(query: GetActionFormQuery): Promise<ActionForm> {
    return this.agentPort.getActionForm(query, this.user);
  }

  // Unaudited passthrough: resolves a polymorphic relation's target type (metadata probe). The
  // actual related-record load is audited separately, so this records NO activity-log entry.
  resolvePolymorphicType(
    query: ResolvePolymorphicTypeQuery,
  ): Promise<{ type: string; id: string } | null> {
    return this.agentPort.resolvePolymorphicType(query, this.user);
  }

  // ISO with the browser engine: `list relation "<displayName>"`. The query carries the technical
  // relation name; resolve its displayName from the source schema, falling back to the technical
  // name when the field is absent (resilient to orchestrator schema drift).
  private relationLabel(schema: CollectionSchema, relation: string): string {
    const displayName =
      schema.fields.filter(f => f.isRelationship).find(f => f.fieldName === relation)
        ?.displayName ?? relation;

    return `list relation "${displayName}"`;
  }

  private resolveSchema(collectionName: string): Promise<CollectionSchema> {
    return this.schemaResolver.resolve(collectionName);
  }
}
