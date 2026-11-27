import type { StepContextConfig } from '../../src/executors/step-executor-factory';
import type { RunStore } from '../../src/ports/run-store';
import type { AvailableStepExecution } from '../../src/types/execution-context';
import type { ActivityLogConfig } from '@forestadmin/agent-client';

import { drainActivityLogs, withActivityLog } from '@forestadmin/agent-client';
import { ActivityLogsService } from '@forestadmin/forestadmin-client';

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

jest.mock('@forestadmin/forestadmin-client', () => ({
  ...jest.requireActual('@forestadmin/forestadmin-client'),
  ActivityLogsService: jest.fn(),
}));

const FOREST_SERVER_URL = 'https://api.forestadmin.com';

function fakeActivityLogsService() {
  const service = {
    createActivityLog: jest.fn().mockResolvedValue({ id: 'log-1', attributes: { index: '0' } }),
    createMcpActivityLog: jest.fn(),
    updateActivityLogStatus: jest.fn().mockResolvedValue(undefined),
  };
  (ActivityLogsService as jest.Mock).mockImplementation(() => service);

  return service;
}

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
    runStore: { getStepExecutions: jest.fn().mockResolvedValue([]) },
    schemaCache: new SchemaCache(),
    logger: jest.fn(),
    forestServerUrl: FOREST_SERVER_URL,
  } as unknown as StepContextConfig;
}

