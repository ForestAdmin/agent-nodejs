import type { ActivityLogPort } from '../../src/ports/activity-log-port';
import type { AgentPort } from '../../src/ports/agent-port';
import type { RunStore } from '../../src/ports/run-store';
import type { WorkflowPort } from '../../src/ports/workflow-port';
import type { ExecutionContext } from '../../src/types/execution-context';
import type { RecordRef } from '../../src/types/validated/collection';
import type { GuidanceStepDefinition } from '../../src/types/validated/step-definition';
import type { GuidanceStepOutcome } from '../../src/types/validated/step-outcome';

import ActivityLog from '../../src/executors/activity-log';
import AgentWithLog from '../../src/executors/agent-with-log';
import GuidanceStepExecutor from '../../src/executors/guidance-step-executor';
import SchemaCache from '../../src/schema-cache';
import SchemaResolver from '../../src/schema-resolver';
import { StepExecutionMode, StepType } from '../../src/types/validated/step-definition';

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
  overrides: Partial<ExecutionContext<GuidanceStepDefinition>> & {
    agentPort?: AgentPort;
    activityLogPort?: ActivityLogPort;
    activityLog?: ActivityLog;
    workflowPort?: WorkflowPort;
  } = {},
): ExecutionContext<GuidanceStepDefinition> {
  const runId = overrides.runId ?? 'run-1';
  const workflowPort = overrides.workflowPort ?? ({} as WorkflowPort);
  const schemaCache = new SchemaCache();

  const base: Omit<ExecutionContext<GuidanceStepDefinition>, 'agent' | 'activityLog'> = {
    runId,
    stepId: 'guidance-1',
    stepIndex: 0,
    collectionId: 'col-1',
    baseRecordRef: {
      collectionName: 'customers',
      recordId: [1],
      stepIndex: 0,
    } as RecordRef,
    stepDefinition: { type: StepType.Guidance, executionType: StepExecutionMode.Manual },
    model: {} as ExecutionContext['model'],
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
    schemaResolver: new SchemaResolver(schemaCache, workflowPort, runId),
    previousSteps: [],
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    ...overrides,
  };

  const activityLog =
    overrides.activityLog ??
    new ActivityLog(
      overrides.activityLogPort ?? {
        createPending: jest.fn().mockResolvedValue({ id: 'log-1', index: '0' }),
        markSucceeded: jest.fn().mockResolvedValue(undefined),
        markFailed: jest.fn().mockResolvedValue(undefined),
      },
      base.user,
    );

  return {
    ...base,
    activityLog,
    agent:
      overrides.agent ??
      new AgentWithLog({
        agentPort: overrides.agentPort ?? ({} as AgentPort),
        schemaResolver: base.schemaResolver,
        user: base.user,
        activityLog,
      }),
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

  it('returns awaiting-input when incomingPendingData is absent', async () => {
    const runStore = makeMockRunStore();

    const executor = new GuidanceStepExecutor(makeContext({ runStore }));
    const result = await executor.execute();

    const outcome = result.stepOutcome as GuidanceStepOutcome;
    expect(outcome.type).toBe('guidance');
    expect(outcome.status).toBe('awaiting-input');
    expect(runStore.saveStepExecution).not.toHaveBeenCalled();
  });

  it('saves empty string and returns success when userInput is empty', async () => {
    const runStore = makeMockRunStore();

    const executor = new GuidanceStepExecutor(
      makeContext({ runStore, incomingPendingData: { userInput: '' } }),
    );
    const result = await executor.execute();

    const outcome = result.stepOutcome as GuidanceStepOutcome;
    expect(outcome.type).toBe('guidance');
    expect(outcome.status).toBe('success');
    expect(runStore.saveStepExecution).toHaveBeenCalledWith('run-1', {
      type: 'guidance',
      stepIndex: 0,
      executionResult: { userInput: '' },
    });
  });

  it('saves empty string and returns success when userInput is absent', async () => {
    const runStore = makeMockRunStore();

    const executor = new GuidanceStepExecutor(makeContext({ runStore, incomingPendingData: {} }));
    const result = await executor.execute();

    const outcome = result.stepOutcome as GuidanceStepOutcome;
    expect(outcome.type).toBe('guidance');
    expect(outcome.status).toBe('success');
    expect(runStore.saveStepExecution).toHaveBeenCalledWith('run-1', {
      type: 'guidance',
      stepIndex: 0,
      executionResult: { userInput: '' },
    });
  });
});
