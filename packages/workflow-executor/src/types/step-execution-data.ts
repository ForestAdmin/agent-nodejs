/** @draft Types derived from the workflow-executor spec -- subject to change. */

import type { RecordRef } from './record';

// -- Base --

interface BaseStepExecutionData {
  stepIndex: number;
  /** Populated by executors awaiting confirmation; used to display pending state in AI context. */
  pendingData?: object;
}

// -- Condition --

export interface ConditionStepExecutionData extends BaseStepExecutionData {
  type: 'condition';
  executionParams: { answer: string | null; reasoning?: string };
  executionResult: { answer: string };
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
  pendingData?: FieldRef & { value: string };
  selectedRecordRef: RecordRef;
}

// -- Trigger Action --

export interface ActionRef {
  name: string;
  displayName: string;
}

export interface TriggerRecordActionStepExecutionData extends BaseStepExecutionData {
  type: 'trigger-action';
  /** Display name and technical name of the executed action. */
  executionParams?: ActionRef;
  executionResult?: { success: true } | { skipped: true };
  /** AI-selected action awaiting user confirmation. Used in the confirmation flow only. */
  pendingData?: ActionRef;
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
  | TriggerRecordActionStepExecutionData
  | RecordTaskStepExecutionData
  | LoadRelatedRecordStepExecutionData;

export type ExecutedStepExecutionData =
  | ConditionStepExecutionData
  | ReadRecordStepExecutionData
  | UpdateRecordStepExecutionData
  | TriggerRecordActionStepExecutionData
  | RecordTaskStepExecutionData;

// TODO: this condition should change when load-related-record gets its own executor
// and produces executionParams/executionResult like other steps.
export function isExecutedStepOnExecutor(
  data: StepExecutionData | undefined,
): data is ExecutedStepExecutionData {
  return !!data && data.type !== 'load-related-record';
}
