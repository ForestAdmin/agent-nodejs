/** @draft Types derived from the workflow-executor spec -- subject to change. */

/**
 * - 'success': the step completed normally.
 * - 'error': the step failed (see `error` field for details).
 * - 'awaiting-input': the step needs generic user input to continue (e.g. tool confirmation).
 * - 'manual-decision': the AI could not determine the outcome automatically —
 *    the user must decide manually. Distinct from 'awaiting-input' because
 *    it signals a fallback to human decision, not a mid-step interaction.
 */
export type StepStatus = 'success' | 'error' | 'awaiting-input' | 'manual-decision';

/**
 * StepHistory is sent to the orchestrator — it must NEVER contain client data.
 * Any privacy-sensitive information (e.g. AI reasoning) must stay in
 * StepExecutionData (persisted in the RunStore, client-side only).
 */
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
