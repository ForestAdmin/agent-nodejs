/** @draft Types derived from the workflow-executor spec -- subject to change. */

import type { RecordRef } from './validated/collection';

// -- Base --

interface BaseStepExecutionData {
  stepIndex: number;
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

export interface UpdateRecordStepExecutionData extends BaseStepExecutionData {
  type: 'update-record';
  executionParams?: FieldRef & { value: string };
  // User confirmed → values returned by updateRecord. User rejected → skipped.
  executionResult?: { updatedValues: Record<string, unknown> } | { skipped: true };
  pendingData?: FieldRef & { value: string; userConfirmed?: boolean };
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

export interface TriggerRecordActionStepExecutionData extends BaseStepExecutionData {
  type: 'trigger-action';
  executionParams?: ActionRef;
  executionResult?: { success: true; actionResult: unknown } | { skipped: true };
  // When userConfirmed=true, actionResult is required: the frontend executes the action and
  // posts the result back (the executor never re-executes on confirmation).
  pendingData?: ActionRef & { userConfirmed?: boolean; actionResult?: unknown };
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

export interface McpStepExecutionData extends BaseStepExecutionData {
  type: 'mcp';
  executionParams?: McpToolCall;
  executionResult?:
    | { success: true; toolResult: unknown; formattedResponse?: string }
    | { skipped: true };
  pendingData?: McpToolCall & { userConfirmed?: boolean };
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
  // AI-selected initially; can be overridden by the frontend via PATCH .../pending-data.
  selectedRecordId: Array<string | number>;
  userConfirmed?: boolean;
}

export interface LoadRelatedRecordStepExecutionData extends BaseStepExecutionData {
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
  executionResult?: { userInput: string };
}

// -- Union --

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
