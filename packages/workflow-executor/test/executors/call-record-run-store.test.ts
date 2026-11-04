import type { RunStore } from '../../src/ports/run-store';
import type { StepExecutionData } from '../../src/types/step-execution-data';
import type { RecordRef } from '../../src/types/validated/collection';

import CallRecordRunStore from '../../src/executors/call-record-run-store';

const ubo = (id: number): RecordRef => ({ collectionName: 'ubos', recordId: [id], stepIndex: 1 });
const address = (id: number): RecordRef => ({
  collectionName: 'addresses',
  recordId: [id],
  stepIndex: 2,
});

const multipleRow = {
  type: 'load-related-record',
  stepIndex: 1,
  executionParams: { name: 'ubos', displayName: 'UBOs' },
  executionResult: { relation: { name: 'ubos', displayName: 'UBOs' }, records: [ubo(1), ubo(2)] },
  selectedRecordRef: { collectionName: 'companies', recordId: [7], stepIndex: 0 },
} as unknown as StepExecutionData;

const perRecordRow = {
  type: 'load-related-record',
  stepIndex: 2,
  iterations: [1, 2].map(id => ({
    sourceRecordRef: ubo(id),
    attempt: 1,
    selectedRecordRef: ubo(id),
    executionResult: {
      relation: { name: 'address', displayName: 'Address' },
      record: address(id * 10),
    },
  })),
} as unknown as StepExecutionData;

function makeBaseStore(rows: StepExecutionData[]): RunStore {
  return {
    init: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    getStepExecutions: jest.fn().mockResolvedValue(rows),
    saveStepExecution: jest.fn().mockResolvedValue(undefined),
    deleteStepExecution: jest.fn().mockResolvedValue(undefined),
  };
}

describe('CallRecordRunStore', () => {
  it("reads the calling workflow's Multiple step as having loaded the call's record alone", async () => {
    const store = new CallRecordRunStore(makeBaseStore([multipleRow]), ubo(2), []);

    expect(await store.getStepExecutions('run-1')).toEqual([
      {
        ...multipleRow,
        executionResult: { relation: { name: 'ubos', displayName: 'UBOs' }, record: ubo(2) },
      },
    ]);
  });

  it("reads a calling workflow's step that ran once per record as the call's record's iteration", async () => {
    const store = new CallRecordRunStore(makeBaseStore([perRecordRow]), ubo(2), []);

    expect(await store.getStepExecutions('run-1')).toEqual([
      {
        type: 'load-related-record',
        stepIndex: 2,
        selectedRecordRef: ubo(2),
        executionResult: {
          relation: { name: 'address', displayName: 'Address' },
          record: address(20),
        },
      },
    ]);
  });

  it("leaves out a step that ran once per record but never for the call's record", async () => {
    const store = new CallRecordRunStore(makeBaseStore([perRecordRow]), ubo(3), []);

    expect(await store.getStepExecutions('run-1')).toEqual([]);
  });

  // A called workflow can load several records of its own, a second level of records.
  it("reads the call's own steps as they are, a Multiple step of its own included", async () => {
    const ownMultiple = { ...multipleRow, stepIndex: 5 } as StepExecutionData;
    const store = new CallRecordRunStore(makeBaseStore([ownMultiple]), ubo(2), [5]);

    expect(await store.getStepExecutions('run-1')).toEqual([ownMultiple]);
  });

  it('saves and deletes through the run store it wraps', async () => {
    const base = makeBaseStore([]);
    const store = new CallRecordRunStore(base, ubo(2), []);

    await store.saveStepExecution('run-1', multipleRow);
    await store.deleteStepExecution('run-1', 1);

    expect(base.saveStepExecution).toHaveBeenCalledWith('run-1', multipleRow);
    expect(base.deleteStepExecution).toHaveBeenCalledWith('run-1', 1);
  });
});
