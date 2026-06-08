import type { ActivityLogPort } from '../../src/ports/activity-log-port';
import type { AgentPort } from '../../src/ports/agent-port';
import type { RunStore } from '../../src/ports/run-store';
import type { WorkflowPort } from '../../src/ports/workflow-port';
import type { ExecutionContext } from '../../src/types/execution-context';
import type { UpdateRecordStepExecutionData } from '../../src/types/step-execution-data';
import type { CollectionSchema, RecordRef } from '../../src/types/validated/collection';
import type { Step } from '../../src/types/validated/execution';
import type { UpdateRecordStepDefinition } from '../../src/types/validated/step-definition';

import {
  ActivityLogCreationError,
  AgentPortError,
  RunStorePortError,
  StepStateError,
} from '../../src/errors';
import ActivityLogger from '../../src/executors/activity-logger';
import AgentWithLog from '../../src/executors/agent-with-log';
import UpdateRecordStepExecutor from '../../src/executors/update-record-step-executor';
import SchemaCache from '../../src/schema-cache';
import SchemaResolver from '../../src/schema-resolver';
import { StepExecutionMode, StepType } from '../../src/types/validated/step-definition';

function makeStep(overrides: Partial<UpdateRecordStepDefinition> = {}): UpdateRecordStepDefinition {
  return {
    type: StepType.UpdateRecord,
    executionType: StepExecutionMode.AutomatedWithConfirmation,
    prompt: 'Set the customer status to active',
    ...overrides,
  };
}

function makeRecordRef(overrides: Partial<RecordRef> = {}): RecordRef {
  return {
    collectionName: 'customers',
    recordId: [42],
    stepIndex: 0,
    ...overrides,
  };
}

function makeMockAgentPort(
  updatedValues: Record<string, unknown> = { status: 'active', name: 'John Doe' },
): AgentPort {
  return {
    getRecord: jest.fn().mockResolvedValue({ values: updatedValues }),
    updateRecord: jest.fn().mockResolvedValue({
      collectionName: 'customers',
      recordId: [42],
      values: updatedValues,
    }),
    getRelatedData: jest.fn(),
    executeAction: jest.fn(),
  } as unknown as AgentPort;
}

function makeCollectionSchema(overrides: Partial<CollectionSchema> = {}): CollectionSchema {
  return {
    collectionName: 'customers',
    collectionId: 'col-customers',
    collectionDisplayName: 'Customers',
    primaryKeyFields: ['id'],
    fields: [
      { fieldName: 'email', displayName: 'Email', isRelationship: false, type: 'String' },
      { fieldName: 'status', displayName: 'Status', isRelationship: false, type: 'String' },
      { fieldName: 'name', displayName: 'Full Name', isRelationship: false, type: 'String' },
      { fieldName: 'orders', displayName: 'Orders', isRelationship: true, type: null },
    ],
    actions: [],
    ...overrides,
  };
}

