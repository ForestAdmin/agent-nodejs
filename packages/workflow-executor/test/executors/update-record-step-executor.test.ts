import type { AgentPort } from '../../src/ports/agent-port';
import type { RunStore } from '../../src/ports/run-store';
import type { WorkflowPort } from '../../src/ports/workflow-port';
import type { ExecutionContext } from '../../src/types/execution';
import type { CollectionSchema, RecordRef } from '../../src/types/record';
import type { UpdateRecordStepDefinition } from '../../src/types/step-definition';
import type { UpdateRecordStepExecutionData } from '../../src/types/step-execution-data';

import SafeAgentPort from '../../src/adapters/safe-agent-port';
import { StepStateError } from '../../src/errors';
import UpdateRecordStepExecutor from '../../src/executors/update-record-step-executor';
import SchemaCache from '../../src/schema-cache';
import { StepType } from '../../src/types/step-definition';

function makeStep(overrides: Partial<UpdateRecordStepDefinition> = {}): UpdateRecordStepDefinition {
  return {
    type: StepType.UpdateRecord,
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
    collectionDisplayName: 'Customers',
    primaryKeyFields: ['id'],
    fields: [
      { fieldName: 'email', displayName: 'Email', isRelationship: false },
      { fieldName: 'status', displayName: 'Status', isRelationship: false },
      { fieldName: 'name', displayName: 'Full Name', isRelationship: false },
      { fieldName: 'orders', displayName: 'Orders', isRelationship: true },
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
    getPendingStepExecutions: jest.fn().mockResolvedValue({ pending: [], malformed: [] }),
    getPendingStepExecutionsForRun: jest.fn().mockResolvedValue(null),
    updateStepExecution: jest.fn().mockResolvedValue(undefined),
    getCollectionSchema: jest
      .fn()
      .mockImplementation((name: string) =>
        Promise.resolve(
          schemasByCollection[name] ?? makeCollectionSchema({ collectionName: name }),
        ),
      ),
    getMcpServerConfigs: jest.fn().mockResolvedValue([]),
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
  overrides: Partial<ExecutionContext<UpdateRecordStepDefinition>> = {},
): ExecutionContext<UpdateRecordStepDefinition> {
  return {
    runId: 'run-1',
    stepId: 'update-1',
    stepIndex: 0,
    baseRecordRef: makeRecordRef(),
    stepDefinition: makeStep(),
    model: makeMockModel({
      fieldName: 'Status',
      value: 'active',
      reasoning: 'User requested status change',
    }).model,
    agentPort: makeMockAgentPort(),
    workflowPort: makeMockWorkflowPort(),
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
    forestServerToken: 'test-forest-token',
    activityLogPort: {
      createPending: jest.fn().mockResolvedValue({ id: 'log-1', index: '0' }),
      markSucceeded: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
      drain: jest.fn().mockResolvedValue(undefined),
    },
    ...overrides,
  };
}

describe('UpdateRecordStepExecutor', () => {
  describe('automaticExecution: update direct (Branch B)', () => {
    it('updates the record and returns success', async () => {
      const updatedValues = { status: 'active', name: 'John Doe' };
      const agentPort = makeMockAgentPort(updatedValues);
      const mockModel = makeMockModel({
        fieldName: 'Status',
        value: 'active',
        reasoning: 'User requested status change',
      });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        runStore,
        stepDefinition: makeStep({ automaticExecution: true }),
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

  describe('without automaticExecution: awaiting-input (Branch C)', () => {
    it('saves execution and returns awaiting-input', async () => {
      const mockModel = makeMockModel({
        fieldName: 'Status',
        value: 'active',
        reasoning: 'User requested status change',
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
          userConfirmed: true,
        },
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
            userConfirmed: true,
          },
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
          userConfirmed: false,
        },
        selectedRecordRef: makeRecordRef(),
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const context = makeContext({ agentPort, runStore });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(agentPort.updateRecord).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionResult: { skipped: true },
          pendingData: {
            displayName: 'Status',
            name: 'status',
            value: 'active',
            userConfirmed: false,
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
          { fieldName: 'total', displayName: 'Total', isRelationship: false },
          { fieldName: 'status', displayName: 'Order Status', isRelationship: false },
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
              args: { fieldName: 'Order Status', value: 'shipped', reasoning: 'Mark as shipped' },
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
      const context = makeContext({ baseRecordRef, model, runStore, workflowPort });
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
        fields: [{ fieldName: 'orders', displayName: 'Orders', isRelationship: true }],
      });
      const mockModel = makeMockModel({
        fieldName: 'Status',
        value: 'active',
        reasoning: 'test',
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

  describe('resolveFieldName failure', () => {
    it('returns error when field is not found during automaticExecution (Branch B)', async () => {
      // AI returns a display name that doesn't match any field in the schema
      const mockModel = makeMockModel({
        fieldName: 'NonExistentField',
        value: 'test',
        reasoning: 'test',
      });
      const context = makeContext({
        model: mockModel.model,
        stepDefinition: makeStep({ automaticExecution: true }),
      });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        "The AI selected a field that doesn't exist on this record. Try rephrasing the step's prompt.",
      );
    });
  });

  describe('relationship fields excluded from update tool', () => {
    it('excludes relationship fields from the tool schema', async () => {
      const mockModel = makeMockModel({
        fieldName: 'Status',
        value: 'active',
        reasoning: 'test',
      });
      const context = makeContext({ model: mockModel.model });
      const executor = new UpdateRecordStepExecutor(context);

      await executor.execute();

      // Second bindTools call is for update-record-field (first may be select-record)
      const lastCall = mockModel.bindTools.mock.calls[mockModel.bindTools.mock.calls.length - 1];
      const tool = lastCall[0][0];
      expect(tool.name).toBe('update-record-field');

      // Non-relationship display names should be accepted
      expect(tool.schema.parse({ fieldName: 'Email', value: 'x', reasoning: 'r' })).toBeTruthy();
      expect(tool.schema.parse({ fieldName: 'Status', value: 'x', reasoning: 'r' })).toBeTruthy();
      expect(
        tool.schema.parse({ fieldName: 'Full Name', value: 'x', reasoning: 'r' }),
      ).toBeTruthy();

      // Relationship display name should be rejected
      expect(() =>
        tool.schema.parse({ fieldName: 'Orders', value: 'x', reasoning: 'r' }),
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
        fieldName: 'Status',
        value: 'active',
        reasoning: 'test',
      });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        runStore,
        stepDefinition: makeStep({ automaticExecution: true }),
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
          userConfirmed: true,
        },
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
        fieldName: 'Status',
        value: 'active',
        reasoning: 'test',
      });
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        stepDefinition: makeStep({ automaticExecution: true }),
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
          userConfirmed: true,
        },
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
      const logger = { info: jest.fn(), error: jest.fn() };
      const rawAgentPort = makeMockAgentPort();
      (rawAgentPort.updateRecord as jest.Mock).mockRejectedValue(new Error('DB connection lost'));
      const agentPort = new SafeAgentPort(rawAgentPort);
      const mockModel = makeMockModel({
        fieldName: 'Status',
        value: 'active',
        reasoning: 'test',
      });
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        logger,
        stepDefinition: makeStep({ automaticExecution: true }),
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
      const context = makeContext({ stepDefinition: makeStep({ automaticExecution: true }) });
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
      const mockModel = makeMockModel({ fieldName: 'status', value: 'active', reasoning: 'test' });
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        stepDefinition: makeStep({ automaticExecution: true }),
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
        stepDefinition: makeStep({ automaticExecution: true }),
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
          userConfirmed: false,
        },
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
        saveStepExecution: jest.fn().mockRejectedValue(new Error('Disk full')),
      });
      const context = makeContext({
        runStore,
        stepDefinition: makeStep({ automaticExecution: true }),
      });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe('The step result could not be saved. Please retry.');
    });
  });

  describe('default prompt', () => {
    it('uses default prompt when step.prompt is undefined', async () => {
      const mockModel = makeMockModel({
        fieldName: 'Status',
        value: 'active',
        reasoning: 'test',
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
        fieldName: 'Status',
        value: 'active',
        reasoning: 'test',
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
      // context + previous steps summary + system prompt + collection info + human message = 5
      expect(messages).toHaveLength(5);
      expect(messages[0].content).toContain('Step executed by');
      expect(messages[1].content).toContain('Should we proceed?');
      expect(messages[1].content).toContain('"answer":"Yes"');
      expect(messages[2].content).toContain('updating a field on a record');
    });
  });

  describe('pre-recorded args', () => {
    it('skips AI field selection when fieldName and value are pre-recorded', async () => {
      const mockModel = makeMockModel();
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        runStore,
        stepDefinition: makeStep({
          automaticExecution: true,
          preRecordedArgs: { fieldDisplayName: 'Status', value: 'active' },
        }),
      });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(mockModel.bindTools).not.toHaveBeenCalled();
      expect(context.agentPort.updateRecord).toHaveBeenCalledWith(
        expect.objectContaining({ values: { status: 'active' } }),
        context.user,
      );
    });

    it('still goes through awaiting-input when automaticExecution is false', async () => {
      const mockModel = makeMockModel();
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        runStore,
        stepDefinition: makeStep({
          preRecordedArgs: { fieldDisplayName: 'Status', value: 'active' },
        }),
      });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('awaiting-input');
      expect(mockModel.bindTools).not.toHaveBeenCalled();
    });

    it('falls back to AI when preRecordedArgs has no fieldDisplayName', async () => {
      const mockModel = makeMockModel({ fieldName: 'Status', value: 'active', reasoning: 'r' });
      const context = makeContext({
        model: mockModel.model,
        stepDefinition: makeStep({
          automaticExecution: true,
          preRecordedArgs: { selectedRecordStepIndex: 0 },
        }),
      });
      const executor = new UpdateRecordStepExecutor(context);

      await executor.execute();

      expect(mockModel.bindTools).toHaveBeenCalledTimes(1);
    });

    it('returns error when fieldDisplayName is provided without value', async () => {
      const context = makeContext({
        stepDefinition: makeStep({
          automaticExecution: true,
          preRecordedArgs: { fieldDisplayName: 'Status' },
        }),
      });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
    });

    it('returns error when value is provided without fieldDisplayName', async () => {
      const context = makeContext({
        stepDefinition: makeStep({
          automaticExecution: true,
          preRecordedArgs: { value: 'active' },
        }),
      });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
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
});
