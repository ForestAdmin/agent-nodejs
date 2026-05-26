/** @draft Types derived from the workflow-executor spec -- subject to change. */

import type { RecordRef } from './validated/collection';
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
  executionResult?: { success: true; actionResult: unknown } | { skipped: true };
  pendingData?: ActionRef;
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

export interface LoadRelatedRecordPendingData extends RelationRef {
  // undefined when not computed (record has no non-relation fields).
  suggestedFields?: string[];
  // AI-selected initially; frontend can override via userConfirmation.selectedRecordId.
  selectedRecordId: Array<string | number>;
}

export interface LoadRelatedRecordStepExecutionData
  extends BaseStepExecutionData,
    WithUserConfirmation<LoadRelatedRecordConfirmation> {
  type: 'load-related-record';
  pendingData?: LoadRelatedRecordPendingData;
  selectedRecordRef: RecordRef;
  executionParams?: RelationRef;
  // Source is always selectedRecordRef, not repeated here (consistent with other step types).
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
