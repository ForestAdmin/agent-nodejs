import type { StepExecutionData } from '../../src/types/step-execution-data';

import { Sequelize } from 'sequelize';

import DatabaseStore from '../../src/stores/database-store';

function makeStepExecution(overrides: Partial<StepExecutionData> = {}): StepExecutionData {
  return {
    type: 'condition',
    stepIndex: 0,
    executionParams: { answer: 'yes' },
    ...overrides,
  } as StepExecutionData;
}

describe('DatabaseStore (SQLite)', () => {
  let sequelize: Sequelize;
  let store: DatabaseStore;

  beforeEach(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
    store = new DatabaseStore({ sequelize });
    await store.init();
  });

  afterEach(async () => {
    await store.close();
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
    expect(result[0]).toEqual(step0);
    expect(result[1]).toEqual(step1);
  });

  it('returns steps ordered by stepIndex', async () => {
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

  it('preserves complex nested JSON data', async () => {
    const step: StepExecutionData = {
      type: 'update-record',
      stepIndex: 0,
      executionParams: { displayName: 'Status', name: 'status', value: 'active' },
      executionResult: { updatedValues: { status: 'active', nested: { deep: true } } },
      pendingData: { displayName: 'Status', name: 'status', value: 'active' },
      selectedRecordRef: { collectionName: 'users', recordId: ['42'], stepIndex: 0 },
    };

    await store.saveStepExecution('run-1', step);

    const result = await store.getStepExecutions('run-1');
    expect(result[0]).toEqual(step);
  });

  it('runs init idempotently', async () => {
    // Running init a second time should not fail
    await expect(store.init()).resolves.toBeUndefined();
  });

  it('logs and rethrows when migration fails', async () => {
    const badSequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
    const badStore = new DatabaseStore({ sequelize: badSequelize });

    // Break the query interface so createTable fails
    jest
      .spyOn(badSequelize.getQueryInterface(), 'createTable')
      .mockRejectedValueOnce(new Error('disk full'));

    const logger = { info: jest.fn(), error: jest.fn() };
    await expect(badStore.init(logger)).rejects.toThrow('disk full');
    expect(logger.error).toHaveBeenCalledWith(
      'Database migration failed',
      expect.objectContaining({ error: 'disk full' }),
    );

    await badSequelize.close();
  });

  it('close() catches and logs errors instead of throwing', async () => {
    const logger = { info: jest.fn(), error: jest.fn() };
    jest.spyOn(sequelize, 'close').mockRejectedValueOnce(new Error('close failed'));

    await expect(store.close(logger)).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to close database connection',
      expect.objectContaining({ error: 'close failed' }),
    );
  });
});
