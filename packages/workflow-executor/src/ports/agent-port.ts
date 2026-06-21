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
  // Build-time filter (PRD-553) forwarded verbatim to the agent. Port stays agnostic of the
  // filter shape; the adapter casts it to the agent-client's conditionTree type.
  filters?: unknown;
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

export type ExecuteActionQuery = {
  collection: string;
  action: string;
  id?: Id[];
  // Pre-filled form values (PRD-509). Set on the form before execution, going through the agent's
  // normal server-side validation — no bypass. Omitted for formless actions.
  values?: Record<string, unknown>;
};

export type GetActionFormQuery = {
  collection: string;
  action: string;
  id: Id[];
  // Optional values to apply before reading the form back (fires the change hooks so dependent
  // fields appear/update). Soft-applied: unknown fields are reported in `skippedFields`.
  values?: Record<string, unknown>;
};

// One field of an action form, flattened for the executor/AI (PRD-509). Mirrors the MCP
// get-action-form tool's field shape.
export type ActionFormField = {
  name: string;
  type: string;
  value?: unknown;
  isRequired: boolean;
  // Allowed values for an Enum field — the AI must pick one of these or leave the field empty.
  enumValues?: string[];
};

export type ActionForm = {
  fields: ActionFormField[];
  // True when every required field has a value (the agent-client form state's completeness check).
  canExecute: boolean;
  // Required fields still missing a value (empty when canExecute is true).
  requiredFields: string[];
  // Fields from `values` that no longer exist in the form (dropped by dynamic-form change hooks).
  skippedFields: string[];
};

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
  // Full form structure for AI form-filling (PRD-509): field list (types, required, enum options),
  // completeness (canExecute / requiredFields), and any values dropped by change hooks.
  getActionForm(query: GetActionFormQuery, user: StepUser): Promise<ActionForm>;
  // Startup healthcheck. Throws AgentProbeError on network error, timeout, or non-2xx.
  // JWT is not verified here — it's validated naturally when the first step runs.
  probe(): Promise<void>;
}
