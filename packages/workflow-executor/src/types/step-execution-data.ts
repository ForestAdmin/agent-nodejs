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

export interface UpdateRecordStepExecutionData extends MutatingStepExecutionData {
  type: 'update-record';
  executionParams?: FieldWithValue;
  // `reasoning` is absent when the user changed the AI value to a different one.
  executionResult?:
    | { updatedValues: Record<string, unknown>; reasoning?: string }
    | { skipped: true };
  pendingData?: FieldWithValue & { reasoning?: string };
  selectedRecordRef: RecordRef;
  userConfirmation?: UpdateRecordConfirmation;
}

// -- Trigger Action --

export interface ActionRef {
  name: string;
  displayName: string;
}

// Intentionally separate from ActionRef/FieldRef: expected to gain relation-specific
// fields (e.g. relationType) in a future iteration.
export interface RelationRef {
  name: string;
  displayName: string;
}

export interface TriggerRecordActionStepExecutionData extends MutatingStepExecutionData {
  type: 'trigger-action';
  executionParams?: ActionRef;
  executionResult?: { success: true; actionResult: unknown } | { skipped: true };
  pendingData?: ActionRef;
  selectedRecordRef: RecordRef;
  userConfirmation?: TriggerActionConfirmation;
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

export interface McpStepExecutionData extends MutatingStepExecutionData {
  type: 'mcp';
  // Privacy-sensitive: stays client-side, never sent in the StepOutcome.
  toolSelectionReasoning?: string;
  executionParams?: McpToolCall;
  executionResult?:
    | { success: true; toolResult: unknown; formattedResponse?: string }
    | { skipped: true };
  pendingData?: McpToolCall;
  userConfirmation?: McpConfirmation;
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
  // Technical names of the fields the AI judged most relevant to identify the record.
  suggestedFields?: string[];
  // AI justification for the selected fields (selectRelevantFields).
  fieldsReasoning?: string;
  // AI justification for the suggested record (selectBestRecordIndex).
  reasoning?: string;
}

export interface LoadRelatedRecordStepExecutionData extends BaseStepExecutionData {
  type: 'load-related-record';
  pendingData?: LoadRelatedRecordPendingData;
  selectedRecordRef: RecordRef;
  executionParams?: RelationRef;
  executionResult?:
    | {
        relation: RelationRef;
        record: RecordRef;
        suggestedFields?: string[];
        fieldsReasoning?: string;
        reasoning?: string;
      }
    | { skipped: true };
  userConfirmation?: LoadRelatedRecordConfirmation;
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
