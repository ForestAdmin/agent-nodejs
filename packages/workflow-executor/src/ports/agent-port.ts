import type { StepUser } from '../types/execution-context';
import type { CollectionSchema, RecordData } from '../types/validated/collection';

export type Id = string | number;

export type Limit = { limit: number } | { limit: null };

export type GetRecordQuery = { collection: string; id: Id[]; fields?: string[] };

export type UpdateRecordQuery = { collection: string; id: Id[]; values: Record<string, unknown> };

export type GetRelatedDataQuery = {
  collection: string;
  id: Id[];
  relation: string;
  // Schema of the RELATED collection — supplied by the caller so the port can extract the
  // record ID and restore original field names without consulting any cache.
  relatedSchema: CollectionSchema;
  fields?: string[];
} & Limit;

// xToOne relations (BelongsTo / HasOne) — the agent does not serve
// /forest/<collection>/<id>/relationships/<relation> for these; the port instead reads
// the parent record with a `<relation>@@@<field>` projection, then unpacks the relation
// linkage embedded on the parent.
export type GetSingleRelatedDataQuery = {
  collection: string;
  id: Id[];
  relation: string;
  // Schema of the RELATED collection — needed to extract the record ID and (when set)
  // include the referenceField in the projection.
  relatedSchema: CollectionSchema;
  // Extra fields to project on the related side, beyond the related collection's PK.
  // Pass referenceField here when the caller wants to read it from the linkage.
  fields?: string[];
};

export type ExecuteActionQuery = { collection: string; action: string; id?: Id[] };

export type GetActionFormInfoQuery = { collection: string; action: string; id: Id[] };

export type ResolvePolymorphicTypeQuery = { collection: string; id: Id[]; relation: string };

export interface AgentPort {
  getRecord(query: GetRecordQuery, user: StepUser): Promise<RecordData>;
  updateRecord(query: UpdateRecordQuery, user: StepUser): Promise<RecordData>;
  getRelatedData(query: GetRelatedDataQuery, user: StepUser): Promise<RecordData[]>;
  // Returns null when the parent has no related record (xToOne with no linkage).
  getSingleRelatedData(
    query: GetSingleRelatedDataQuery,
    user: StepUser,
  ): Promise<RecordData | null>;
  // Reads a polymorphic relation's target from the raw JSON:API linkage ({ type, id }), which the
  // agent-client deserializer drops. Returns null when the record has no linked target.
  resolvePolymorphicType(
    query: ResolvePolymorphicTypeQuery,
    user: StepUser,
  ): Promise<{ type: string; id: string } | null>;
  executeAction(query: ExecuteActionQuery, user: StepUser): Promise<unknown>;
  // Old Ruby agents with hooks.load=false return 404; agent-client falls back to the fields
  // passed via ActionEndpointsByCollection (populated from the orchestrator's schema).
  getActionFormInfo(query: GetActionFormInfoQuery, user: StepUser): Promise<{ hasForm: boolean }>;
  // Startup healthcheck. Throws AgentProbeError on network error, timeout, or non-2xx.
  // JWT is not verified here — it's validated naturally when the first step runs.
  probe(): Promise<void>;
}
