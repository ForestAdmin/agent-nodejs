/** @draft Types derived from the workflow-executor spec -- subject to change. */

import { StepType } from './step-definition';

export type BaseStepStatus = 'success' | 'error';

// AI steps can pause mid-execution to await user input (awaiting-input).
export type RecordStepStatus = BaseStepStatus | 'awaiting-input';

export type StepStatus = BaseStepStatus | RecordStepStatus;

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

export interface RecordStepOutcome extends BaseStepOutcome {
  type: 'record';
  status: RecordStepStatus;
}

export interface McpStepOutcome extends BaseStepOutcome {
  type: 'mcp';
  status: RecordStepStatus;
}

export interface GuidanceStepOutcome extends BaseStepOutcome {
  type: 'guidance';
  status: BaseStepStatus;
}

export type StepOutcome =
  | ConditionStepOutcome
  | RecordStepOutcome
  | McpStepOutcome
  | GuidanceStepOutcome;

export function stepTypeToOutcomeType(type: StepType): 'condition' | 'record' | 'mcp' | 'guidance' {
  if (type === StepType.Condition) return 'condition';
  if (type === StepType.Mcp) return 'mcp';
  if (type === StepType.Guidance) return 'guidance';

  return 'record';
}
