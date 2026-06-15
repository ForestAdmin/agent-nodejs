import type { StepExecutionData } from '../../src/types/step-execution-data';

import { RunStorePortError, StepStateError } from '../../src/errors';
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

  it('wraps unexpected errors in RunStorePortError', async () => {
    jest.spyOn((store as any).data, 'get').mockImplementation(() => {
      throw new Error('unexpected internal error');
    });

    await expect(store.getStepExecutions('run-1')).rejects.toBeInstanceOf(RunStorePortError);
  });

  it('re-throws WorkflowExecutorError directly without wrapping', async () => {
    const domainError = new StepStateError('bad state');
    jest.spyOn((store as any).data, 'get').mockImplementation(() => {
      throw domainError;
    });

    await expect(store.getStepExecutions('run-1')).rejects.toBe(domainError);
  });

  describe('claimStepExecution', () => {
    const seed = (phase: 'executing' | 'done' = 'executing') =>
      makeStepExecution({ stepIndex: 0, idempotencyPhase: phase } as never);

    it("returns 'won' and persists the executing marker when unclaimed", async () => {
      expect(await store.claimStepExecution('run-1', seed())).toBe('won');
      expect(await store.getStepExecutions('run-1')).toEqual([
        expect.objectContaining({ stepIndex: 0, idempotencyPhase: 'executing' }),
      ]);
    });

    it("returns 'executing' when the step is already claimed", async () => {
      await store.claimStepExecution('run-1', seed());

      expect(await store.claimStepExecution('run-1', seed())).toBe('executing');
    });

    it("returns 'done' when the step already completed", async () => {
      await store.saveStepExecution('run-1', seed('done'));

      expect(await store.claimStepExecution('run-1', seed())).toBe('done');
    });

    it('lets exactly one of many concurrent claims win', async () => {
      const outcomes = await Promise.all(
        Array.from({ length: 8 }, () => store.claimStepExecution('run-1', seed())),
      );

      expect(outcomes.filter(o => o === 'won')).toHaveLength(1);
      expect(outcomes.filter(o => o === 'executing')).toHaveLength(7);
    });
  });
});
