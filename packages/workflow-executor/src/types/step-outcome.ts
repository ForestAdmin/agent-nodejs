/** @draft Types derived from the workflow-executor spec -- subject to change. */

import { StepType } from './step-definition';

export type BaseStepStatus = 'success' | 'error';

/** AI task steps can pause mid-execution to await user input (e.g. awaiting-input). */
export type RecordTaskStepStatus = BaseStepStatus | 'awaiting-input';

/** Union of all step statuses. */
export type StepStatus = BaseStepStatus | RecordTaskStepStatus;

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
  status: BaseStepStatus;
  /** Present when status is 'success'. */
  selectedOption?: string;
}

export interface RecordTaskStepOutcome extends BaseStepOutcome {
  type: 'record-task';
  status: RecordTaskStepStatus;
}

export interface McpTaskStepOutcome extends BaseStepOutcome {
  type: 'mcp-task';
  status: RecordTaskStepStatus;
}

export type StepOutcome = ConditionStepOutcome | RecordTaskStepOutcome | McpTaskStepOutcome;

export function stepTypeToOutcomeType(type: StepType): 'condition' | 'record-task' | 'mcp-task' {
  if (type === StepType.Condition) return 'condition';
  if (type === StepType.McpTask) return 'mcp-task';

  return 'record-task';
}
