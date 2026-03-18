/** @draft Types derived from the workflow-executor spec -- subject to change. */

import type { RecordData } from './record';

interface BaseStepExecutionData {
  stepIndex: number;
}

export interface ConditionStepExecutionData extends BaseStepExecutionData {
  type: 'condition';
  executionParams?: { answer: string | null; reasoning?: string };
  executionResult?: { answer: string };
}

export interface AiTaskStepExecutionData extends BaseStepExecutionData {
  type: 'ai-task';
  executionParams?: Record<string, unknown>;
  executionResult?: Record<string, unknown>;
  toolConfirmationInterruption?: Record<string, unknown>;
  selectedRecord?: RecordData;
}

export type StepExecutionData = ConditionStepExecutionData | AiTaskStepExecutionData;
