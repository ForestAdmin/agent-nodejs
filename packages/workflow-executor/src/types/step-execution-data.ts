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
  executionResult?: { updatedValues: Record<string, unknown> } | { skipped: true };
  pendingUpdate?: {
    fieldDisplayName: string;
    value: string;
  };
  selectedRecordRef: RecordRef;
}

// -- Generic AI Task (fallback for untyped steps) --

export interface AiTaskStepExecutionData extends BaseStepExecutionData {
  type: 'ai-task';
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
  | AiTaskStepExecutionData
  | LoadRelatedRecordStepExecutionData;

export type ExecutedStepExecutionData =
  | ConditionStepExecutionData
  | ReadRecordStepExecutionData
  | UpdateRecordStepExecutionData
  | AiTaskStepExecutionData;

// TODO: this condition should change when load-related-record gets its own executor
// and produces executionParams/executionResult like other steps.
export function isExecutedStepOnExecutor(
  data: StepExecutionData | undefined,
): data is ExecutedStepExecutionData {
  return !!data && data.type !== 'load-related-record';
}
