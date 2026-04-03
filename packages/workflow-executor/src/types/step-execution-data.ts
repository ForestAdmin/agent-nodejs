/** @draft Types derived from the workflow-executor spec -- subject to change. */

import type { RecordRef } from './record';

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
  /** User confirmed → values returned by updateRecord. User rejected → skipped. */
  executionResult?: { updatedValues: Record<string, unknown> } | { skipped: true };
  /** AI-selected field and value awaiting user confirmation. Used in the confirmation flow only. */
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
  /** Display name and technical name of the executed action. */
  executionParams?: ActionRef;
  executionResult?: { success: true; actionResult: unknown } | { skipped: true };
  /** AI-selected action awaiting user confirmation. Used in the confirmation flow only. */
  pendingData?: ActionRef & { userConfirmed?: boolean };
  selectedRecordRef: RecordRef;
}

// -- Mcp --

/** Reference to an MCP tool by its sanitized name (OpenAI-safe, alphanumeric + underscores/hyphens). */
export interface McpToolRef {
  name: string;
  sourceId: string;
}

/** A resolved tool call: sanitized tool name + input parameters sent to the tool. */
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
  /** AI-selected fields suggested for display on the frontend. undefined = not computed (no non-relation fields). */
  suggestedFields?: string[];
  /**
   * The record id to load. Initially set by the AI. Can be overridden by the frontend
   * via PATCH /runs/:runId/steps/:stepIndex/pending-data.
   */
  selectedRecordId: Array<string | number>;
  /** Set by the frontend via PATCH /runs/:runId/steps/:stepIndex/pending-data. */
  userConfirmed?: boolean;
}

export interface LoadRelatedRecordStepExecutionData extends BaseStepExecutionData {
  type: 'load-related-record';
  /** AI-selected relation with pre-fetched candidates awaiting user confirmation. */
  pendingData?: LoadRelatedRecordPendingData;
  /** The record ref used to load the relation. Required for handleConfirmationFlow. */
  selectedRecordRef: RecordRef;
  executionParams?: RelationRef;
  /**
   * Navigation path captured at execution time — used by StepSummaryBuilder for AI context.
   * Source is not repeated here — it is always selectedRecordRef, consistent with other step types.
   */
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

/** Alias for StepExecutionData — kept for backwards-compatible consumption at the call sites. */
export type ExecutedStepExecutionData = StepExecutionData;
