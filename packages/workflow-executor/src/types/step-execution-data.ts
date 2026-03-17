/** @draft Types derived from the workflow-executor spec -- subject to change. */

import type { RecordRef } from './record';

interface BaseStepExecutionData {
  stepIndex: number;
}

export interface ConditionStepExecutionData extends BaseStepExecutionData {
  type: 'condition';
  executionParams?: { answer: string; reasoning?: string };
  executionResult?: { answer: string };
}

export interface AiTaskStepExecutionData extends BaseStepExecutionData {
  type: 'ai-task';
  executionParams?: Record<string, unknown>;
  executionResult?: Record<string, unknown>;
  toolConfirmationInterruption?: Record<string, unknown>;
  selectedRecordRef?: RecordRef;
}

export type StepExecutionData = ConditionStepExecutionData | AiTaskStepExecutionData;
