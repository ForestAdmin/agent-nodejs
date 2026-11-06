import type ActivityLog from '../../src/executors/activity-log';
import type { StepContextConfig } from '../../src/executors/step-executor-factory';
import type { ActivityLogPort } from '../../src/ports/activity-log-port';
import type { AvailableStepExecution } from '../../src/types/execution-context';

import { OAuthReauthRequiredError } from '../../src/errors';
import StepExecutorFactory from '../../src/executors/step-executor-factory';
import SchemaCache from '../../src/schema-cache';
import {
  StepExecutionMode,
  StepType,
  WORKFLOW_START_STEP_ID,
} from '../../src/types/validated/step-definition';

const activityLogPort = {
  createPending: jest.fn().mockResolvedValue({ id: 'log-1', index: '0' }),
  markSucceeded: jest.fn().mockResolvedValue(undefined),
  markFailed: jest.fn().mockResolvedValue(undefined),
} as unknown as ActivityLogPort;

function makeStep(overrides: Partial<AvailableStepExecution> = {}): AvailableStepExecution {
  return {
    runId: 'run-1',
    stepId: 'step-1',
    stepIndex: 0,
    collectionId: 'col-1',
    baseRecordRef: { collectionName: 'customers', recordId: [1], stepIndex: 0 },
    stepDefinition: {
      type: StepType.Mcp,
      executionType: StepExecutionMode.FullyAutomated,
      mcpServerId: 'srv-1',
    },
    previousSteps: [],
    user: {
      id: 7,
      email: 'a@b.com',
      firstName: 'A',
      lastName: 'B',
      team: 't',
      renderingId: 1,
      role: 'admin',
      permissionLevel: 'admin',
      tags: {},
    },
    timezone: 'UTC',
    ...overrides,
  } as unknown as AvailableStepExecution;
}

function makeContextConfig(): StepContextConfig {
  return {
    aiModelPort: { getModel: jest.fn().mockReturnValue({}) },
    agentPort: {},
    workflowPort: {},
    runStore: {},
    schemaCache: new SchemaCache(),
    logger: jest.fn(),
  } as unknown as StepContextConfig;
}

describe('StepExecutorFactory.create', () => {
  it('maps OAuthReauthRequiredError from tool loading to an awaiting-input outcome with the typed reason', async () => {
    const fetchRemoteTools = jest.fn().mockRejectedValue(new OAuthReauthRequiredError('srv-1'));

    const executor = await StepExecutorFactory.create(
      makeStep(),
      makeContextConfig(),
      activityLogPort,
      fetchRemoteTools,
    );
    const result = await executor.execute();

    expect(result.stepOutcome).toEqual({
      type: 'mcp',
      stepId: 'step-1',
      stepIndex: 0,
      status: 'awaiting-input',
      awaitingInputReason: 'needs-oauth-reauth',
    });
  });

  it('maps a generic tool-loading failure to an error outcome (no awaitingInputReason)', async () => {
    const fetchRemoteTools = jest.fn().mockRejectedValue(new Error('kaboom'));

    const executor = await StepExecutorFactory.create(
      makeStep(),
      makeContextConfig(),
      activityLogPort,
      fetchRemoteTools,
    );
    const result = await executor.execute();

    expect(result.stepOutcome.status).toBe('error');
    expect(result.stepOutcome).not.toHaveProperty('awaitingInputReason');
  });

  // The only seam between the mapper that builds the call scope and the executor that reads it: a
  // pin the executor can see is one it resolves, and here it names a step the run never took.
  it('hands the sub-workflow call scope to the executor it builds', async () => {
    const step = makeStep({
      stepDefinition: {
        type: StepType.ReadRecord,
        executionType: StepExecutionMode.FullyAutomated,
        preRecordedArgs: { selectedRecordStepId: WORKFLOW_START_STEP_ID, fieldNames: ['email'] },
      },
      callScope: { selectedRecordStepId: 'load-1', calledWorkflowCollectionName: 'orders' },
    } as unknown as Partial<AvailableStepExecution>);

    const executor = await StepExecutorFactory.create(
      step,
      makeContextConfig(),
      activityLogPort,
      jest.fn(),
    );
    const result = await executor.execute();

    expect(result.stepOutcome.status).toBe('error');
    expect(result.stepOutcome.error).toBe(
      'The Sub-workflow step that called this workflow takes its record from a step that did not run before it. Change the record on that Sub-workflow step.',
    );
  });

  describe("the run's workflow on the step's activity logs", () => {
    const TARGET = { action: 'index', type: 'read', collectionId: 'col-1' } as const;

    async function trackThroughBuiltContext(step: AvailableStepExecution) {
      const port = {
        createPending: jest.fn().mockResolvedValue({ id: 'log-1', index: '0' }),
        markSucceeded: jest.fn().mockResolvedValue(undefined),
        markFailed: jest.fn().mockResolvedValue(undefined),
      };
      const executor = await StepExecutorFactory.create(
        step,
        makeContextConfig(),
        port,
        jest.fn().mockResolvedValue({ tools: [], mcpServerName: 'srv' }),
      );
      const { activityLog } = (executor as unknown as { context: { activityLog: ActivityLog } })
        .context;
      await activityLog.track(TARGET, { operation: async () => undefined });

      return port.createPending.mock.calls[0][0];
    }

    it('carries the run id, the workflow name and the step title', async () => {
      const args = await trackThroughBuiltContext(
        makeStep({
          workflowName: 'Alert triage',
          stepDefinition: {
            type: StepType.Mcp,
            executionType: StepExecutionMode.FullyAutomated,
            mcpServerId: 'srv-1',
            title: 'Freeze the account',
          },
        } as unknown as Partial<AvailableStepExecution>),
      );

      expect(args).toEqual({
        renderingId: 1,
        ...TARGET,
        workflow: { runId: 'run-1', name: 'Alert triage', stepName: 'Freeze the account' },
      });
    });

    it.each([
      ['no title', undefined],
      ['an empty title', ''],
    ])('names a step with %s by its step id', async (_label, title) => {
      const args = await trackThroughBuiltContext(
        makeStep({
          workflowName: 'Alert triage',
          stepDefinition: {
            type: StepType.Mcp,
            executionType: StepExecutionMode.FullyAutomated,
            mcpServerId: 'srv-1',
            title,
          },
        } as unknown as Partial<AvailableStepExecution>),
      );

      expect(args).toEqual({
        renderingId: 1,
        ...TARGET,
        workflow: { runId: 'run-1', name: 'Alert triage', stepName: 'step-1' },
      });
    });

    it('carries no workflow when the run has no workflow name', async () => {
      const args = await trackThroughBuiltContext(makeStep());

      // toStrictEqual, not toEqual: only it tells a missing key from an undefined one.
      expect(args).toStrictEqual({ renderingId: 1, ...TARGET });
    });
  });

  it('passes the step user id to the tool fetcher', async () => {
    const fetchRemoteTools = jest.fn().mockResolvedValue({ tools: [], mcpServerName: 'srv' });

    await StepExecutorFactory.create(
      makeStep(),
      makeContextConfig(),
      activityLogPort,
      fetchRemoteTools,
    );

    expect(fetchRemoteTools).toHaveBeenCalledWith('srv-1', 7);
  });
});
