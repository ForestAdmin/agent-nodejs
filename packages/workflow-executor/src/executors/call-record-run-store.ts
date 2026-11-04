import type { RunStore } from '../ports/run-store';
import type { StepExecutionData } from '../types/step-execution-data';
import type { RecordRef } from '../types/validated/collection';

import { narrowToRecord } from './iteration-run-store';

// What a call opened once per record of a Multiple step sees of the calling workflow: that record
// alone, as an iteration of a per-record step sees it. The call's own steps read as they are.
export default class CallRecordRunStore implements RunStore {
  private readonly base: RunStore;
  private readonly record: RecordRef;
  private readonly callStepIndexes: number[];

  constructor(base: RunStore, record: RecordRef, callStepIndexes: number[]) {
    this.base = base;
    this.record = record;
    this.callStepIndexes = callStepIndexes;
  }

  init(): Promise<void> {
    return Promise.resolve();
  }

  close(): Promise<void> {
    return Promise.resolve();
  }

  async getStepExecutions(runId: string): Promise<StepExecutionData[]> {
    const rows = await this.base.getStepExecutions(runId);

    return rows.flatMap(row =>
      this.callStepIndexes.includes(row.stepIndex) ? [row] : narrowToRecord(row, this.record),
    );
  }

  saveStepExecution(runId: string, stepExecution: StepExecutionData): Promise<void> {
    return this.base.saveStepExecution(runId, stepExecution);
  }

  deleteStepExecution(runId: string, stepIndex: number): Promise<void> {
    return this.base.deleteStepExecution(runId, stepIndex);
  }
}
