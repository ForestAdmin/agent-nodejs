/** @draft Types derived from the workflow-executor spec -- subject to change. */

type BaseStepStatus = 'success' | 'error';

/** Condition steps can fall back to human decision when the AI is uncertain. */
export type ConditionStepStatus = BaseStepStatus | 'manual-decision';

/** AI task steps can pause mid-execution to await user input (e.g. tool confirmation). */
export type AiTaskStepStatus = BaseStepStatus | 'awaiting-input';

/** Union of all step statuses. */
export type StepStatus = ConditionStepStatus | AiTaskStepStatus;

/**
 * StepHistory is sent to the orchestrator — it must NEVER contain client data.
 * Any privacy-sensitive information (e.g. AI reasoning) must stay in
 * StepExecutionData (persisted in the RunStore, client-side only).
 */
interface BaseStepHistory {
  stepId: string;
  stepIndex: number;
  /** Present when status is 'error'. */
  error?: string;
}

export interface ConditionStepHistory extends BaseStepHistory {
  type: 'condition';
  status: ConditionStepStatus;
  /** Present when status is 'success'. */
  selectedOption?: string;
}

export interface AiTaskStepHistory extends BaseStepHistory {
  type: 'ai-task';
  status: AiTaskStepStatus;
}

export type StepHistory = ConditionStepHistory | AiTaskStepHistory;
