import type { RunStore } from '../../src/ports/run-store';
import type { StepExecutionData, StepIteration } from '../../src/types/step-execution-data';
import type { RecordRef } from '../../src/types/validated/collection';

import { StepStateError } from '../../src/errors';
import IterationRunStore from '../../src/executors/iteration-run-store';

const UBO: RecordRef = { collectionName: 'ubos', recordId: [1], stepIndex: 1 };

function setup(own: Partial<StepIteration> = {}) {
  const base: jest.Mocked<RunStore> = {
    init: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    getStepExecutions: jest.fn().mockResolvedValue([]),
    saveStepExecution: jest.fn().mockResolvedValue(undefined),
    deleteStepExecution: jest.fn().mockResolvedValue(undefined),
  };
  const iteration = { sourceRecordRef: UBO, attempt: 1, ...own } as StepIteration;
  const handle = { get: () => iteration, set: jest.fn().mockResolvedValue(undefined) };

  return { base, handle, store: new IterationRunStore(base, 3, UBO, handle) };
}

describe('IterationRunStore', () => {
  it("saves another step's execution to the run store as it is", async () => {
    const { base, handle, store } = setup();
    const other = {
      type: 'condition',
      stepIndex: 5,
      executionParams: {},
    } as unknown as StepExecutionData;

    await store.saveStepExecution('run-1', other);

    expect(base.saveStepExecution).toHaveBeenCalledWith('run-1', other);
    expect(handle.set).not.toHaveBeenCalled();
  });

  it('deletes through the run store', async () => {
    const { base, store } = setup();

    await store.deleteStepExecution('run-1', 5);

    expect(base.deleteStepExecution).toHaveBeenCalledWith('run-1', 5);
  });

  it('shows the rows of steps that ran once as they are', async () => {
    const { base, store } = setup();
    const condition = {
      type: 'condition',
      stepIndex: 2,
      executionParams: { answer: 'yes' },
      executionResult: { answer: 'yes' },
    } as unknown as StepExecutionData;
    base.getStepExecutions.mockResolvedValue([condition]);

    await expect(store.getStepExecutions('run-1')).resolves.toStrictEqual([condition]);
  });

  it('opens and closes nothing of its own: the run store outlives one record', async () => {
    const { base, store } = setup();

    await expect(store.init()).resolves.toBeUndefined();
    await expect(store.close()).resolves.toBeUndefined();
    expect(base.init).not.toHaveBeenCalled();
    expect(base.close).not.toHaveBeenCalled();
  });

  it("narrows an earlier per-record step's row to this record's iteration", async () => {
    const { base, store } = setup();
    const other: RecordRef = { collectionName: 'ubos', recordId: [2], stepIndex: 1 };
    base.getStepExecutions.mockResolvedValue([
      {
        type: 'read-record',
        stepIndex: 2,
        iterations: [
          { sourceRecordRef: other, attempt: 1, executionResult: { fields: [{ name: 'b' }] } },
          { sourceRecordRef: UBO, attempt: 1, executionResult: { fields: [{ name: 'a' }] } },
        ],
      },
    ] as unknown as StepExecutionData[]);

    await expect(store.getStepExecutions('run-1')).resolves.toStrictEqual([
      { type: 'read-record', stepIndex: 2, executionResult: { fields: [{ name: 'a' }] } },
    ]);
  });

  it('shows nothing of an earlier per-record step that has no iteration for this record', async () => {
    const { base, store } = setup();
    const other: RecordRef = { collectionName: 'ubos', recordId: [2], stepIndex: 1 };
    base.getStepExecutions.mockResolvedValue([
      { type: 'read-record', stepIndex: 2, iterations: [{ sourceRecordRef: other, attempt: 1 }] },
    ] as unknown as StepExecutionData[]);

    await expect(store.getStepExecutions('run-1')).resolves.toStrictEqual([]);
  });

  it('narrows a Multiple load to this record', async () => {
    const { base, store } = setup();
    const other: RecordRef = { collectionName: 'ubos', recordId: [2], stepIndex: 1 };
    base.getStepExecutions.mockResolvedValue([
      {
        type: 'load-related-record',
        stepIndex: 1,
        executionResult: { relation: { name: 'ubos' }, records: [other, UBO] },
      },
    ] as unknown as StepExecutionData[]);

    await expect(store.getStepExecutions('run-1')).resolves.toStrictEqual([
      {
        type: 'load-related-record',
        stepIndex: 1,
        executionResult: { relation: { name: 'ubos' }, record: UBO },
      },
    ]);
  });

  it('shows nothing of a Multiple load that did not load this record', async () => {
    const { base, store } = setup();
    const other: RecordRef = { collectionName: 'ubos', recordId: [2], stepIndex: 1 };
    base.getStepExecutions.mockResolvedValue([
      {
        type: 'load-related-record',
        stepIndex: 1,
        executionResult: { relation: { name: 'ubos' }, records: [other] },
      },
    ] as unknown as StepExecutionData[]);

    await expect(store.getStepExecutions('run-1')).resolves.toStrictEqual([]);
  });

  it('removes from the iteration a field the save sets to undefined', async () => {
    const { handle, store } = setup({
      pendingData: { value: 1 },
      executionParams: { a: 1 },
    } as unknown as Partial<StepIteration>);

    await store.saveStepExecution('run-1', {
      type: 'update-record',
      stepIndex: 3,
      executionParams: { a: 2 },
      pendingData: undefined,
    } as unknown as StepExecutionData);

    expect(handle.set).toHaveBeenCalledWith({
      sourceRecordRef: UBO,
      attempt: 1,
      executionParams: { a: 2 },
    });
  });

  it('refuses every save once abandoned, writing nothing', async () => {
    const { base, handle, store } = setup();
    store.abandon();

    await expect(
      store.saveStepExecution('run-1', {
        type: 'update-record',
        stepIndex: 3,
        idempotencyPhase: 'executing',
      } as unknown as StepExecutionData),
    ).rejects.toThrow(StepStateError);
    expect(handle.set).not.toHaveBeenCalled();
    expect(base.saveStepExecution).not.toHaveBeenCalled();
  });
});
