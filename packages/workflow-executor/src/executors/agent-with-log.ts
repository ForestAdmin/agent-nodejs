import type {
  ActionForm,
  AgentPort,
  ExecuteActionQuery,
  ExecuteActionResult,
  GetActionFormInfoQuery,
  GetActionFormQuery,
  GetRecordQuery,
  GetRelatedDataQuery,
  GetRelatedRecordIdQuery,
  GetSingleRelatedDataQuery,
  Id,
  ResolvePolymorphicTypeQuery,
  UpdateRecordQuery,
} from '../ports/agent-port';
import type SchemaResolver from '../schema-resolver';
import type { StepUser } from '../types/execution-context';
import type { RecordData } from '../types/validated/collection';
import type { ActivityLogConfig } from '@forestadmin/agent-client';

type WriteOptions = { beforeCall: () => Promise<void> };

export interface AgentWithLogDeps {
  agentPort: AgentPort;
  schemaResolver: SchemaResolver;
  user: StepUser;
  activityLog: ActivityLogConfig;
  forestServerToken?: string;
}

// Idempotency stays in the executors: write methods forward a `beforeCall` thunk (the executor's
// write-ahead marker), which agent-client runs after the pending entry.
export default class AgentWithLog {
  private readonly agentPort: AgentPort;

  private readonly schemaResolver: SchemaResolver;

  private readonly user: StepUser;

  private readonly activityLog: ActivityLogConfig;

  private readonly forestServerToken?: string;

  constructor(deps: AgentWithLogDeps) {
    this.agentPort = deps.agentPort;
    this.schemaResolver = deps.schemaResolver;
    this.user = deps.user;
    this.activityLog = deps.activityLog;
    this.forestServerToken = deps.forestServerToken;
  }

  getRecord(query: GetRecordQuery): Promise<RecordData> {
    return this.agentPort.getRecord(query, this.user, { context: this.activityLog });
  }

  async getRelatedData(query: GetRelatedDataQuery): Promise<RecordData[]> {
    const label = await this.relationLabel(query.collection, query.relation);

    return this.agentPort.getRelatedData(query, this.user, {
      context: this.activityLog,
      call: { label },
    });
  }

  async getSingleRelatedData(query: GetSingleRelatedDataQuery): Promise<RecordData | null> {
    const label = await this.relationLabel(query.collection, query.relation);

    return this.agentPort.getSingleRelatedData(query, this.user, {
      context: this.activityLog,
      call: { label },
    });
  }

  async getRelatedRecordId(query: GetRelatedRecordIdQuery): Promise<Id[] | null> {
    const label = await this.relationLabel(query.collection, query.relation);

    return this.agentPort.getRelatedRecordId(query, this.user, {
      context: this.activityLog,
      call: { label },
    });
  }

  updateRecord(query: UpdateRecordQuery, opts: WriteOptions): Promise<RecordData> {
    return this.agentPort.updateRecord(query, this.user, {
      context: this.activityLog,
      call: { beforeCall: opts.beforeCall },
    });
  }

  executeAction(query: ExecuteActionQuery, opts: WriteOptions): Promise<ExecuteActionResult> {
    return this.agentPort.executeAction(
      query,
      { user: this.user, forestServerToken: this.forestServerToken },
      { context: this.activityLog, call: { beforeCall: opts.beforeCall } },
    );
  }

  // Unaudited passthrough: form-info is a read-only probe (does this action have a form?),
  // not a data access, so unlike the methods above it records NO activity-log entry.
  getActionFormInfo(query: GetActionFormInfoQuery): Promise<{ hasForm: boolean }> {
    return this.agentPort.getActionFormInfo(query, this.user);
  }

  // Unaudited passthrough: reading the form structure (and applying values to reveal dependent
  // fields via change hooks) is read-only — the actual execution is what gets logged.
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
  private async relationLabel(collection: string, relation: string): Promise<string> {
    const schema = await this.schemaResolver.resolve(collection);
    const displayName =
      schema.fields.filter(f => f.isRelationship).find(f => f.fieldName === relation)
        ?.displayName ?? relation;

    return `list relation "${displayName}"`;
  }
}
