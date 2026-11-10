import type { StepContextConfig } from '../../src/executors/step-executor-factory';
import type { ActivityLogPort } from '../../src/ports/activity-log-port';
import type { AvailableStepExecution } from '../../src/types/execution-context';

import { OAuthReauthRequiredError } from '../../src/errors';
import GuidanceStepExecutor from '../../src/executors/guidance-step-executor';
import McpStepExecutor from '../../src/executors/mcp-step-executor';
import PerRecordStepExecutor from '../../src/executors/per-record-step-executor';
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

  describe('after a Multiple step', () => {
    const loadStores = {
      stepDefinition: {
        type: StepType.LoadRelatedRecord,
        executionType: StepExecutionMode.Manual,
        preRecordedArgs: {
          selectedRecordStepId: WORKFLOW_START_STEP_ID,
          relationName: 'stores',
          multiple: true,
        },
      },
      stepOutcome: { type: 'record', stepId: 'load-stores', stepIndex: 0, status: 'success' },
    };

    const create = (stepDefinition: unknown) =>
      StepExecutorFactory.create(
        makeStep({
          stepIndex: 1,
          stepDefinition,
          previousSteps: [loadStores],
        } as unknown as Partial<AvailableStepExecution>),
        makeContextConfig(),
        activityLogPort,
        jest.fn().mockResolvedValue({ tools: [], mcpServerName: 'srv' }),
      );

    it('runs a step sourced from it once per record', async () => {
      const executor = await create({
        type: StepType.ReadRecord,
        executionType: StepExecutionMode.FullyAutomated,
        preRecordedArgs: { selectedRecordStepId: 'load-stores', fieldNames: ['name'] },
      });

      expect(executor).toBeInstanceOf(PerRecordStepExecutor);
    });

    const loadOwner = (selectedRecordStepId: string, stepIndex = 1) => ({
      stepDefinition: {
        type: StepType.LoadRelatedRecord,
        executionType: StepExecutionMode.Manual,
        preRecordedArgs: { selectedRecordStepId, relationName: 'owner' },
      },
      stepOutcome: { type: 'record', stepId: 'load-owner', stepIndex, status: 'success' },
    });
    const readFrom = (selectedRecordStepId: string) => ({
      type: StepType.ReadRecord,
      executionType: StepExecutionMode.FullyAutomated,
      preRecordedArgs: { selectedRecordStepId, fieldNames: ['name'] },
    });
    const createWith = (previousSteps: unknown[], callScope?: unknown) =>
      StepExecutorFactory.create(
        makeStep({
          stepIndex: 2,
          stepDefinition: readFrom('load-owner'),
          previousSteps,
          callScope,
        } as unknown as Partial<AvailableStepExecution>),
        makeContextConfig(),
        activityLogPort,
        jest.fn(),
      );

    it('reads a chained step once per record of the Multiple step at the root of its chain', async () => {
      const owner = loadOwner('load-stores');
      const executor = await createWith([loadStores, owner]);

      expect(executor).toBeInstanceOf(PerRecordStepExecutor);
      expect((executor as unknown as { source: unknown }).source).toStrictEqual({
        root: loadStores,
        direct: owner,
      });
    });

    it('runs a step pinned to a load that is not Multiple once', async () => {
      const executor = await createWith([loadOwner(WORKFLOW_START_STEP_ID, 0)]);

      expect(executor).not.toBeInstanceOf(PerRecordStepExecutor);
    });

    it('runs a step once when the Multiple step sits outside its sub-workflow frame', async () => {
      const executor = await createWith([loadStores, loadOwner('load-stores')], {
        currentFrameStepIndexes: [1],
      });

      expect(executor).not.toBeInstanceOf(PerRecordStepExecutor);
    });

    it('runs an MCP step once', async () => {
      const executor = await create({
        type: StepType.Mcp,
        executionType: StepExecutionMode.FullyAutomated,
        mcpServerId: 'srv-1',
      });

      expect(executor).toBeInstanceOf(McpStepExecutor);
    });

    it('runs a Guidance step once', async () => {
      const executor = await create({
        type: StepType.Guidance,
        executionType: StepExecutionMode.Manual,
      });

      expect(executor).toBeInstanceOf(GuidanceStepExecutor);
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
