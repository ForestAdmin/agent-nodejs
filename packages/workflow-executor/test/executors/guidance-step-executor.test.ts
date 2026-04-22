import type { RunStore } from '../../src/ports/run-store';
import type { RecordRef } from '../../src/types/collection';
import type { ExecutionContext } from '../../src/types/execution';
import type { GuidanceStepDefinition } from '../../src/types/step-definition';
import type { GuidanceStepOutcome } from '../../src/types/step-outcome';

import GuidanceStepExecutor from '../../src/executors/guidance-step-executor';
import SchemaCache from '../../src/schema-cache';
import { StepType } from '../../src/types/step-definition';

function makeMockRunStore(overrides: Partial<RunStore> = {}): RunStore {
  return {
    init: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    getStepExecutions: jest.fn().mockResolvedValue([]),
    saveStepExecution: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeContext(
  overrides: Partial<ExecutionContext<GuidanceStepDefinition>> = {},
): ExecutionContext<GuidanceStepDefinition> {
  return {
    runId: 'run-1',
    stepId: 'guidance-1',
    stepIndex: 0,
    collectionId: 'col-1',
    baseRecordRef: {
      collectionName: 'customers',
      recordId: [1],
      stepIndex: 0,
    } as RecordRef,
    stepDefinition: { type: StepType.Guidance },
    model: {} as ExecutionContext['model'],
    agentPort: {} as ExecutionContext['agentPort'],
    workflowPort: {} as ExecutionContext['workflowPort'],
    runStore: makeMockRunStore(),
    user: {
      id: 1,
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      team: 'admin',
      renderingId: 1,
      role: 'admin',
      permissionLevel: 'admin',
      tags: {},
    },
    schemaCache: new SchemaCache(),
    previousSteps: [],
    logger: { info: jest.fn(), error: jest.fn() },

    activityLogPort: {
      createPending: jest.fn().mockResolvedValue({ id: 'log-1', index: '0' }),
      markSucceeded: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
    },
    ...overrides,
  };
}

describe('GuidanceStepExecutor', () => {
  it('saves executionResult and returns success when incomingPendingData has valid userInput', async () => {
    const runStore = makeMockRunStore();

    const executor = new GuidanceStepExecutor(
      makeContext({ runStore, incomingPendingData: { userInput: 'Please proceed with option A' } }),
    );
    const result = await executor.execute();

    const outcome = result.stepOutcome as GuidanceStepOutcome;
    expect(outcome.type).toBe('guidance');
    expect(outcome.status).toBe('success');
    expect(outcome.stepId).toBe('guidance-1');
    expect(outcome.stepIndex).toBe(0);

    expect(runStore.saveStepExecution).toHaveBeenCalledWith('run-1', {
      type: 'guidance',
      stepIndex: 0,
      executionResult: { userInput: 'Please proceed with option A' },
    });
  });

  it('returns error outcome when incomingPendingData is undefined', async () => {
    const runStore = makeMockRunStore();

    const executor = new GuidanceStepExecutor(makeContext({ runStore }));
    const result = await executor.execute();

    const outcome = result.stepOutcome as GuidanceStepOutcome;
    expect(outcome.type).toBe('guidance');
    expect(outcome.status).toBe('error');
    expect(outcome.error).toBe('An unexpected error occurred while processing this step.');
    expect(runStore.saveStepExecution).not.toHaveBeenCalled();
  });

  it('returns error outcome when incomingPendingData has empty userInput', async () => {
    const runStore = makeMockRunStore();

    const executor = new GuidanceStepExecutor(
      makeContext({ runStore, incomingPendingData: { userInput: '' } }),
    );
    const result = await executor.execute();

    const outcome = result.stepOutcome as GuidanceStepOutcome;
    expect(outcome.type).toBe('guidance');
    expect(outcome.status).toBe('error');
    expect(outcome.error).toBe('An unexpected error occurred while processing this step.');
    expect(runStore.saveStepExecution).not.toHaveBeenCalled();
  });

  it('returns error outcome when incomingPendingData has no userInput field', async () => {
    const runStore = makeMockRunStore();

    const executor = new GuidanceStepExecutor(makeContext({ runStore, incomingPendingData: {} }));
    const result = await executor.execute();

    const outcome = result.stepOutcome as GuidanceStepOutcome;
    expect(outcome.type).toBe('guidance');
    expect(outcome.status).toBe('error');
    expect(runStore.saveStepExecution).not.toHaveBeenCalled();
  });
});
