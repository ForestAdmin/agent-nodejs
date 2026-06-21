import type { ActionFormField } from '../ports/agent-port';
import type { RecordId, RecordRef } from './validated/collection';
import type {
  LoadRelatedRecordConfirmation,
  McpConfirmation,
  TriggerActionConfirmation,
  UpdateRecordConfirmation,
} from '../http/pending-data-validators';

// -- Base --

interface BaseStepExecutionData {
  stepIndex: number;
}

// Extended by executors that write a side effect (update-record, trigger-action, mcp).
// Write-ahead log: 'executing' = side effect may have fired; 'done' = completed, safe to replay.
interface MutatingStepExecutionData extends BaseStepExecutionData {
  idempotencyPhase?: 'executing' | 'done';
}

// Validated POST body stored alongside `pendingData` (AI suggestion) so executors
// can read user input without overwriting the AI suggestion.
export interface WithUserConfirmation<T extends Record<string, unknown> = Record<string, unknown>> {
  userConfirmation?: T;
}

// -- Condition --

export interface ConditionStepExecutionData extends BaseStepExecutionData {
  type: 'condition';
  executionParams: { answer: string | null; reasoning?: string };
  executionResult?: { answer: string };
}

// -- Shared --

export interface FieldRef {
  name: string;
  displayName: string;
}

export type FieldWithValue = FieldRef & { value: unknown };

// -- Read Record --

export interface FieldReadSuccess extends FieldRef {
  value: unknown;
}

export interface FieldReadError extends FieldRef {
  error: string;
}

export type FieldReadResult = FieldReadSuccess | FieldReadError;

export interface ReadRecordStepExecutionData extends BaseStepExecutionData {
  type: 'read-record';
  executionParams: { fields: FieldRef[] };
  executionResult: { fields: FieldReadResult[] };
  selectedRecordRef: RecordRef;
}

// -- Update Record --

export interface UpdateRecordStepExecutionData
  extends MutatingStepExecutionData,
    WithUserConfirmation<UpdateRecordConfirmation> {
  type: 'update-record';
  executionParams?: FieldWithValue;
  // User confirmed → values returned by updateRecord. User rejected → skipped.
  executionResult?: { updatedValues: Record<string, unknown> } | { skipped: true };
  pendingData?: FieldWithValue;
  selectedRecordRef: RecordRef;
}

// -- Trigger Action --

export interface ActionRef {
  name: string;
  displayName: string;
}

// One AI-prefilled form value (PRD-511). Kept as an ORDERED list (not a map) so the front can
// replay it sequentially — setting a field fires its change hook, which may reveal dependent fields.
export interface AiFilledFormValue {
  field: string;
  value: unknown;
}

// Pending payload for a form-bearing Trigger Action paused for review (PRD-511). `form` is absent
// for formless actions and for Manual mode (no AI prefill at all).
export interface TriggerActionPendingData extends ActionRef {
  form?: {
    fields: ActionFormField[];
    aiFilledValues: AiFilledFormValue[];
  };
}

// Submission outcome reported by the native front (PRD-511/520): `executed` = the action ran and a
// result exists; `pending-approval` = the submit only created an approval request (no result yet).
export type TriggerActionSubmissionOutcome = 'executed' | 'pending-approval';

// Intentionally separate from ActionRef/FieldRef: expected to gain relation-specific
// fields (e.g. relationType) in a future iteration.
export interface RelationRef {
  name: string;
  displayName: string;
}

export interface TriggerRecordActionStepExecutionData
  extends MutatingStepExecutionData,
    WithUserConfirmation<TriggerActionConfirmation> {
  type: 'trigger-action';
  executionParams?: ActionRef;
  executionResult?:
    | {
        success: true;
        // Absent when submissionOutcome is 'pending-approval' (no result exists yet).
        actionResult?: unknown;
        // Defaults to 'executed' semantics when absent (formless / legacy flows). PRD-511/520.
        submissionOutcome?: TriggerActionSubmissionOutcome;
        // Final values the front submitted + the ordered AI prefill — PRD-513 audit (human-edit diff).
        submittedValues?: Record<string, unknown>;
        aiFilledValues?: AiFilledFormValue[];
      }
    | { skipped: true };
  pendingData?: TriggerActionPendingData;
  selectedRecordRef: RecordRef;
}

// -- Mcp --

// `name` is the OpenAI-safe sanitized MCP tool name (alphanumeric + underscores/hyphens).
export interface McpToolRef {
  name: string;
  sourceId: string;
}

export interface McpToolCall extends McpToolRef {
  input: Record<string, unknown>;
}

export interface McpStepExecutionData
  extends MutatingStepExecutionData,
    WithUserConfirmation<McpConfirmation> {
  type: 'mcp';
  executionParams?: McpToolCall;
  executionResult?:
    | { success: true; toolResult: unknown; formattedResponse?: string }
    | { skipped: true };
  pendingData?: McpToolCall;
}

// -- Generic AI Task (fallback for untyped steps) --

export interface RecordStepExecutionData extends BaseStepExecutionData {
  type: 'record';
  executionParams?: Record<string, unknown>;
  executionResult?: Record<string, unknown>;
  toolConfirmationInterruption?: Record<string, unknown>;
}

// -- Load Related Record --
export interface LoadRelatedRecordCandidate {
  recordId: RecordId;
  referenceFieldValue: string | null;
}

export interface LoadRelatedRecordPendingData {
  availableFields: RelationRef[];
  suggestedField: RelationRef;
  availableRecordIds: LoadRelatedRecordCandidate[];
  // Absent when the relation has no linked record(s): the list is empty and there's nothing to suggest.
  suggestedRecord?: LoadRelatedRecordCandidate;
}

export interface LoadRelatedRecordStepExecutionData
  extends BaseStepExecutionData,
    WithUserConfirmation<LoadRelatedRecordConfirmation> {
  type: 'load-related-record';
  pendingData?: LoadRelatedRecordPendingData;
  selectedRecordRef: RecordRef;
  executionParams?: RelationRef;
  executionResult?: { relation: RelationRef; record: RecordRef } | { skipped: true };
}

// -- Guidance --

export interface GuidanceStepExecutionData extends BaseStepExecutionData {
  type: 'guidance';
  pendingData?: { userInput?: string };
  executionResult?: { userInput?: string };
}

export type ConfirmableStepExecutionData =
  | UpdateRecordStepExecutionData
  | TriggerRecordActionStepExecutionData
  | McpStepExecutionData
  | LoadRelatedRecordStepExecutionData;

export type StepExecutionData =
  | ConditionStepExecutionData
  | ReadRecordStepExecutionData
  | UpdateRecordStepExecutionData
  | TriggerRecordActionStepExecutionData
  | RecordStepExecutionData
  | LoadRelatedRecordStepExecutionData
  | McpStepExecutionData
  | GuidanceStepExecutionData;

export type ExecutedStepExecutionData = StepExecutionData;
