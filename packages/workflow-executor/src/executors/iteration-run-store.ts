import type { RunStore } from '../ports/run-store';
import type { StepExecutionData, StepIteration } from '../types/step-execution-data';
import type { RecordRef } from '../types/validated/collection';

import { serializeRecordId } from '../record-id';
import { isPerRecordExecution } from '../types/step-execution-data';

// The fields a single-record execution and an iteration share.
const ITERATION_FIELDS = [
  'selectedRecordRef',
  'executionParams',
  'pendingData',
  'userConfirmation',
  'executionResult',
  'idempotencyPhase',
] as const;

export function isSameRecord(a: RecordRef, b: RecordRef): boolean {
  return (
    a.collectionName === b.collectionName &&
    serializeRecordId(a.recordId) === serializeRecordId(b.recordId)
  );
}

function asExecution(row: StepExecutionData, iteration: StepIteration): StepExecutionData {
  const execution: Record<string, unknown> = { type: row.type, stepIndex: row.stepIndex };

  ITERATION_FIELDS.forEach(field => {
    if (iteration[field] !== undefined) execution[field] = iteration[field];
  });

  return execution as unknown as StepExecutionData;
}

export interface IterationHandle {
  get(): StepIteration;
  set(iteration: StepIteration): Promise<void>;
}

// What one record's run of a step running once per record sees of the run: its own iteration as
// the step's execution, and every earlier per-record step narrowed to the same record, so the
// single-record executor runs unchanged and never reads another record's results.
export default class IterationRunStore implements RunStore {
  private readonly base: RunStore;
  private readonly stepIndex: number;
  private readonly sourceRecordRef: RecordRef;
  private readonly handle: IterationHandle;
  private abandoned = false;

  constructor(
    base: RunStore,
    stepIndex: number,
    sourceRecordRef: RecordRef,
    handle: IterationHandle,
  ) {
    this.base = base;
    this.stepIndex = stepIndex;
    this.sourceRecordRef = sourceRecordRef;
    this.handle = handle;
  }

  // A run past its timeout keeps going, since nothing aborts it: its saves must land nowhere.
  abandon(): void {
    this.abandoned = true;
  }

  init(): Promise<void> {
    return Promise.resolve();
  }

  close(): Promise<void> {
    return Promise.resolve();
  }

  async getStepExecutions(runId: string): Promise<StepExecutionData[]> {
    const rows = await this.base.getStepExecutions(runId);

    return rows.flatMap(row => this.project(row));
  }

  async saveStepExecution(runId: string, stepExecution: StepExecutionData): Promise<void> {
    if (this.abandoned) return;
    if (stepExecution.stepIndex !== this.stepIndex) {
      await this.base.saveStepExecution(runId, stepExecution);

      return;
    }

    const iteration: Record<string, unknown> = { ...this.handle.get() };

    ITERATION_FIELDS.forEach(field => {
      const value = (stepExecution as unknown as Record<string, unknown>)[field];

      if (value === undefined) delete iteration[field];
      else iteration[field] = value;
    });

    await this.handle.set(iteration as unknown as StepIteration);
  }

  deleteStepExecution(runId: string, stepIndex: number): Promise<void> {
    return this.base.deleteStepExecution(runId, stepIndex);
  }

  private project(row: StepExecutionData): StepExecutionData[] {
    if (row.stepIndex === this.stepIndex) {
      const own = this.handle.get();

      return ITERATION_FIELDS.some(field => own[field] !== undefined) ? [asExecution(row, own)] : [];
    }

    if (isPerRecordExecution(row)) {
      const match = row.iterations.find(it => isSameRecord(it.sourceRecordRef, this.sourceRecordRef));

      return match ? [asExecution(row, match)] : [];
    }

    if (
      row.type === 'load-related-record' &&
      row.executionResult !== undefined &&
      'records' in row.executionResult
    ) {
      const record = row.executionResult.records.find(r => isSameRecord(r, this.sourceRecordRef));
      if (!record) return [row];

      return [{ ...row, executionResult: { relation: row.executionResult.relation, record } }];
    }

    return [row];
  }
}
