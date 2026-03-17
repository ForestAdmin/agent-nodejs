/** @draft Types derived from the workflow-executor spec -- subject to change. */

/**
 * - 'awaiting-input': the step needs generic user input to continue (e.g. tool confirmation).
 * - 'manual-decision': the AI could not choose among the condition options —
 *    the user must pick one manually. Distinct from 'awaiting-input' because
 *    it signals a fallback to human decision, not a mid-step interaction.
 */
export type StepStatus = 'success' | 'error' | 'awaiting-input' | 'manual-decision';

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
  /** Present when status is 'manual-decision' — explains why the AI could not choose. */
  reasoning?: string;
}

export interface AiTaskStepHistory extends BaseStepHistory {
  type: 'ai-task';
}

export type StepHistory = ConditionStepHistory | AiTaskStepHistory;
