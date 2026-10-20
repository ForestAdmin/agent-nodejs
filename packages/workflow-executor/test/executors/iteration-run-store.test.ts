import type { RunStore } from '../../src/ports/run-store';
import type { StepExecutionData, StepIteration } from '../../src/types/step-execution-data';
import type { RecordRef } from '../../src/types/validated/collection';

import IterationRunStore from '../../src/executors/iteration-run-store';

const UBO: RecordRef = { collectionName: 'ubos', recordId: [1], stepIndex: 1 };

function setup() {
  const base: jest.Mocked<RunStore> = {
    init: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    getStepExecutions: jest.fn().mockResolvedValue([]),
    saveStepExecution: jest.fn().mockResolvedValue(undefined),
    deleteStepExecution: jest.fn().mockResolvedValue(undefined),
  };
  const iteration: StepIteration = { sourceRecordRef: UBO, attempt: 1 };
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
});
