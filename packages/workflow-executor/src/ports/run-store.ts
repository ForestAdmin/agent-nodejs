/** @draft Types derived from the workflow-executor spec -- subject to change. */

import type { StepExecutionData } from '../types/step-execution-data';

export interface RunStore {
  init(): Promise<void>;
  close(): Promise<void>;
  getStepExecutions(runId: string): Promise<StepExecutionData[]>;
  saveStepExecution(runId: string, stepExecution: StepExecutionData): Promise<void>;
}
