/** @draft Types derived from the workflow-executor spec -- subject to change. */

import type { RecordData } from '../types/record';
import type { StepExecutionData } from '../types/step-execution-data';

export interface RunStore {
  getRecords(): Promise<RecordData[]>;
  getRecord(collectionName: string, recordId: string): Promise<RecordData | null>;
  saveRecord(record: RecordData): Promise<void>;
  getStepExecutions(): Promise<StepExecutionData[]>;
  getStepExecution(stepIndex: number): Promise<StepExecutionData | null>;
  saveStepExecution(stepExecution: StepExecutionData): Promise<void>;
}
