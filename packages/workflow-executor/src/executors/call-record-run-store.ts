import type { RunStore } from '../ports/run-store';
import type { StepExecutionData } from '../types/step-execution-data';
import type { RecordRef } from '../types/validated/collection';

import { narrowToRecord } from './iteration-run-store';

// What a call opened once per record of a Multiple step sees of the calling workflow: that record
// alone, as an iteration of a per-record step sees it. Every row written since the call opened is
// the call's own, the pending step's and its revisions' included, and reads as it is.
export default class CallRecordRunStore implements RunStore {
  private readonly base: RunStore;
  private readonly record: RecordRef;
  private readonly callStartStepIndex: number;

  constructor(base: RunStore, record: RecordRef, callStartStepIndex: number) {
    this.base = base;
    this.record = record;
    this.callStartStepIndex = callStartStepIndex;
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
      row.stepIndex > this.callStartStepIndex ? [row] : narrowToRecord(row, this.record),
    );
  }

  saveStepExecution(runId: string, stepExecution: StepExecutionData): Promise<void> {
    return this.base.saveStepExecution(runId, stepExecution);
  }

  deleteStepExecution(runId: string, stepIndex: number): Promise<void> {
    return this.base.deleteStepExecution(runId, stepIndex);
  }
}