describe('StepExecutorFactory.create', () => {
  afterEach(async () => {
    await drainActivityLogs();
  });

  it('maps OAuthReauthRequiredError from tool loading to an awaiting-input outcome with the typed reason', async () => {
    const fetchRemoteTools = jest.fn().mockRejectedValue(new OAuthReauthRequiredError('srv-1'));

    const executor = await StepExecutorFactory.create(
      makeStep(),
      makeContextConfig(),
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

    const executor = await StepExecutorFactory.create(step, makeContextConfig(), jest.fn());
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
        recordCalls: [
          {
            selectedRecordStepId: 'load-ubos',
            pinnedFrameStepIndexes: [1],
            recordIndex: 1,
            startStepIndex: 2,
          },
        ],
      },
    } as unknown as Partial<AvailableStepExecution>);

    const executor = await StepExecutorFactory.create(step, config, jest.fn());
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
        recordCalls: [
          {
            selectedRecordStepId: 'load-ubos',
            pinnedFrameStepIndexes: [1],
            recordIndex: 5,
            startStepIndex: 2,
          },
        ],
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

    const executor = await StepExecutorFactory.create(step, config, jest.fn());
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

  it('fails a step at the call site when its per-record call pins a step the run never took', async () => {
    const step = makeStep({
      stepIndex: 3,
      stepDefinition: {
        type: StepType.ReadRecord,
        executionType: StepExecutionMode.FullyAutomated,
        prompt: "Read the UBO's share",
      },
      callScope: {
        currentFrameStepIndexes: [],
        recordCalls: [
          {
            selectedRecordStepId: 'load-ubos',
            pinnedFrameStepIndexes: [],
            recordIndex: 0,
            startStepIndex: 2,
          },
        ],
      },
    } as unknown as Partial<AvailableStepExecution>);
    const config = {
      ...makeContextConfig(),
      runStore: { getStepExecutions: jest.fn().mockResolvedValue([]) },
    } as unknown as StepContextConfig;

    const executor = await StepExecutorFactory.create(step, config, jest.fn());
    const result = await executor.execute();

    expect(result.stepOutcome).toMatchObject({
      status: 'error',
      errorKind: 'call-site',
      error:
        'The Sub-workflow step that called this workflow takes its record from a step that did not run before it. Change the record on that Sub-workflow step.',
    });
  });

  describe('a per-record call whose Multiple step has no record at its index', () => {
    const loadUbos = {
      stepDefinition: {
        type: StepType.LoadRelatedRecord,
        executionType: StepExecutionMode.FullyAutomated,
        title: 'Load UBOs',
        preRecordedArgs: { multiple: true },
      },
      stepOutcome: { type: 'record', stepId: 'load-ubos', stepIndex: 1, status: 'success' },
    };

    const run = async (execution: unknown) => {
      const step = makeStep({
        stepIndex: 3,
        stepDefinition: {
          type: StepType.ReadRecord,
          executionType: StepExecutionMode.FullyAutomated,
          prompt: "Read the UBO's share",
        },
        previousSteps: [loadUbos],
        callScope: {
          currentFrameStepIndexes: [],
          recordCalls: [
            {
              selectedRecordStepId: 'load-ubos',
              pinnedFrameStepIndexes: [1],
              recordIndex: 0,
              startStepIndex: 2,
            },
          ],
        },
      } as unknown as Partial<AvailableStepExecution>);
      const config = {
        ...makeContextConfig(),
        runStore: { getStepExecutions: jest.fn().mockResolvedValue([execution]) },
      } as unknown as StepContextConfig;

      return (await StepExecutorFactory.create(step, config, jest.fn())).execute();
    };

    it('names the empty Multiple step when it loaded nothing, and points at it', async () => {
      const result = await run({
        type: 'load-related-record',
        stepIndex: 1,
        executionResult: { skipped: true },
      });

      expect(result.stepOutcome).toMatchObject({
        status: 'error',
        errorKind: 'empty-source',
        errorSourceStepIndex: 1,
        error: 'This step uses "Load UBOs" as its source, but that step didn\'t load any record.',
      });
    });

    it('refuses a pinned step that ran once per record', async () => {
      const result = await run({
        type: 'load-related-record',
        stepIndex: 1,
        iterations: [
          { sourceRecordRef: { collectionName: 'customers', recordId: [1], stepIndex: 0 } },
        ],
      });

      expect(result.stepOutcome).toMatchObject({
        status: 'error',
        errorKind: 'call-site',
        error:
          'The Sub-workflow step that called this workflow takes its record from "Load UBOs", which runs once for each record of a Multiple step. Set its record to a step that loads one record.',
      });
    });
  });

  // Each enclosing per-record call narrows the steps before it to its own record, so a call nested
  // in UBO #2's call never reads another UBO's records.
  it('narrows the calling workflow to every enclosing per-record call', async () => {
    const ubo = (id: number) => ({ collectionName: 'ubos', recordId: [id], stepIndex: 0 });
    const doc = (id: number) => ({ collectionName: 'documents', recordId: [id], stepIndex: 2 });
    const loadStep = (stepId: string, stepIndex: number, title: string) => ({
      stepDefinition: {
        type: StepType.LoadRelatedRecord,
        executionType: StepExecutionMode.FullyAutomated,
        title,
        preRecordedArgs: { multiple: true },
      },
      stepOutcome: { type: 'record', stepId, stepIndex, status: 'success' },
    });
    const getStepExecutions = jest.fn().mockResolvedValue([
      {
        type: 'load-related-record',
        stepIndex: 0,
        executionResult: {
          relation: { name: 'ubos', displayName: 'UBOs' },
          records: [ubo(1), ubo(2)],
        },
      },
      {
        type: 'load-related-record',
        stepIndex: 2,
        executionResult: {
          relation: { name: 'documents', displayName: 'Documents' },
          records: [doc(7), doc(8)],
        },
      },
    ]);
    const step = makeStep({
      stepIndex: 4,
      stepDefinition: { type: StepType.Guidance, executionType: StepExecutionMode.Manual },
      previousSteps: [
        loadStep('load-ubos', 0, 'Load UBOs'),
        loadStep('load-docs', 2, 'Load documents'),
      ],
      callScope: {
        currentFrameStepIndexes: [],
        recordCalls: [
          {
            selectedRecordStepId: 'load-ubos',
            pinnedFrameStepIndexes: [0],
            recordIndex: 1,
            startStepIndex: 1,
          },
          {
            selectedRecordStepId: 'load-docs',
            pinnedFrameStepIndexes: [2],
            recordIndex: 0,
            startStepIndex: 3,
          },
        ],
      },
    } as unknown as Partial<AvailableStepExecution>);
    const config = { ...makeContextConfig(), runStore: { getStepExecutions } };

    const executor = await StepExecutorFactory.create(
      step,
      config as unknown as StepContextConfig,
      jest.fn(),
    );
    const { runStore } = (executor as unknown as { context: { runStore: RunStore } }).context;

    expect(await runStore.getStepExecutions('run-1')).toEqual([
      expect.objectContaining({
        stepIndex: 0,
        executionResult: expect.objectContaining({ record: ubo(2) }),
      }),
      expect.objectContaining({
        stepIndex: 2,
        executionResult: expect.objectContaining({ record: doc(7) }),
      }),
    ]);
    expect(getStepExecutions).toHaveBeenCalledTimes(2);
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

    it('refuses a Trigger Action with approval branches with a configuration error', async () => {
      const executor = await create({
        type: StepType.TriggerAction,
        executionType: StepExecutionMode.FullyAutomated,
        preRecordedArgs: { selectedRecordStepId: 'load-stores', actionName: 'refund' },
        approvalOutcomes: true,
      });

      expect(executor).not.toBeInstanceOf(PerRecordStepExecutor);
      await expect(executor.execute()).resolves.toEqual({
        stepOutcome: expect.objectContaining({
          status: 'error',
          errorKind: 'configuration',
          error: expect.stringContaining('approval branches are not supported'),
        }),
      });
    });

    it('runs a Trigger Action without approval branches once per record', async () => {
      const executor = await create({
        type: StepType.TriggerAction,
        executionType: StepExecutionMode.FullyAutomated,
        preRecordedArgs: { selectedRecordStepId: 'load-stores', actionName: 'refund' },
        approvalOutcomes: false,
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

  describe("the run's workflow on the step's activity logs", () => {
    const TARGET = { action: 'index', type: 'read' } as const;

    async function trackThroughBuiltContext(step: AvailableStepExecution) {
      const config = makeContextConfig();
      const service = fakeActivityLogsService();
      const executor = await StepExecutorFactory.create(
        step,
        config,
        jest.fn().mockResolvedValue({ tools: [], mcpServerName: 'srv' }),
        undefined,
        'forest-token',
      );
      const { activityLog } = (
        executor as unknown as { context: { activityLog: ActivityLogConfig } }
      ).context;
      await withActivityLog(activityLog, { action: 'index' }, async () => undefined);

      const { forestServerToken, renderingId, collectionName, recordIds, label, ...rest } = (
        service.createActivityLog as jest.Mock
      ).mock.calls[0][0];

      expect({ forestServerToken, renderingId, collectionName, recordIds, label }).toEqual({
        forestServerToken: 'forest-token',
        renderingId: '1',
        collectionName: undefined,
        recordIds: undefined,
        label: undefined,
      });

      return rest;
    }

    it("writes the entry with the collection's numeric id and retries its creation", async () => {
      const config = makeContextConfig();
      (config as unknown as { workflowPort: unknown }).workflowPort = {
        getCollectionSchema: jest.fn().mockResolvedValue({ collectionId: 'col-42' }),
      };
      const executor = await StepExecutorFactory.create(
        makeStep(),
        config,
        jest.fn().mockResolvedValue({ tools: [], mcpServerName: 'srv' }),
        undefined,
        'forest-token',
      );
      const { activityLog } = (
        executor as unknown as { context: { activityLog: ActivityLogConfig } }
      ).context;

      await expect(activityLog.activityLog.collectionIdOf?.('customers')).resolves.toBe('col-42');
      expect(activityLog.activityLog.retryCreation).toBe(true);
    });

    it('writes the entry to the Forest server under the WorkflowExecutor source', async () => {
      await trackThroughBuiltContext(makeStep());

      expect(ActivityLogsService).toHaveBeenCalledWith(expect.anything(), {
        forestServerUrl: FOREST_SERVER_URL,
        headers: { 'Forest-Application-Source': 'WorkflowExecutor' },
      });
    });

    it('blocks a write when the run carries no Forest server token', async () => {
      const config = makeContextConfig();
      const service = fakeActivityLogsService();
      const executor = await StepExecutorFactory.create(
        makeStep(),
        config,
        jest.fn().mockResolvedValue({ tools: [], mcpServerName: 'srv' }),
      );
      const { activityLog } = (
        executor as unknown as { context: { activityLog: ActivityLogConfig } }
      ).context;

      await expect(
        withActivityLog(activityLog, { action: 'update' }, async () => undefined),
      ).rejects.toMatchObject({ reason: 'unavailable' });
      expect(service.createActivityLog).not.toHaveBeenCalled();
    });

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
        ...TARGET,
        workflow: { runId: 'run-1', name: 'Alert triage', stepName: 'step-1' },
      });
    });

    it('carries no workflow when the run has no workflow name', async () => {
      const args = await trackThroughBuiltContext(makeStep());

      // toStrictEqual, not toEqual: only it tells a missing key from an undefined one.
      expect(args).toStrictEqual({ ...TARGET });
    });
  });

  it('hands the returned Sub-workflow calls to the executor it builds', async () => {
    const step = makeStep({
      stepDefinition: {
        type: StepType.Condition,
        executionType: StepExecutionMode.Manual,
        options: ['Approved path', 'Other'],
        preRecordedArgs: {
          optionConditions: [
            {
              option: 'Approved path',
              aggregator: 'and',
              conditions: [
                {
                  sourceType: 'sub-workflow',
                  sourceStepId: 'call-1',
                  fieldName: 'end',
                  operator: 'equal',
                  value: 'end-approved',
                },
              ],
            },
          ],
          fallbackOption: 'Other',
        },
      },
      subWorkflowEnds: [{ stepId: 'call-1', endStepId: 'end-approved' }],
    });
    const config = {
      ...makeContextConfig(),
      runStore: {
        getStepExecutions: jest.fn().mockResolvedValue([]),
        saveStepExecution: jest.fn().mockResolvedValue(undefined),
      },
    } as unknown as StepContextConfig;

    const executor = await StepExecutorFactory.create(step, config, jest.fn());
    const result = await executor.execute();

    expect(result.stepOutcome).toMatchObject({
      status: 'success',
      selectedOption: 'Approved path',
    });
  });

  it('passes the step user id to the tool fetcher', async () => {
    const fetchRemoteTools = jest.fn().mockResolvedValue({ tools: [], mcpServerName: 'srv' });

    await StepExecutorFactory.create(makeStep(), makeContextConfig(), fetchRemoteTools);

    expect(fetchRemoteTools).toHaveBeenCalledWith('srv-1', 7);
  });
});
