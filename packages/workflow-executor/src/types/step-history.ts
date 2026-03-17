/** @draft Types derived from the workflow-executor spec -- subject to change. */

export type StepStatus = 'success' | 'error' | 'awaiting-input';

interface BaseStepHistory {
  stepId: string;
  stepIndex: number;
  status: StepStatus;
  /** Present when status is 'error'. */
  error?: string;
}

export interface ConditionStepHistory extends BaseStepHistory {
  type: 'condition';
  /** Present when status is 'success'. */
  selectedOption?: string;
}

export interface AiTaskStepHistory extends BaseStepHistory {
  type: 'ai-task';
}

export type StepHistory = ConditionStepHistory | AiTaskStepHistory;
