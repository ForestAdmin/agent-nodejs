/** @draft Types derived from the workflow-executor spec -- subject to change. */

import type { Logger } from './logger-port';
import type { StepExecutionData } from '../types/step-execution-data';

export interface RunStore {
  init(logger?: Logger): Promise<void>;
  close(logger?: Logger): Promise<void>;
  getStepExecutions(runId: string): Promise<StepExecutionData[]>;
  saveStepExecution(runId: string, stepExecution: StepExecutionData): Promise<void>;
}
