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

  // The AI's candidates show what the step sees of the calling workflow's Multiple step.
  it("narrows the calling workflow's records to the call's record inside a call opened once per record", async () => {
    const ubo = (id: number) => ({ collectionName: 'ubos', recordId: [id], stepIndex: 1 });
    const invoke = jest
      .fn()
      .mockResolvedValueOnce({
        tool_calls: [
          { name: 'select-record', args: { recordIdentifier: 'Step 1 - UBOs #2' }, id: 'c1' },
        ],
      })
      .mockResolvedValueOnce({
        tool_calls: [
          { name: 'read-selected-record-fields', args: { fieldNames: ['Share'] }, id: 'c2' },
        ],
      });
    const bindTools = jest.fn().mockReturnValue({ invoke });
    const schema = (collectionName: string, displayName: string) => ({
      collectionName,
      collectionId: `col-${collectionName}`,
      collectionDisplayName: displayName,
      primaryKeyFields: ['id'],
      fields: [{ fieldName: 'share', displayName: 'Share', isRelationship: false }],
      actions: [],
    });
    const config = {
      ...makeContextConfig(),
      aiModelPort: { getModel: jest.fn().mockReturnValue({ bindTools }) },
      agentPort: { getRecord: jest.fn().mockResolvedValue({ values: { share: 30 } }) },
      workflowPort: {
        getCollectionSchema: jest
          .fn()
          .mockImplementation((name: string) =>
            Promise.resolve(name === 'ubos' ? schema('ubos', 'UBOs') : schema(name, 'Customers')),
          ),
      },
      runStore: {
        getStepExecutions: jest.fn().mockResolvedValue([
          {
            type: 'load-related-record',
            stepIndex: 1,
            executionResult: {
              relation: { name: 'ubos', displayName: 'UBOs' },
              records: [ubo(1), ubo(2), ubo(3)],
            },
            selectedRecordRef: { collectionName: 'customers', recordId: [1], stepIndex: 0 },
          },
        ]),
        saveStepExecution: jest.fn().mockResolvedValue(undefined),
      },
    } as unknown as StepContextConfig;
    const step = makeStep({
      stepIndex: 3,
      stepDefinition: {
        type: StepType.ReadRecord,
        executionType: StepExecutionMode.FullyAutomated,
        prompt: "Read the UBO's share",
      },
      previousSteps: [
        {
          stepDefinition: {
            type: StepType.LoadRelatedRecord,
            executionType: StepExecutionMode.FullyAutomated,
            preRecordedArgs: { multiple: true },
          },
          stepOutcome: { type: 'record', stepId: 'load-ubos', stepIndex: 1, status: 'success' },
        },
      ],
      callScope: {
        currentFrameStepIndexes: [],
        recordCall: {
          selectedRecordStepId: 'load-ubos',
          pinnedFrameStepIndexes: [1],
          recordIndex: 1,
          startStepIndex: 2,
        },
      },
    } as unknown as Partial<AvailableStepExecution>);

    const executor = await StepExecutorFactory.create(step, config, activityLogPort, jest.fn());
    await executor.execute();

    expect(bindTools.mock.calls[0][0][0].schema.shape.recordIdentifier.options).toEqual([
      'Step 0 - Customers #1',
      'Step 1 - UBOs #2',
    ]);
  });

  // Run unnarrowed, an AI-picked step could act on any record the calling workflow loaded.
  it('fails a step at the call site when its per-record call has no record to run on', async () => {
    const step = makeStep({
      stepIndex: 3,
      stepDefinition: {
        type: StepType.UpdateRecord,
        executionType: StepExecutionMode.FullyAutomated,
        prompt: "Update the UBO's share",
      },
      previousSteps: [
        {
          stepDefinition: {
            type: StepType.LoadRelatedRecord,
            executionType: StepExecutionMode.FullyAutomated,
            title: 'Load UBOs',
            preRecordedArgs: { multiple: true },
          },
          stepOutcome: { type: 'record', stepId: 'load-ubos', stepIndex: 1, status: 'success' },
        },
      ],
      callScope: {
        currentFrameStepIndexes: [],
        recordCall: {
          selectedRecordStepId: 'load-ubos',
          pinnedFrameStepIndexes: [1],
          recordIndex: 5,
          startStepIndex: 2,
        },
      },
    } as unknown as Partial<AvailableStepExecution>);
    const config = {
      ...makeContextConfig(),
      runStore: {
        getStepExecutions: jest.fn().mockResolvedValue([
          {
            type: 'load-related-record',
            stepIndex: 1,
            executionResult: {
              relation: { name: 'ubos', displayName: 'UBOs' },
              records: [{ collectionName: 'ubos', recordId: [1], stepIndex: 1 }],
            },
          },
        ]),
      },
    } as unknown as StepContextConfig;

    const executor = await StepExecutorFactory.create(step, config, activityLogPort, jest.fn());
    const result = await executor.execute();

    expect(result.stepOutcome).toEqual({
      type: 'record',
      stepId: 'step-1',
      stepIndex: 3,
      status: 'error',
      errorKind: 'call-site',
      error:
        'The Sub-workflow step that called this workflow runs once for each record of "Load UBOs", ' +
        'but this run\'s record is not among the records it loaded. Revise "Load UBOs" to load them again.',
    });
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
