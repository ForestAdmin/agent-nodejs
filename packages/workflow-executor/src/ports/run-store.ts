/** @draft Types derived from the workflow-executor spec -- subject to change. */

import type { RecordData } from '../types/record';
import type { StepExecutionData } from '../types/step-execution-data';

export interface RunStore {
  getRecords(runId: string): Promise<RecordData[]>;
  getRecord(runId: string, collectionName: string, recordId: string): Promise<RecordData | null>;
  saveRecord(runId: string, record: RecordData): Promise<void>;
  getStepExecutions(runId: string): Promise<StepExecutionData[]>;
  getStepExecution(runId: string, stepIndex: number): Promise<StepExecutionData | null>;
  saveStepExecution(runId: string, stepExecution: StepExecutionData): Promise<void>;
}
