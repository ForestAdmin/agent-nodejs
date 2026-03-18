/** @draft Types derived from the workflow-executor spec -- subject to change. */

import type { RecordData } from '../types/record';
import type { StepExecutionData } from '../types/step-execution-data';

export interface RunStore {
  getRecords(): Promise<RecordData[]>;
  getStepExecutions(): Promise<StepExecutionData[]>;
  saveStepExecution(stepExecution: StepExecutionData): Promise<void>;
}
