/** @draft Types derived from the workflow-executor spec -- subject to change. */

import type { RecordRef } from './record';

interface BaseStepExecutionData {
  stepIndex: number;
  executionParams?: Record<string, unknown>;
  executionResult?: Record<string, unknown>;
}

export interface ConditionStepExecutionData extends BaseStepExecutionData {
  type: 'condition';
}

export interface AiTaskStepExecutionData extends BaseStepExecutionData {
  type: 'ai-task';
  toolConfirmationInterruption?: Record<string, unknown>;
  selectedRecordRef?: RecordRef;
}

export type StepExecutionData = ConditionStepExecutionData | AiTaskStepExecutionData;
