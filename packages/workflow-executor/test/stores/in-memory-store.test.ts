import type { StepExecutionData } from '../../src/types/step-execution-data';

import InMemoryStore from '../../src/stores/in-memory-store';

function makeStepExecution(overrides: Partial<StepExecutionData> = {}): StepExecutionData {
  return {
    type: 'condition',
    stepIndex: 0,
    executionParams: { answer: 'yes' },
    ...overrides,
  } as StepExecutionData;
}

describe('InMemoryStore', () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
  });

  it('returns empty array for unknown runId', async () => {
    const result = await store.getStepExecutions('unknown');
    expect(result).toEqual([]);
  });

  it('saves and retrieves a step execution', async () => {
    const step = makeStepExecution({ stepIndex: 0 });
    await store.saveStepExecution('run-1', step);

    const result = await store.getStepExecutions('run-1');
    expect(result).toEqual([step]);
  });

  it('saves multiple steps for the same run', async () => {
    const step0 = makeStepExecution({ stepIndex: 0 });
    const step1 = makeStepExecution({ stepIndex: 1, type: 'read-record' } as never);

    await store.saveStepExecution('run-1', step0);
    await store.saveStepExecution('run-1', step1);

    const result = await store.getStepExecutions('run-1');
    expect(result).toHaveLength(2);
    expect(result).toContainEqual(step0);
    expect(result).toContainEqual(step1);
  });

  it('returns steps ordered by stepIndex even when inserted out of order', async () => {
    await store.saveStepExecution('run-1', makeStepExecution({ stepIndex: 2 }));
    await store.saveStepExecution('run-1', makeStepExecution({ stepIndex: 0 }));
    await store.saveStepExecution('run-1', makeStepExecution({ stepIndex: 1 }));

    const result = await store.getStepExecutions('run-1');
    expect(result.map(s => s.stepIndex)).toEqual([0, 1, 2]);
  });

  it('overwrites step execution with the same stepIndex (upsert)', async () => {
    const original = makeStepExecution({ stepIndex: 0 });
    const updated = makeStepExecution({
      stepIndex: 0,
      executionParams: { answer: 'no' },
    } as never);

    await store.saveStepExecution('run-1', original);
    await store.saveStepExecution('run-1', updated);

    const result = await store.getStepExecutions('run-1');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(updated);
  });

  it('isolates data between different runIds', async () => {
    const step1 = makeStepExecution({ stepIndex: 0 });
    const step2 = makeStepExecution({ stepIndex: 0, type: 'read-record' } as never);

    await store.saveStepExecution('run-1', step1);
    await store.saveStepExecution('run-2', step2);

    expect(await store.getStepExecutions('run-1')).toEqual([step1]);
    expect(await store.getStepExecutions('run-2')).toEqual([step2]);
  });
});
