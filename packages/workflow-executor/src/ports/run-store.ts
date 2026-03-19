/** @draft Types derived from the workflow-executor spec -- subject to change. */

import type { StepExecutionData } from '../types/step-execution-data';

export interface RunStore {
  getStepExecutions(): Promise<StepExecutionData[]>;
  saveStepExecution(stepExecution: StepExecutionData): Promise<void>;
}
