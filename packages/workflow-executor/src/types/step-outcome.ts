/** @draft Types derived from the workflow-executor spec -- subject to change. */

export type BaseStepStatus = 'success' | 'error';

/** Condition steps can fall back to human decision when the AI is uncertain. */
export type ConditionStepStatus = BaseStepStatus | 'manual-decision';

/** AI task steps can pause mid-execution to await user input (e.g. awaiting-input). */
export type RecordTaskStepStatus = BaseStepStatus | 'awaiting-input';

/** Union of all step statuses. */
export type StepStatus = ConditionStepStatus | RecordTaskStepStatus;

/**
 * StepOutcome is sent to the orchestrator — it must NEVER contain client data.
 * Any privacy-sensitive information (e.g. AI reasoning) must stay in
 * StepExecutionData (persisted in the RunStore, client-side only).
 */
interface BaseStepOutcome {
  stepId: string;
  stepIndex: number;
  /** Present when status is 'error'. */
  error?: string;
}

export interface ConditionStepOutcome extends BaseStepOutcome {
  type: 'condition';
  status: ConditionStepStatus;
  /** Present when status is 'success'. */
  selectedOption?: string;
}

export interface RecordTaskStepOutcome extends BaseStepOutcome {
  type: 'record-task';
  status: RecordTaskStepStatus;
}

export type StepOutcome = ConditionStepOutcome | RecordTaskStepOutcome;