function makeMockRunStore(overrides: Partial<RunStore> = {}): RunStore {
  return {
    init: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    getStepExecutions: jest.fn().mockResolvedValue([]),
    saveStepExecution: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeMockWorkflowPort(
  schemasByCollection: Record<string, CollectionSchema> = {
    customers: makeCollectionSchema(),
  },
): WorkflowPort {
  return {
    getAvailableRuns: jest.fn().mockResolvedValue({ pending: [], malformed: [] }),
    getAvailableRun: jest.fn().mockResolvedValue(null),
    updateStepExecution: jest.fn().mockResolvedValue(undefined),
    getCollectionSchema: jest
      .fn()
      .mockImplementation((name: string) =>
        Promise.resolve(
          schemasByCollection[name] ?? makeCollectionSchema({ collectionName: name }),
        ),
      ),
    getMcpServerConfigs: jest.fn().mockResolvedValue({}),
    hasRunAccess: jest.fn().mockResolvedValue(true),
  };
}

function makeMockModel(toolCallArgs?: Record<string, unknown>, toolName = 'update-record-field') {
  const invoke = jest.fn().mockResolvedValue({
    tool_calls: toolCallArgs ? [{ name: toolName, args: toolCallArgs, id: 'call_1' }] : undefined,
  });
  const bindTools = jest.fn().mockReturnValue({ invoke });
  const model = { bindTools } as unknown as ExecutionContext['model'];

  return { model, bindTools, invoke };
}

function makeContext(
  overrides: Partial<ExecutionContext<UpdateRecordStepDefinition>> & {
    agentPort?: AgentPort;
    activityLogPort?: ActivityLogPort;
    activityLogger?: ActivityLogger;
    workflowPort?: WorkflowPort;
  } = {},
): ExecutionContext<UpdateRecordStepDefinition> {
  const runId = overrides.runId ?? 'run-1';
  const workflowPort = overrides.workflowPort ?? makeMockWorkflowPort();
  const schemaCache = new SchemaCache();

  const base: Omit<ExecutionContext<UpdateRecordStepDefinition>, 'agent' | 'activityLogger'> = {
    runId,
    stepId: 'update-1',
    stepIndex: 0,
    collectionId: 'col-1',
    baseRecordRef: makeRecordRef(),
    stepDefinition: makeStep(),
    model: makeMockModel({
      input: { fieldName: 'Status', value: 'active', reasoning: 'User requested status change' },
    }).model,
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

  const activityLogger =
    overrides.activityLogger ??
    new ActivityLogger(
      overrides.activityLogPort ?? {
        createPending: jest.fn().mockResolvedValue({ id: 'log-1', index: '0' }),
        markSucceeded: jest.fn().mockResolvedValue(undefined),
        markFailed: jest.fn().mockResolvedValue(undefined),
      },
      base.user,
    );

  return {
    ...base,
    activityLogger,
    agent:
      overrides.agent ??
      new AgentWithLog({
        agentPort: overrides.agentPort ?? makeMockAgentPort(),
        schemaResolver: base.schemaResolver,
        user: base.user,
        activityLogger,
      }),
  };
}

function makeLoadRelatedPreviousStep(stepIndex: number, originalStepIndex?: number): Step {
  return {
    stepDefinition: {
      type: StepType.LoadRelatedRecord,
      executionType: StepExecutionMode.FullyAutomated,
      prompt: 'Load the order',
    },
    stepOutcome: {
      type: 'record',
      stepId: `load-${stepIndex}`,
      stepIndex,
      status: 'success',
    },
    ...(originalStepIndex !== undefined && { originalStepIndex }),
  };
}

describe('UpdateRecordStepExecutor', () => {
  describe('executionType=FullyAutomated: update direct (Branch B)', () => {
    it('updates the record and returns success', async () => {
      const updatedValues = { status: 'active', name: 'John Doe' };
      const agentPort = makeMockAgentPort(updatedValues);
      const mockModel = makeMockModel({
        input: { fieldName: 'Status', value: 'active', reasoning: 'User requested status change' },
      });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        runStore,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(agentPort.updateRecord).toHaveBeenCalledWith(
        { collection: 'customers', id: [42], values: { status: 'active' } },
        expect.objectContaining({ id: 1 }),
      );
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          type: 'update-record',
          stepIndex: 0,
          executionParams: { displayName: 'Status', name: 'status', value: 'active' },
          executionResult: { updatedValues },
          selectedRecordRef: expect.objectContaining({
            collectionName: 'customers',
            recordId: [42],
          }),
        }),
      );
    });
  });

  describe('operation activity log (PRD-442 #1)', () => {
    it('logs the update against the acted record and its collection, not the trigger', async () => {
      const runStore = makeMockRunStore();
      const activityLogPort = {
        createPending: jest.fn().mockResolvedValue({ id: 'log-1', index: '0' }),
        markSucceeded: jest.fn().mockResolvedValue(undefined),
        markFailed: jest.fn().mockResolvedValue(undefined),
      };
      const context = makeContext({
        model: makeMockModel({ input: { fieldName: 'Status', value: 'active', reasoning: 'r' } })
          .model,
        runStore,
        activityLogPort,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });

      await new UpdateRecordStepExecutor(context).execute();

      expect(activityLogPort.createPending).toHaveBeenCalledWith({
        renderingId: 1,
        action: 'update',
        type: 'write',
        collectionId: 'col-customers',
        recordId: [42],
      });
    });

    it('does not log the update while only awaiting confirmation', async () => {
      const runStore = makeMockRunStore();
      const activityLogPort = {
        createPending: jest.fn().mockResolvedValue({ id: 'log-1', index: '0' }),
        markSucceeded: jest.fn().mockResolvedValue(undefined),
        markFailed: jest.fn().mockResolvedValue(undefined),
      };
      const context = makeContext({
        model: makeMockModel({ input: { fieldName: 'Status', value: 'active', reasoning: 'r' } })
          .model,
        runStore,
        activityLogPort,
      });

      const result = await new UpdateRecordStepExecutor(context).execute();

      expect(result.stepOutcome.status).toBe('awaiting-input');
      expect(activityLogPort.createPending).not.toHaveBeenCalled();
    });

    it('logs against a related record in another collection (cross-collection)', async () => {
      const baseRecordRef = makeRecordRef({ stepIndex: 1 });
      const relatedRecord = makeRecordRef({
        stepIndex: 2,
        recordId: [99],
        collectionName: 'orders',
      });
      const ordersSchema = makeCollectionSchema({
        collectionName: 'orders',
        collectionId: 'col-orders',
        collectionDisplayName: 'Orders',
        fields: [
          { fieldName: 'total', displayName: 'Total', isRelationship: false, type: 'Number' },
        ],
      });

      const invoke = jest
        .fn()
        .mockResolvedValueOnce({
          tool_calls: [
            { name: 'select-record', args: { recordIdentifier: 'Step 2 - Orders #99' }, id: 'c1' },
          ],
        })
        .mockResolvedValueOnce({
          tool_calls: [
            {
              name: 'update-record-field',
              args: { input: { fieldName: 'Total', value: 200, reasoning: 'r' } },
              id: 'c2',
            },
          ],
        });
      const model = {
        bindTools: jest.fn().mockReturnValue({ invoke }),
      } as unknown as ExecutionContext['model'];

      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([
          {
            type: 'load-related-record',
            stepIndex: 2,
            executionResult: {
              relation: { name: 'order', displayName: 'Order' },
              record: relatedRecord,
            },
            selectedRecordRef: makeRecordRef(),
          },
        ]),
      });
      const activityLogPort = {
        createPending: jest.fn().mockResolvedValue({ id: 'log-1', index: '0' }),
        markSucceeded: jest.fn().mockResolvedValue(undefined),
        markFailed: jest.fn().mockResolvedValue(undefined),
      };
      const context = makeContext({
        baseRecordRef,
        model,
        runStore,
        workflowPort: makeMockWorkflowPort({
          customers: makeCollectionSchema(),
          orders: ordersSchema,
        }),
        activityLogPort,
        previousSteps: [makeLoadRelatedPreviousStep(2)],
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });

      await new UpdateRecordStepExecutor(context).execute();

      expect(activityLogPort.createPending).toHaveBeenCalledWith({
        renderingId: 1,
        action: 'update',
        type: 'write',
        collectionId: 'col-orders',
        recordId: [99],
      });
    });

    it('does not persist the executing marker when the activity log cannot be created', async () => {
      const runStore = makeMockRunStore();
      const activityLogPort = {
        createPending: jest
          .fn()
          .mockRejectedValue(new ActivityLogCreationError(new Error('audit down'))),
        markSucceeded: jest.fn().mockResolvedValue(undefined),
        markFailed: jest.fn().mockResolvedValue(undefined),
      };
      const context = makeContext({
        runStore,
        activityLogPort,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });

      const result = await new UpdateRecordStepExecutor(context).execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'Could not record this step in the audit log. Please try again, or contact your administrator if the problem persists.',
      );
      expect(runStore.saveStepExecution).not.toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({ idempotencyPhase: 'executing' }),
      );
    });
  });

  describe('without executionType=FullyAutomated: awaiting-input (Branch C)', () => {
    it('saves execution and returns awaiting-input', async () => {
      const mockModel = makeMockModel({
        input: { fieldName: 'Status', value: 'active', reasoning: 'User requested status change' },
      });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        runStore,
      });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('awaiting-input');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          type: 'update-record',
          stepIndex: 0,
          pendingData: { displayName: 'Status', name: 'status', value: 'active' },
          selectedRecordRef: expect.objectContaining({
            collectionName: 'customers',
            recordId: [42],
          }),
        }),
      );
    });
  });

  describe('confirmation accepted (Branch A)', () => {
    it('updates the record when user confirms', async () => {
      const updatedValues = { status: 'active', name: 'John Doe' };
      const agentPort = makeMockAgentPort(updatedValues);
      const execution: UpdateRecordStepExecutionData = {
        type: 'update-record',
        stepIndex: 0,
        pendingData: {
          displayName: 'Status',
          name: 'status',
          value: 'active',
        },
        userConfirmation: { userConfirmed: true },
        selectedRecordRef: makeRecordRef(),
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const context = makeContext({ agentPort, runStore });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(agentPort.updateRecord).toHaveBeenCalledWith(
        { collection: 'customers', id: [42], values: { status: 'active' } },
        expect.objectContaining({ id: 1 }),
      );
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          type: 'update-record',
          executionParams: { displayName: 'Status', name: 'status', value: 'active' },
          executionResult: { updatedValues },
          pendingData: {
            displayName: 'Status',
            name: 'status',
            value: 'active',
          },
        }),
      );
    });
  });

  describe('confirmation with user override (Branch A)', () => {
    it('preserves AI suggestion in pendingData and writes user value to executionParams', async () => {
      // Persisted state: AI proposed 'inactive', awaiting confirmation.
      const execution: UpdateRecordStepExecutionData = {
        type: 'update-record',
        stepIndex: 0,
        pendingData: {
          displayName: 'Status',
          name: 'status',
          value: 'inactive',
        },
        selectedRecordRef: makeRecordRef(),
      };
      const updatedValues = { status: 'active' };
      const agentPort = makeMockAgentPort(updatedValues);
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      // User confirms with a different value: 'active'.
      const context = makeContext({
        agentPort,
        runStore,
        incomingPendingData: { userConfirmed: true, value: 'active' },
      });
      const executor = new UpdateRecordStepExecutor(context);

      await executor.execute();

      // updateRecord must be called with the user-confirmed value.
      expect(agentPort.updateRecord).toHaveBeenCalledWith(
        { collection: 'customers', id: [42], values: { status: 'active' } },
        expect.objectContaining({ id: 1 }),
      );

      // Final persisted execution must keep AI suggestion in pendingData
      // and the user value in executionParams.
      const finalSave = (runStore.saveStepExecution as jest.Mock).mock.calls.at(-1)?.[1];
      expect(finalSave).toEqual(
        expect.objectContaining({
          type: 'update-record',
          pendingData: expect.objectContaining({
            displayName: 'Status',
            name: 'status',
            value: 'inactive', // AI suggestion preserved
          }),
          executionParams: { displayName: 'Status', name: 'status', value: 'active' },
          executionResult: { updatedValues },
        }),
      );
    });
  });

  describe('accept-via-PATCH without value override (Branch A)', () => {
    it('falls back to pendingData.value when userConfirmation has no value key', async () => {
      const execution: UpdateRecordStepExecutionData = {
        type: 'update-record',
        stepIndex: 0,
        pendingData: { displayName: 'Status', name: 'status', value: 'active' },
        selectedRecordRef: makeRecordRef(),
      };
      const updatedValues = { status: 'active' };
      const agentPort = makeMockAgentPort(updatedValues);
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const context = makeContext({
        agentPort,
        runStore,
        incomingPendingData: { userConfirmed: true },
      });
      const executor = new UpdateRecordStepExecutor(context);

      await executor.execute();

      expect(agentPort.updateRecord).toHaveBeenCalledWith(
        { collection: 'customers', id: [42], values: { status: 'active' } },
        expect.objectContaining({ id: 1 }),
      );
      const finalSave = (runStore.saveStepExecution as jest.Mock).mock.calls.at(-1)?.[1];
      expect(finalSave).toEqual(
        expect.objectContaining({
          executionParams: { displayName: 'Status', name: 'status', value: 'active' },
          userConfirmation: { userConfirmed: true },
        }),
      );
    });
  });

  describe('rejection via PATCH with userConfirmation set (Branch A)', () => {
    it('skips the update and ignores any value in userConfirmation', async () => {
      const execution: UpdateRecordStepExecutionData = {
        type: 'update-record',
        stepIndex: 0,
        pendingData: { displayName: 'Status', name: 'status', value: 'inactive' },
        selectedRecordRef: makeRecordRef(),
      };
      const agentPort = makeMockAgentPort();
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const context = makeContext({
        agentPort,
        runStore,
        incomingPendingData: { userConfirmed: false, value: 'active' },
      });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(agentPort.updateRecord).not.toHaveBeenCalled();
      const finalSave = (runStore.saveStepExecution as jest.Mock).mock.calls.at(-1)?.[1];
      expect(finalSave).toEqual(
        expect.objectContaining({
          executionResult: { skipped: true },
          pendingData: expect.objectContaining({
            value: 'inactive',
          }),
        }),
      );
    });
  });

  describe('confirmation rejected (Branch A)', () => {
    it('skips the update when user rejects', async () => {
      const agentPort = makeMockAgentPort();
      const execution: UpdateRecordStepExecutionData = {
        type: 'update-record',
        stepIndex: 0,
        pendingData: {
          displayName: 'Status',
          name: 'status',
          value: 'active',
        },
        userConfirmation: { userConfirmed: false },
        selectedRecordRef: makeRecordRef(),
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const activityLogPort = {
        createPending: jest.fn().mockResolvedValue({ id: 'log-1', index: '0' }),
        markSucceeded: jest.fn().mockResolvedValue(undefined),
        markFailed: jest.fn().mockResolvedValue(undefined),
      };
      const context = makeContext({ agentPort, runStore, activityLogPort });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(agentPort.updateRecord).not.toHaveBeenCalled();
      // No side effect happened → no audit-log entry (PRD-442 #2: no premature/duplicate log).
      expect(activityLogPort.createPending).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionResult: { skipped: true },
          pendingData: {
            displayName: 'Status',
            name: 'status',
            value: 'active',
          },
        }),
      );
    });
  });

  describe('no pending update in phase 2 (Branch A)', () => {
    it('falls through to first-call path when no pending update is found', async () => {
      const runStore = makeMockRunStore({
        init: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
        getStepExecutions: jest.fn().mockResolvedValue([]),
      });
      const context = makeContext({ runStore });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('awaiting-input');
    });

    it('falls through to first-call path when execution exists but stepIndex does not match', async () => {
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([
          {
            type: 'update-record',
            stepIndex: 5,
            pendingData: { displayName: 'Status', name: 'status', value: 'active' },
            selectedRecordRef: makeRecordRef(),
          },
        ]),
      });
      const context = makeContext({ runStore });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('awaiting-input');
    });

    it('returns error outcome when execution exists but pendingData is absent', async () => {
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([
          {
            type: 'update-record',
            stepIndex: 0,
            selectedRecordRef: makeRecordRef(),
          },
        ]),
      });
      const context = makeContext({ runStore });
      const executor = new UpdateRecordStepExecutor(context);

      await expect(executor.execute()).resolves.toMatchObject({
        stepOutcome: {
          type: 'record',
          stepId: 'update-1',
          stepIndex: 0,
          status: 'error',
          error: 'An unexpected error occurred while processing this step.',
        },
      });
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('multi-record AI selection', () => {
    it('uses AI to select among multiple records then selects field', async () => {
      const baseRecordRef = makeRecordRef({ stepIndex: 1 });
      const relatedRecord = makeRecordRef({
        stepIndex: 2,
        recordId: [99],
        collectionName: 'orders',
      });

      const ordersSchema = makeCollectionSchema({
        collectionName: 'orders',
        collectionDisplayName: 'Orders',
        fields: [
          { fieldName: 'total', displayName: 'Total', isRelationship: false, type: 'Number' },
          {
            fieldName: 'status',
            displayName: 'Order Status',
            isRelationship: false,
            type: 'String',
          },
        ],
      });

      // First call: select-record, second call: update-record-field
      const invoke = jest
        .fn()
        .mockResolvedValueOnce({
          tool_calls: [
            {
              name: 'select-record',
              args: { recordIdentifier: 'Step 2 - Orders #99' },
              id: 'call_1',
            },
          ],
        })
        .mockResolvedValueOnce({
          tool_calls: [
            {
              name: 'update-record-field',
              args: {
                input: {
                  fieldName: 'Order Status',
                  value: 'shipped',
                  reasoning: 'Mark as shipped',
                },
              },
              id: 'call_2',
            },
          ],
        });
      const bindTools = jest.fn().mockReturnValue({ invoke });
      const model = { bindTools } as unknown as ExecutionContext['model'];

      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([
          {
            type: 'load-related-record',
            stepIndex: 2,
            executionResult: {
              relation: { name: 'order', displayName: 'Order' },
              record: relatedRecord,
            },
            selectedRecordRef: makeRecordRef(),
          },
        ]),
      });
      const workflowPort = makeMockWorkflowPort({
        customers: makeCollectionSchema(),
        orders: ordersSchema,
      });
      const context = makeContext({
        baseRecordRef,
        model,
        runStore,
        workflowPort,
        previousSteps: [makeLoadRelatedPreviousStep(2)],
      });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('awaiting-input');
      expect(bindTools).toHaveBeenCalledTimes(2);

      const selectTool = bindTools.mock.calls[0][0][0];
      expect(selectTool.name).toBe('select-record');

      const updateTool = bindTools.mock.calls[1][0][0];
      expect(updateTool.name).toBe('update-record-field');

      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          pendingData: {
            displayName: 'Order Status',
            name: 'status',
            value: 'shipped',
          },
          selectedRecordRef: expect.objectContaining({
            recordId: [99],
            collectionName: 'orders',
          }),
        }),
      );
    });
  });

  describe('NoWritableFieldsError', () => {
    it('returns error when all fields are relationships', async () => {
      const schema = makeCollectionSchema({
        fields: [{ fieldName: 'orders', displayName: 'Orders', isRelationship: true, type: null }],
      });
      const mockModel = makeMockModel({
        input: { fieldName: 'Status', value: 'active', reasoning: 'test' },
      });
      const runStore = makeMockRunStore();
      const workflowPort = makeMockWorkflowPort({ customers: schema });
      const context = makeContext({ model: mockModel.model, runStore, workflowPort });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'This record type has no editable fields configured in Forest Admin.',
      );
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('type-less fields (orchestrator drift)', () => {
    it('does not offer a type-less field to the AI, so it never blocks the whole step', async () => {
      const updatedValues = { status: 'active' };
      const agentPort = makeMockAgentPort(updatedValues);
      const workflowPort = makeMockWorkflowPort({
        customers: makeCollectionSchema({
          fields: [
            { fieldName: 'status', displayName: 'Status', isRelationship: false, type: 'String' },
            // Drifted field with no `type`: must be excluded from the AI choices, not fail the step.
            { fieldName: 'age', displayName: 'Age', isRelationship: false },
          ],
        }),
      });
      const mockModel = makeMockModel({
        input: { fieldName: 'Status', value: 'active', reasoning: 'r' },
      });
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        workflowPort,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(agentPort.updateRecord).toHaveBeenCalledWith(
        { collection: 'customers', id: [42], values: { status: 'active' } },
        expect.objectContaining({ id: 1 }),
      );
    });

    it('throws NoWritableFieldsError when every non-relationship field lacks a type', async () => {
      const workflowPort = makeMockWorkflowPort({
        customers: makeCollectionSchema({
          fields: [{ fieldName: 'age', displayName: 'Age', isRelationship: false }],
        }),
      });
      const context = makeContext({
        workflowPort,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'This record type has no editable fields configured in Forest Admin.',
      );
    });
  });

  describe('resolveFieldName failure', () => {
    it('returns error when field is not found during executionType=FullyAutomated (Branch B)', async () => {
      // AI returns a display name that doesn't match any field in the schema
      const mockModel = makeMockModel({
        input: { fieldName: 'NonExistentField', value: 'test', reasoning: 'test' },
      });
      const context = makeContext({
        model: mockModel.model,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        "The AI selected a field that doesn't exist on this record. Try rephrasing the step's prompt.",
      );
    });
  });

  describe('resolveFieldName fuzzy matching', () => {
    it.each([
      ['snake_case variant', 'full_name', 'Full Name', 'name'],
      ['camelCase variant', 'fullName', 'Full Name', 'name'],
      ['lowercase no separator', 'fullname', 'Full Name', 'name'],
      ['hyphen variant', 'full-name', 'Full Name', 'name'],
    ])(
      'resolves field when LLM returns %s (%s)',
      async (_label, aiReturnedName, _displayName, expectedFieldName) => {
        const agentPort = makeMockAgentPort();
        const mockModel = makeMockModel({
          input: { fieldName: aiReturnedName, value: 'John Doe', reasoning: 'test' },
        });
        const context = makeContext({
          model: mockModel.model,
          agentPort,
          stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
        });
        const executor = new UpdateRecordStepExecutor(context);

        const result = await executor.execute();

        expect(result.stepOutcome.status).toBe('success');
        expect(agentPort.updateRecord).toHaveBeenCalledWith(
          expect.objectContaining({ values: { [expectedFieldName]: 'John Doe' } }),
          expect.anything(),
        );
      },
    );

    it('returns undefined (field not found) when two fields normalize to the same string', async () => {
      // { displayName: "Full Name", fieldName: "fullname" } and
      // { displayName: "FullName", fieldName: "full_name" } both normalize to "fullname".
      // Returning either one would be a silent wrong pick — undefined is safer.
      const ambiguousSchema = makeCollectionSchema({
        fields: [
          {
            fieldName: 'fullname',
            displayName: 'Full Name',
            isRelationship: false,
            type: 'String',
          },
          {
            fieldName: 'full_name',
            displayName: 'FullName',
            isRelationship: false,
            type: 'String',
          },
        ],
      });
      const mockModel = makeMockModel({
        input: { fieldName: 'Full-Name', value: 'John', reasoning: 'test' },
      });
      const context = makeContext({
        model: mockModel.model,
        workflowPort: makeMockWorkflowPort({ customers: ambiguousSchema }),
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
    });
  });

  describe('relationship fields excluded from update tool', () => {
    it('excludes relationship fields from the tool schema', async () => {
      const mockModel = makeMockModel({
        input: { fieldName: 'Status', value: 'active', reasoning: 'test' },
      });
      const context = makeContext({ model: mockModel.model });
      const executor = new UpdateRecordStepExecutor(context);

      await executor.execute();

      // Second bindTools call is for update-record-field (first may be select-record)
      const lastCall = mockModel.bindTools.mock.calls[mockModel.bindTools.mock.calls.length - 1];
      const tool = lastCall[0][0];
      expect(tool.name).toBe('update-record-field');

      // Each non-relationship field is a literal in the union — exact displayName required
      expect(
        tool.schema.parse({ input: { fieldName: 'Email', value: 'x', reasoning: 'r' } }),
      ).toBeTruthy();
      expect(
        tool.schema.parse({ input: { fieldName: 'Status', value: 'x', reasoning: 'r' } }),
      ).toBeTruthy();
      expect(
        tool.schema.parse({ input: { fieldName: 'Full Name', value: 'x', reasoning: 'r' } }),
      ).toBeTruthy();

      // Relationship display name rejected — no union variant has fieldName 'Orders'
      expect(() =>
        tool.schema.parse({ input: { fieldName: 'Orders', value: 'x', reasoning: 'r' } }),
      ).toThrow();
    });
  });

  describe('AI malformed/missing tool call', () => {
    it('returns error on malformed tool call', async () => {
      const invoke = jest.fn().mockResolvedValue({
        tool_calls: [],
        invalid_tool_calls: [
          { name: 'update-record-field', args: '{bad json', error: 'JSON parse error' },
        ],
      });
      const bindTools = jest.fn().mockReturnValue({ invoke });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: { bindTools } as unknown as ExecutionContext['model'],
        runStore,
      });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.type).toBe('record');
      expect(result.stepOutcome.stepId).toBe('update-1');
      expect(result.stepOutcome.stepIndex).toBe(0);
      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        "The AI returned an unexpected response. Try rephrasing the step's prompt.",
      );
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });

    it('returns error when AI returns no tool call', async () => {
      const invoke = jest.fn().mockResolvedValue({ tool_calls: [] });
      const bindTools = jest.fn().mockReturnValue({ invoke });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: { bindTools } as unknown as ExecutionContext['model'],
        runStore,
      });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.type).toBe('record');
      expect(result.stepOutcome.stepId).toBe('update-1');
      expect(result.stepOutcome.stepIndex).toBe(0);
      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        "The AI couldn't decide what to do. Try rephrasing the step's prompt.",
      );
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('agentPort.updateRecord WorkflowExecutorError (Branch B)', () => {
    it('returns error when updateRecord throws WorkflowExecutorError', async () => {
      const agentPort = makeMockAgentPort();
      (agentPort.updateRecord as jest.Mock).mockRejectedValue(new StepStateError('Record locked'));
      const mockModel = makeMockModel({
        input: { fieldName: 'Status', value: 'active', reasoning: 'test' },
      });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        runStore,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.type).toBe('record');
      expect(result.stepOutcome.stepId).toBe('update-1');
      expect(result.stepOutcome.stepIndex).toBe(0);
      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'An unexpected error occurred while processing this step.',
      );
    });
  });

  describe('agentPort.updateRecord WorkflowExecutorError (Branch A)', () => {
    it('returns error when updateRecord throws WorkflowExecutorError during confirmation', async () => {
      const agentPort = makeMockAgentPort();
      (agentPort.updateRecord as jest.Mock).mockRejectedValue(new StepStateError('Record locked'));
      const execution: UpdateRecordStepExecutionData = {
        type: 'update-record',
        stepIndex: 0,
        pendingData: {
          displayName: 'Status',
          name: 'status',
          value: 'active',
        },
        userConfirmation: { userConfirmed: true },
        selectedRecordRef: makeRecordRef(),
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const context = makeContext({ agentPort, runStore });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.type).toBe('record');
      expect(result.stepOutcome.stepId).toBe('update-1');
      expect(result.stepOutcome.stepIndex).toBe(0);
      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'An unexpected error occurred while processing this step.',
      );
    });
  });

  describe('agentPort.updateRecord infra error', () => {
    it('returns error outcome for infrastructure errors (Branch B)', async () => {
      const agentPort = makeMockAgentPort();
      (agentPort.updateRecord as jest.Mock).mockRejectedValue(new Error('Connection refused'));
      const mockModel = makeMockModel({
        input: { fieldName: 'Status', value: 'active', reasoning: 'test' },
      });
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();
      expect(result.stepOutcome.status).toBe('error');
    });

    it('returns error outcome for infrastructure errors (Branch A)', async () => {
      const agentPort = makeMockAgentPort();
      (agentPort.updateRecord as jest.Mock).mockRejectedValue(new Error('Connection refused'));
      const execution: UpdateRecordStepExecutionData = {
        type: 'update-record',
        stepIndex: 0,
        pendingData: {
          displayName: 'Status',
          name: 'status',
          value: 'active',
        },
        userConfirmation: { userConfirmed: true },
        selectedRecordRef: makeRecordRef(),
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const context = makeContext({ agentPort, runStore });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();
      expect(result.stepOutcome.status).toBe('error');
    });

    it('returns user message and logs cause when agentPort.updateRecord throws an infra error', async () => {
      const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
      const agentPort = makeMockAgentPort();
      (agentPort.updateRecord as jest.Mock).mockRejectedValue(
        new AgentPortError('updateRecord', new Error('DB connection lost')),
      );
      const mockModel = makeMockModel({
        input: { fieldName: 'Status', value: 'active', reasoning: 'test' },
      });
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        logger,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'An error occurred while accessing your data. Please try again.',
      );
      expect(logger.error).toHaveBeenCalledWith(
        'Agent port "updateRecord" failed: DB connection lost',
        expect.objectContaining({ cause: 'DB connection lost' }),
      );
    });
  });

  describe('stepOutcome shape', () => {
    it('emits correct type, stepId and stepIndex in the outcome', async () => {
      const context = makeContext({
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome).toMatchObject({
        type: 'record',
        stepId: 'update-1',
        stepIndex: 0,
        status: 'success',
      });
    });
  });

  describe('findField fieldName fallback', () => {
    it('resolves update when AI returns raw fieldName instead of displayName', async () => {
      const agentPort = makeMockAgentPort();
      // AI returns 'status' (fieldName) instead of 'Status' (displayName)
      const mockModel = makeMockModel({
        input: { fieldName: 'status', value: 'active', reasoning: 'test' },
      });
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(agentPort.updateRecord).toHaveBeenCalledWith(
        { collection: 'customers', id: [42], values: { status: 'active' } },
        expect.objectContaining({ id: 1 }),
      );
    });
  });

  describe('schema caching', () => {
    it('fetches getCollectionSchema once per collection even when called twice (Branch B)', async () => {
      const workflowPort = makeMockWorkflowPort();
      const context = makeContext({
        workflowPort,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
      const executor = new UpdateRecordStepExecutor(context);

      await executor.execute();

      // resolveFieldName is called in handleFirstCall, so getCollectionSchema is only fetched once
      expect(workflowPort.getCollectionSchema).toHaveBeenCalledTimes(1);
    });
  });

  describe('RunStore error propagation', () => {
    it('returns error outcome when getStepExecutions fails (Branch A)', async () => {
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockRejectedValue(new Error('DB timeout')),
      });
      const context = makeContext({ runStore });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();
      expect(result.stepOutcome.status).toBe('error');
    });

    it('returns error outcome when saveStepExecution fails on user reject (Branch A)', async () => {
      const execution: UpdateRecordStepExecutionData = {
        type: 'update-record',
        stepIndex: 0,
        pendingData: {
          displayName: 'Status',
          name: 'status',
          value: 'active',
        },
        userConfirmation: { userConfirmed: false },
        selectedRecordRef: makeRecordRef(),
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
        saveStepExecution: jest.fn().mockRejectedValue(new Error('Disk full')),
      });
      const context = makeContext({ runStore });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();
      expect(result.stepOutcome.status).toBe('error');
    });

    it('returns error outcome when saveStepExecution fails saving awaiting-input (Branch C)', async () => {
      const runStore = makeMockRunStore({
        saveStepExecution: jest.fn().mockRejectedValue(new Error('Disk full')),
      });
      const context = makeContext({ runStore });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();
      expect(result.stepOutcome.status).toBe('error');
    });

    it('returns error outcome after successful updateRecord when saveStepExecution fails (Branch B)', async () => {
      const runStore = makeMockRunStore({
        saveStepExecution: jest
          .fn()
          .mockRejectedValue(new RunStorePortError('saveStepExecution', new Error('Disk full'))),
      });
      const context = makeContext({
        runStore,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe('The step state could not be accessed. Please retry.');
    });
  });

  describe('default prompt', () => {
    it('uses default prompt when step.prompt is undefined', async () => {
      const mockModel = makeMockModel({
        input: { fieldName: 'Status', value: 'active', reasoning: 'test' },
      });
      const context = makeContext({
        model: mockModel.model,
        stepDefinition: makeStep({ prompt: undefined }),
      });
      const executor = new UpdateRecordStepExecutor(context);

      await executor.execute();

      const messages = mockModel.invoke.mock.calls[0][0];
      const humanMessage = messages[messages.length - 1];
      expect(humanMessage.content).toBe('**Request**: Update the relevant field.');
    });
  });

  describe('previous steps context', () => {
    it('includes previous steps summary in update-field messages', async () => {
      const mockModel = makeMockModel({
        input: { fieldName: 'Status', value: 'active', reasoning: 'test' },
      });
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([
          {
            type: 'condition',
            stepIndex: 0,
            executionParams: { answer: 'Yes', reasoning: 'Approved' },
          },
        ]),
      });
      const context = makeContext({
        model: mockModel.model,
        runStore,
        previousSteps: [
          {
            stepDefinition: {
              type: StepType.Condition,
              executionType: StepExecutionMode.Manual,
              options: ['Yes', 'No'],
              prompt: 'Should we proceed?',
            },
            stepOutcome: {
              type: 'condition',
              stepId: 'prev-step',
              stepIndex: 0,
              status: 'success',
            },
          },
        ],
      });
      const executor = new UpdateRecordStepExecutor({
        ...context,
        stepId: 'update-2',
        stepIndex: 1,
      });

      await executor.execute();

      const messages = mockModel.invoke.mock.calls[0][0];
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toContain('Step executed by');
      expect(messages[0].content).toContain('Should we proceed?');
      expect(messages[0].content).toContain('"answer":"Yes"');
      expect(messages[0].content).toContain('updating a field on a record');
    });
  });

  describe('pre-recorded args', () => {
    it('skips AI field selection when fieldName and value are pre-recorded', async () => {
      const mockModel = makeMockModel();
      const runStore = makeMockRunStore();
      const agentPort = makeMockAgentPort();
      const context = makeContext({
        model: mockModel.model,
        runStore,
        agentPort,
        stepDefinition: makeStep({
          executionType: StepExecutionMode.FullyAutomated,
          preRecordedArgs: { fieldName: 'status', value: 'active' },
        }),
      });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(mockModel.bindTools).not.toHaveBeenCalled();
      expect(agentPort.updateRecord).toHaveBeenCalledWith(
        expect.objectContaining({ values: { status: 'active' } }),
        context.user,
      );
      // Pre-recorded reference is the technical name 'status'; the persisted displayName 'Status'
      // is resolved from the schema, not received on the wire.
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionParams: { displayName: 'Status', name: 'status', value: 'active' },
        }),
      );
    });

    it('still goes through awaiting-input when executionType is not FullyAutomated', async () => {
      const mockModel = makeMockModel();
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        runStore,
        stepDefinition: makeStep({
          preRecordedArgs: { fieldName: 'status', value: 'active' },
        }),
      });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('awaiting-input');
      expect(mockModel.bindTools).not.toHaveBeenCalled();
      // displayName 'Status' is resolved from the schema even though only the technical name was sent.
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          pendingData: { displayName: 'Status', name: 'status', value: 'active' },
        }),
      );
    });

    it('returns error when a pre-recorded fieldName does not resolve', async () => {
      const context = makeContext({
        stepDefinition: makeStep({
          executionType: StepExecutionMode.FullyAutomated,
          preRecordedArgs: { fieldName: 'does_not_exist', value: 'x' },
        }),
      });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
    });

    it('falls back to AI when preRecordedArgs has no fieldName', async () => {
      const mockModel = makeMockModel({
        input: { fieldName: 'Status', value: 'active', reasoning: 'r' },
      });
      const context = makeContext({
        model: mockModel.model,
        stepDefinition: makeStep({
          executionType: StepExecutionMode.FullyAutomated,
          preRecordedArgs: { selectedRecordStepIndex: 0 },
        }),
      });
      const executor = new UpdateRecordStepExecutor(context);

      await executor.execute();

      expect(mockModel.bindTools).toHaveBeenCalledTimes(1);
    });

    it('returns error when fieldName is provided without value', async () => {
      const context = makeContext({
        stepDefinition: makeStep({
          executionType: StepExecutionMode.FullyAutomated,
          preRecordedArgs: { fieldName: 'status' },
        }),
      });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
    });

    it('returns error when value is provided without fieldName', async () => {
      const context = makeContext({
        stepDefinition: makeStep({
          executionType: StepExecutionMode.FullyAutomated,
          preRecordedArgs: { value: 'active' },
        }),
      });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
    });

    it('accepts non-string pre-recorded value (Number) and passes it through to updateRecord', async () => {
      const runStore = makeMockRunStore();
      const workflowPort = makeMockWorkflowPort({
        customers: makeCollectionSchema({
          fields: [{ fieldName: 'age', displayName: 'Age', isRelationship: false, type: 'Number' }],
        }),
      });
      const agentPort = makeMockAgentPort();
      const context = makeContext({
        runStore,
        workflowPort,
        agentPort,
        stepDefinition: makeStep({
          executionType: StepExecutionMode.FullyAutomated,
          preRecordedArgs: { fieldName: 'age', value: 42 },
        }),
      });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(agentPort.updateRecord).toHaveBeenCalledWith(
        expect.objectContaining({ values: { age: 42 } }),
        context.user,
      );
    });

    it('resolves a pre-recorded technical name to its own field, not another field whose displayName collides', async () => {
      const runStore = makeMockRunStore();
      // Field B's displayName ('status') equals field A's technical fieldName ('status').
      // A pre-recorded technical name must resolve field A, never field B.
      const workflowPort = makeMockWorkflowPort({
        customers: makeCollectionSchema({
          fields: [
            {
              fieldName: 'status',
              displayName: 'Internal Note',
              isRelationship: false,
              type: 'String',
            },
            { fieldName: 'note', displayName: 'status', isRelationship: false, type: 'String' },
          ],
        }),
      });
      const agentPort = makeMockAgentPort();
      const context = makeContext({
        runStore,
        workflowPort,
        agentPort,
        stepDefinition: makeStep({
          executionType: StepExecutionMode.FullyAutomated,
          preRecordedArgs: { fieldName: 'status', value: 'active' },
        }),
      });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      // Writes field A ('status'), not field B ('note' / displayName 'status').
      expect(agentPort.updateRecord).toHaveBeenCalledWith(
        expect.objectContaining({ values: { status: 'active' } }),
        context.user,
      );
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionParams: { displayName: 'Internal Note', name: 'status', value: 'active' },
        }),
      );
    });
  });

  describe('buildUpdateFieldTool — type-specific schemas', () => {
    async function getToolSchema(fields: CollectionSchema['fields']) {
      const mockModel = makeMockModel({
        input: { fieldName: fields[0].displayName, value: null, reasoning: 'r' },
      });
      const workflowPort = makeMockWorkflowPort({
        customers: makeCollectionSchema({ fields }),
      });
      const context = makeContext({ model: mockModel.model, workflowPort });
      const executor = new UpdateRecordStepExecutor(context);
      await executor.execute();
      const lastCall = mockModel.bindTools.mock.calls[mockModel.bindTools.mock.calls.length - 1];

      return lastCall[0][0].schema;
    }

    it('Boolean: accepts true/false and coerces string "true"/"false"', async () => {
      const schema = await getToolSchema([
        { fieldName: 'active', displayName: 'Active', isRelationship: false, type: 'Boolean' },
      ]);

      expect(
        schema.parse({ input: { fieldName: 'Active', value: true, reasoning: 'r' } }).input.value,
      ).toBe(true);
      expect(
        schema.parse({ input: { fieldName: 'Active', value: 'true', reasoning: 'r' } }).input.value,
      ).toBe(true);
      expect(
        schema.parse({ input: { fieldName: 'Active', value: false, reasoning: 'r' } }).input.value,
      ).toBe(false);
      expect(() =>
        schema.parse({ input: { fieldName: 'Active', value: 'maybe', reasoning: 'r' } }),
      ).toThrow();
    });

    it('Date: accepts ISO 8601 datetime, rejects date-only string', async () => {
      const schema = await getToolSchema([
        { fieldName: 'created_at', displayName: 'Created At', isRelationship: false, type: 'Date' },
      ]);

      expect(
        schema.parse({
          input: { fieldName: 'Created At', value: '2024-06-01T00:00:00Z', reasoning: 'r' },
        }).input.value,
      ).toBe('2024-06-01T00:00:00Z');
      expect(() =>
        schema.parse({ input: { fieldName: 'Created At', value: '2024-06-01', reasoning: 'r' } }),
      ).toThrow();
      expect(() =>
        schema.parse({ input: { fieldName: 'Created At', value: 'not-a-date', reasoning: 'r' } }),
      ).toThrow();
    });

    it('Dateonly: accepts ISO 8601 date, rejects datetime and free text', async () => {
      const schema = await getToolSchema([
        {
          fieldName: 'birth_date',
          displayName: 'Birth Date',
          isRelationship: false,
          type: 'Dateonly',
        },
      ]);

      expect(
        schema.parse({ input: { fieldName: 'Birth Date', value: '2024-06-01', reasoning: 'r' } })
          .input.value,
      ).toBe('2024-06-01');
      expect(() =>
        schema.parse({ input: { fieldName: 'Birth Date', value: 'not-a-date', reasoning: 'r' } }),
      ).toThrow();
      // datetime string must be rejected — Dateonly only accepts date-only format
      expect(() =>
        schema.parse({
          input: { fieldName: 'Birth Date', value: '2024-06-01T00:00:00Z', reasoning: 'r' },
        }),
      ).toThrow();
    });

    it('Number: coerces string "42" to 42', async () => {
      const schema = await getToolSchema([
        { fieldName: 'age', displayName: 'Age', isRelationship: false, type: 'Number' },
      ]);

      expect(
        schema.parse({ input: { fieldName: 'Age', value: 42, reasoning: 'r' } }).input.value,
      ).toBe(42);
      expect(
        schema.parse({ input: { fieldName: 'Age', value: '42', reasoning: 'r' } }).input.value,
      ).toBe(42);
      expect(() =>
        schema.parse({ input: { fieldName: 'Age', value: 'not-a-number', reasoning: 'r' } }),
      ).toThrow();
    });

    it('Enum: accepts valid enum values, rejects unknown ones', async () => {
      const schema = await getToolSchema([
        {
          fieldName: 'status',
          displayName: 'Status',
          isRelationship: false,
          type: 'Enum',
          enumValues: ['active', 'inactive', 'pending'],
        },
      ]);

      expect(
        schema.parse({ input: { fieldName: 'Status', value: 'active', reasoning: 'r' } }).input
          .value,
      ).toBe('active');
      expect(() =>
        schema.parse({ input: { fieldName: 'Status', value: 'unknown', reasoning: 'r' } }),
      ).toThrow();
    });

    it('Enum with single enumValue: only accepts the one literal', async () => {
      const schema = await getToolSchema([
        {
          fieldName: 'flag',
          displayName: 'Flag',
          isRelationship: false,
          type: 'Enum',
          enumValues: ['only'],
        },
      ]);

      expect(
        schema.parse({ input: { fieldName: 'Flag', value: 'only', reasoning: 'r' } }).input.value,
      ).toBe('only');
      expect(() =>
        schema.parse({ input: { fieldName: 'Flag', value: 'other', reasoning: 'r' } }),
      ).toThrow();
    });

    it('Enum with no enumValues: falls back to any string', async () => {
      const schema = await getToolSchema([
        {
          fieldName: 'tag',
          displayName: 'Tag',
          isRelationship: false,
          type: 'Enum',
          enumValues: [],
        },
      ]);

      expect(
        schema.parse({ input: { fieldName: 'Tag', value: 'anything', reasoning: 'r' } }).input
          .value,
      ).toBe('anything');
    });

    it('Json: accepts valid JSON string, rejects non-JSON', async () => {
      const schema = await getToolSchema([
        { fieldName: 'metadata', displayName: 'Metadata', isRelationship: false, type: 'Json' },
      ]);

      expect(
        schema.parse({ input: { fieldName: 'Metadata', value: '{"key":"val"}', reasoning: 'r' } })
          .input.value,
      ).toBe('{"key":"val"}');
      expect(() =>
        schema.parse({ input: { fieldName: 'Metadata', value: 'not json', reasoning: 'r' } }),
      ).toThrow();
    });

    it('Point: accepts [longitude, latitude] array, rejects wrong length', async () => {
      const schema = await getToolSchema([
        { fieldName: 'location', displayName: 'Location', isRelationship: false, type: 'Point' },
      ]);

      expect(
        schema.parse({ input: { fieldName: 'Location', value: [-0.5, 44.8], reasoning: 'r' } })
          .input.value,
      ).toEqual([-0.5, 44.8]);
      expect(() =>
        schema.parse({ input: { fieldName: 'Location', value: [1], reasoning: 'r' } }),
      ).toThrow();
    });

    it('String/Uuid/Time/File (default): accepts any string', async () => {
      const schemas = await Promise.all(
        (['String', 'Uuid', 'Time', 'File'] as const).map(type =>
          getToolSchema([{ fieldName: 'f', displayName: 'F', isRelationship: false, type }]),
        ),
      );

      for (const schema of schemas) {
        expect(
          schema.parse({ input: { fieldName: 'F', value: 'anything', reasoning: 'r' } }).input
            .value,
        ).toBe('anything');
      }
    });

    it('type [File]: accepts array of strings', async () => {
      const schema = await getToolSchema([
        {
          fieldName: 'attachments',
          displayName: 'Attachments',
          isRelationship: false,
          type: ['File'],
        },
      ]);

      expect(
        schema.parse({
          input: { fieldName: 'Attachments', value: ['file1.pdf', 'file2.pdf'], reasoning: 'r' },
        }).input.value,
      ).toEqual(['file1.pdf', 'file2.pdf']);
      expect(() =>
        schema.parse({
          input: { fieldName: 'Attachments', value: 'not-an-array', reasoning: 'r' },
        }),
      ).toThrow();
    });

    it('any field: accepts null value', async () => {
      const schema = await getToolSchema([
        { fieldName: 'name', displayName: 'Name', isRelationship: false, type: 'String' },
      ]);

      expect(
        schema.parse({ input: { fieldName: 'Name', value: null, reasoning: 'r' } }).input.value,
      ).toBeNull();
    });

    it('type [[String]] (nested array): treats as array of JSON strings', async () => {
      const schema = await getToolSchema([
        {
          fieldName: 'data',
          displayName: 'Data',
          isRelationship: false,
          type: [['String']] as unknown as ['String'],
        },
      ]);

      expect(
        schema.parse({
          input: { fieldName: 'Data', value: ['{"a":1}', '{"b":2}'], reasoning: 'r' },
        }).input.value,
      ).toEqual(['{"a":1}', '{"b":2}']);
      expect(() =>
        schema.parse({ input: { fieldName: 'Data', value: ['not json'], reasoning: 'r' } }),
      ).toThrow();
    });

    it('root schema is ZodObject (not union) — satisfies OpenAI type:object requirement', async () => {
      const schema = await getToolSchema([
        { fieldName: 'status', displayName: 'Status', isRelationship: false, type: 'String' },
        { fieldName: 'name', displayName: 'Name', isRelationship: false, type: 'String' },
      ]);

      expect(schema.constructor.name).toBe('ZodObject');
    });

    it('multi-field: both variants accepted under input wrapper, flat payload rejected', async () => {
      const schema = await getToolSchema([
        { fieldName: 'status', displayName: 'Status', isRelationship: false, type: 'String' },
        { fieldName: 'count', displayName: 'Count', isRelationship: false, type: 'Number' },
      ]);

      expect(
        schema.parse({ input: { fieldName: 'Status', value: 'active', reasoning: 'r' } }).input
          .value,
      ).toBe('active');
      expect(
        schema.parse({ input: { fieldName: 'Count', value: '5', reasoning: 'r' } }).input.value,
      ).toBe(5);
      expect(() =>
        schema.parse({ fieldName: 'Status', value: 'active', reasoning: 'r' }),
      ).toThrow();
    });
  });

  describe('patchAndReloadPendingData validation', () => {
    it('returns error when incomingPendingData fails Zod validation', async () => {
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([
          {
            type: 'update-record',
            stepIndex: 0,
            pendingData: { displayName: 'Status', name: 'status', value: 'active' },
            selectedRecordRef: makeRecordRef(),
          },
        ]),
      });

      const context = makeContext({
        runStore,
        incomingPendingData: { invalidField: true },
      });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
    });
  });

  describe('idempotency', () => {
    it('returns success without re-executing or emitting activity log when idempotencyPhase is done', async () => {
      const agentPort = makeMockAgentPort();
      const activityLogPort = {
        createPending: jest.fn().mockResolvedValue({ id: 'log-1', index: '0' }),
        markSucceeded: jest.fn().mockResolvedValue(undefined),
        markFailed: jest.fn().mockResolvedValue(undefined),
      };
      const doneExecution: UpdateRecordStepExecutionData = {
        type: 'update-record',
        stepIndex: 0,
        executionParams: { displayName: 'Status', name: 'status', value: 'active' },
        executionResult: { updatedValues: { status: 'active' } },
        selectedRecordRef: makeRecordRef(),
        idempotencyPhase: 'done',
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([doneExecution]),
      });
      const context = makeContext({ agentPort, runStore, activityLogPort });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(agentPort.updateRecord).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
      expect(activityLogPort.createPending).not.toHaveBeenCalled();
    });

    it('returns error without activity log when idempotencyPhase is executing', async () => {
      const agentPort = makeMockAgentPort();
      const activityLogPort = {
        createPending: jest.fn().mockResolvedValue({ id: 'log-1', index: '0' }),
        markSucceeded: jest.fn().mockResolvedValue(undefined),
        markFailed: jest.fn().mockResolvedValue(undefined),
      };
      const executingExecution: UpdateRecordStepExecutionData = {
        type: 'update-record',
        stepIndex: 0,
        selectedRecordRef: makeRecordRef(),
        idempotencyPhase: 'executing',
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([executingExecution]),
      });
      const context = makeContext({ agentPort, runStore, activityLogPort });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'An unexpected error occurred while processing this step.',
      );
      expect(agentPort.updateRecord).not.toHaveBeenCalled();
      expect(activityLogPort.createPending).not.toHaveBeenCalled();
    });

    it('saves executing marker before side effect and done marker with executionResult after', async () => {
      const updatedValues = { status: 'active' };
      const agentPort = makeMockAgentPort(updatedValues);
      const runStore = makeMockRunStore();
      const mockModel = makeMockModel({
        input: { fieldName: 'Status', value: 'active', reasoning: 'test' },
      });
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        runStore,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
      const executor = new UpdateRecordStepExecutor(context);

      await executor.execute();

      const { calls } = (runStore.saveStepExecution as jest.Mock).mock;
      expect(calls).toHaveLength(2);
      expect(calls[0][1]).toMatchObject({
        type: 'update-record',
        stepIndex: 0,
        idempotencyPhase: 'executing',
      });
      expect(calls[0][1]).not.toHaveProperty('executionResult');
      expect(calls[1][1]).toMatchObject({
        type: 'update-record',
        stepIndex: 0,
        idempotencyPhase: 'done',
        executionResult: { updatedValues },
      });
    });
  });

  describe('confirmation value coercion (Branch A)', () => {
    // Build a confirmation execution targeting `field` with a given pendingData/userConfirmation value.
    function makeCoercionContext(
      field: CollectionSchema['fields'][number],
      pendingValue: unknown,
      userConfirmation: { userConfirmed: boolean; value?: unknown },
      agentPort = makeMockAgentPort({ [field.fieldName]: pendingValue }),
    ) {
      const schema = makeCollectionSchema({ fields: [field] });
      const execution: UpdateRecordStepExecutionData = {
        type: 'update-record',
        stepIndex: 0,
        pendingData: { displayName: field.displayName, name: field.fieldName, value: pendingValue },
        userConfirmation,
        selectedRecordRef: makeRecordRef(),
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const context = makeContext({
        agentPort,
        runStore,
        workflowPort: makeMockWorkflowPort({ customers: schema }),
      });

      return { executor: new UpdateRecordStepExecutor(context), agentPort };
    }

    const booleanField = {
      fieldName: 'isActive',
      displayName: 'Is Active',
      isRelationship: false,
      type: 'Boolean' as const,
    };
    const numberArrayField = {
      fieldName: 'scores',
      displayName: 'Scores',
      isRelationship: false,
      type: ['Number'] as ['Number'],
    };
    const stringArrayField = {
      fieldName: 'tags',
      displayName: 'Tags',
      isRelationship: false,
      type: ['String'] as ['String'],
    };
    const enumArrayField = {
      fieldName: 'colors',
      displayName: 'Colors',
      isRelationship: false,
      type: ['Enum'] as ['Enum'],
      enumValues: ['red', 'green', 'blue'],
    };

    it('coerces a native boolean user override', async () => {
      const { executor, agentPort } = makeCoercionContext(booleanField, null, {
        userConfirmed: true,
        value: true,
      });

      await executor.execute();

      expect(agentPort.updateRecord).toHaveBeenCalledWith(
        { collection: 'customers', id: [42], values: { isActive: true } },
        expect.objectContaining({ id: 1 }),
      );
    });

    it('coerces "true"/"false" string overrides to booleans', async () => {
      const t = makeCoercionContext(booleanField, null, { userConfirmed: true, value: 'true' });
      await t.executor.execute();
      expect(t.agentPort.updateRecord).toHaveBeenCalledWith(
        { collection: 'customers', id: [42], values: { isActive: true } },
        expect.objectContaining({ id: 1 }),
      );

      const f = makeCoercionContext(booleanField, null, { userConfirmed: true, value: 'false' });
      await f.executor.execute();
      expect(f.agentPort.updateRecord).toHaveBeenCalledWith(
        { collection: 'customers', id: [42], values: { isActive: false } },
        expect.objectContaining({ id: 1 }),
      );
    });

    it('coerces a [Number] array of numeric strings to numbers', async () => {
      const { executor, agentPort } = makeCoercionContext(numberArrayField, null, {
        userConfirmed: true,
        value: ['1', '2'],
      });

      await executor.execute();

      expect(agentPort.updateRecord).toHaveBeenCalledWith(
        { collection: 'customers', id: [42], values: { scores: [1, 2] } },
        expect.objectContaining({ id: 1 }),
      );
    });

    it('keeps a native [Number] array unchanged', async () => {
      const { executor, agentPort } = makeCoercionContext(numberArrayField, null, {
        userConfirmed: true,
        value: [1, 2],
      });

      await executor.execute();

      expect(agentPort.updateRecord).toHaveBeenCalledWith(
        { collection: 'customers', id: [42], values: { scores: [1, 2] } },
        expect.objectContaining({ id: 1 }),
      );
    });

    it('keeps a [String] array unchanged', async () => {
      const { executor, agentPort } = makeCoercionContext(stringArrayField, null, {
        userConfirmed: true,
        value: ['a', 'b'],
      });

      await executor.execute();

      expect(agentPort.updateRecord).toHaveBeenCalledWith(
        { collection: 'customers', id: [42], values: { tags: ['a', 'b'] } },
        expect.objectContaining({ id: 1 }),
      );
    });

    it('accepts a valid [Enum] array', async () => {
      const { executor, agentPort } = makeCoercionContext(enumArrayField, null, {
        userConfirmed: true,
        value: ['red', 'blue'],
      });

      await executor.execute();

      expect(agentPort.updateRecord).toHaveBeenCalledWith(
        { collection: 'customers', id: [42], values: { colors: ['red', 'blue'] } },
        expect.objectContaining({ id: 1 }),
      );
    });

    it('coerces a numeric string to a number (non-regression)', async () => {
      const numberField = {
        fieldName: 'age',
        displayName: 'Age',
        isRelationship: false,
        type: 'Number' as const,
      };
      const { executor, agentPort } = makeCoercionContext(numberField, null, {
        userConfirmed: true,
        value: '42',
      });

      await executor.execute();

      expect(agentPort.updateRecord).toHaveBeenCalledWith(
        { collection: 'customers', id: [42], values: { age: 42 } },
        expect.objectContaining({ id: 1 }),
      );
    });

    it('leaves an ISO datetime string unchanged (non-regression)', async () => {
      const dateField = {
        fieldName: 'createdAt',
        displayName: 'Created At',
        isRelationship: false,
        type: 'Date' as const,
      };
      const { executor, agentPort } = makeCoercionContext(dateField, null, {
        userConfirmed: true,
        value: '2026-05-28T00:00:00.000Z',
      });

      await executor.execute();

      expect(agentPort.updateRecord).toHaveBeenCalledWith(
        { collection: 'customers', id: [42], values: { createdAt: '2026-05-28T00:00:00.000Z' } },
        expect.objectContaining({ id: 1 }),
      );
    });

    it('fails with a StepStateError on coercion mismatch without updating', async () => {
      const { executor, agentPort } = makeCoercionContext(numberArrayField, null, {
        userConfirmed: true,
        value: ['abc'],
      });

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'An unexpected error occurred while processing this step.',
      );
      expect(agentPort.updateRecord).not.toHaveBeenCalled();
    });

    it('coerces the AI/preRecordedArg value when the user confirms without overriding', async () => {
      // pendingData.value is a raw "true" string (e.g. from preRecordedArgs); no user override.
      const { executor, agentPort } = makeCoercionContext(booleanField, 'true', {
        userConfirmed: true,
      });

      await executor.execute();

      expect(agentPort.updateRecord).toHaveBeenCalledWith(
        { collection: 'customers', id: [42], values: { isActive: true } },
        expect.objectContaining({ id: 1 }),
      );
    });

    it('passes a null override through without coercion (field clear)', async () => {
      const { executor, agentPort } = makeCoercionContext(booleanField, true, {
        userConfirmed: true,
        value: null,
      });

      await executor.execute();

      expect(agentPort.updateRecord).toHaveBeenCalledWith(
        { collection: 'customers', id: [42], values: { isActive: null } },
        expect.objectContaining({ id: 1 }),
      );
    });

    it('passes the value through unchanged when the field type is null (relationship)', async () => {
      const nullTypeField = {
        fieldName: 'orders',
        displayName: 'Orders',
        isRelationship: true,
        type: null,
      };
      const opaque = { some: 'object' };
      const { executor, agentPort } = makeCoercionContext(nullTypeField, null, {
        userConfirmed: true,
        value: opaque,
      });

      await executor.execute();

      expect(agentPort.updateRecord).toHaveBeenCalledWith(
        { collection: 'customers', id: [42], values: { orders: opaque } },
        expect.objectContaining({ id: 1 }),
      );
    });

    it('fails the step when overriding a non-relationship field that has no type', async () => {
      const typelessField = { fieldName: 'age', displayName: 'Age', isRelationship: false };
      const { executor, agentPort } = makeCoercionContext(typelessField, null, {
        userConfirmed: true,
        value: '42',
      });

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        "This field can't be updated because its type is missing from the schema. " +
          'Contact your administrator if the problem persists.',
      );
      expect(agentPort.updateRecord).not.toHaveBeenCalled();
    });
  });
});
