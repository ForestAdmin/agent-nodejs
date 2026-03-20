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
  executionResult: { answer: string };
}

// -- Read Record --

interface FieldReadBase {
  fieldName: string;
  displayName: string;
}

export interface FieldReadSuccess extends FieldReadBase {
  value: unknown;
}

export interface FieldReadError extends FieldReadBase {
  error: string;
}

export type FieldReadResult = FieldReadSuccess | FieldReadError;

export interface ReadRecordStepExecutionData extends BaseStepExecutionData {
  type: 'read-record';
  executionParams: { fieldNames: string[] };
  executionResult: { fields: FieldReadResult[] };
  selectedRecordRef: RecordRef;
}

// -- Update Record --

export interface UpdateRecordStepExecutionData extends BaseStepExecutionData {
  type: 'update-record';
  executionParams?: { fieldDisplayName: string; value: string };
  /** User confirmed → values returned by updateRecord. User rejected → skipped. */
  executionResult?: { updatedValues: Record<string, unknown> } | { skipped: true };
  /** AI-selected field and value awaiting user confirmation. Used in the confirmation flow only. */
  pendingUpdate?: {
    fieldDisplayName: string;
    value: string;
  };
  selectedRecordRef: RecordRef;
}

// -- Trigger Action --

export interface TriggerActionStepExecutionData extends BaseStepExecutionData {
  type: 'trigger-action';
  /** Display name and technical name of the executed action. */
  executionParams?: { actionDisplayName: string; actionName: string };
  executionResult?: { success: true } | { skipped: true };
  /** AI-selected action awaiting user confirmation. Used in the confirmation flow only. */
  pendingAction?: { actionDisplayName: string };
  selectedRecordRef: RecordRef;
}

// -- Generic AI Task (fallback for untyped steps) --

export interface RecordTaskStepExecutionData extends BaseStepExecutionData {
  type: 'record-task';
  executionParams?: Record<string, unknown>;
  executionResult?: Record<string, unknown>;
  toolConfirmationInterruption?: Record<string, unknown>;
}

// -- Load Related Record --

export interface LoadRelatedRecordStepExecutionData extends BaseStepExecutionData {
  type: 'load-related-record';
  record: RecordRef;
}

// -- Union --

export type StepExecutionData =
  | ConditionStepExecutionData
  | ReadRecordStepExecutionData
  | UpdateRecordStepExecutionData
  | TriggerActionStepExecutionData
  | RecordTaskStepExecutionData
  | LoadRelatedRecordStepExecutionData;

export type ExecutedStepExecutionData =
  | ConditionStepExecutionData
  | ReadRecordStepExecutionData
  | UpdateRecordStepExecutionData
  | TriggerActionStepExecutionData
  | RecordTaskStepExecutionData;

// TODO: this condition should change when load-related-record gets its own executor
// and produces executionParams/executionResult like other steps.
export function isExecutedStepOnExecutor(
  data: StepExecutionData | undefined,
): data is ExecutedStepExecutionData {
  return !!data && data.type !== 'load-related-record';
}
