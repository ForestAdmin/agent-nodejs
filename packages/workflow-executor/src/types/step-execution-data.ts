/** @draft Types derived from the workflow-executor spec -- subject to change. */

import type { CollectionRef } from './record';

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

// -- Generic AI Task (fallback for untyped steps) --

export interface AiTaskStepExecutionData extends BaseStepExecutionData {
  type: 'ai-task';
  executionParams?: Record<string, unknown>;
  executionResult?: Record<string, unknown>;
  toolConfirmationInterruption?: Record<string, unknown>;
  selectedRecord?: CollectionRef;
}

// -- Union --

export type StepExecutionData =
  | ConditionStepExecutionData
  | ReadRecordStepExecutionData
  | AiTaskStepExecutionData;
