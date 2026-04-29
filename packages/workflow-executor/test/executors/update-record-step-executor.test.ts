import type { AgentPort } from '../../src/ports/agent-port';
import type { RunStore } from '../../src/ports/run-store';
import type { WorkflowPort } from '../../src/ports/workflow-port';
import type { ExecutionContext } from '../../src/types/execution-context';
import type { UpdateRecordStepExecutionData } from '../../src/types/step-execution-data';
import type { CollectionSchema, RecordRef } from '../../src/types/validated/collection';
import type { UpdateRecordStepDefinition } from '../../src/types/validated/step-definition';

import { AgentPortError, RunStorePortError, StepStateError } from '../../src/errors';
import UpdateRecordStepExecutor from '../../src/executors/update-record-step-executor';
import SchemaCache from '../../src/schema-cache';
import { StepType } from '../../src/types/validated/step-definition';

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
    collectionId: 'col-1',
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

    activityLogPort: {
      createPending: jest.fn().mockResolvedValue({ id: 'log-1', index: '0' }),
      markSucceeded: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
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
        fields: [{ fieldName: 'orders', displayName: 'Orders', isRelationship: true, type: null }],
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

      // Each non-relationship field is a literal in the union — exact displayName required
      expect(tool.schema.parse({ fieldName: 'Email', value: 'x', reasoning: 'r' })).toBeTruthy();
      expect(tool.schema.parse({ fieldName: 'Status', value: 'x', reasoning: 'r' })).toBeTruthy();
      expect(
        tool.schema.parse({ fieldName: 'Full Name', value: 'x', reasoning: 'r' }),
      ).toBeTruthy();

      // Relationship display name rejected — no union variant has fieldName 'Orders'
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
      const agentPort = makeMockAgentPort();
      (agentPort.updateRecord as jest.Mock).mockRejectedValue(
        new AgentPortError('updateRecord', new Error('DB connection lost')),
      );
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
        saveStepExecution: jest
          .fn()
          .mockRejectedValue(new RunStorePortError('saveStepExecution', new Error('Disk full'))),
      });
      const context = makeContext({
        runStore,
        stepDefinition: makeStep({ automaticExecution: true }),
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

    it('accepts non-string pre-recorded value (Number) and passes it through to updateRecord', async () => {
      const runStore = makeMockRunStore();
      const workflowPort = makeMockWorkflowPort({
        customers: makeCollectionSchema({
          fields: [{ fieldName: 'age', displayName: 'Age', isRelationship: false, type: 'Number' }],
        }),
      });
      const context = makeContext({
        runStore,
        workflowPort,
        stepDefinition: makeStep({
          automaticExecution: true,
          preRecordedArgs: { fieldDisplayName: 'Age', value: 42 },
        }),
      });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(context.agentPort.updateRecord).toHaveBeenCalledWith(
        expect.objectContaining({ values: { age: 42 } }),
        context.user,
      );
    });
  });

  describe('buildUpdateFieldTool — type-specific schemas', () => {
    async function getToolSchema(fields: CollectionSchema['fields']) {
      const mockModel = makeMockModel({
        fieldName: fields[0].displayName,
        value: null,
        reasoning: 'r',
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

      expect(schema.parse({ fieldName: 'Active', value: true, reasoning: 'r' }).value).toBe(true);
      expect(schema.parse({ fieldName: 'Active', value: 'true', reasoning: 'r' }).value).toBe(true);
      expect(schema.parse({ fieldName: 'Active', value: false, reasoning: 'r' }).value).toBe(false);
      expect(() => schema.parse({ fieldName: 'Active', value: 'maybe', reasoning: 'r' })).toThrow();
    });

    it('Date: accepts ISO 8601 datetime, rejects date-only string', async () => {
      const schema = await getToolSchema([
        { fieldName: 'created_at', displayName: 'Created At', isRelationship: false, type: 'Date' },
      ]);

      expect(
        schema.parse({ fieldName: 'Created At', value: '2024-06-01T00:00:00Z', reasoning: 'r' })
          .value,
      ).toBe('2024-06-01T00:00:00Z');
      expect(() =>
        schema.parse({ fieldName: 'Created At', value: '2024-06-01', reasoning: 'r' }),
      ).toThrow();
      expect(() =>
        schema.parse({ fieldName: 'Created At', value: 'not-a-date', reasoning: 'r' }),
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
        schema.parse({ fieldName: 'Birth Date', value: '2024-06-01', reasoning: 'r' }).value,
      ).toBe('2024-06-01');
      expect(() =>
        schema.parse({ fieldName: 'Birth Date', value: 'not-a-date', reasoning: 'r' }),
      ).toThrow();
      // datetime string must be rejected — Dateonly only accepts date-only format
      expect(() =>
        schema.parse({ fieldName: 'Birth Date', value: '2024-06-01T00:00:00Z', reasoning: 'r' }),
      ).toThrow();
    });

    it('Number: coerces string "42" to 42', async () => {
      const schema = await getToolSchema([
        { fieldName: 'age', displayName: 'Age', isRelationship: false, type: 'Number' },
      ]);

      expect(schema.parse({ fieldName: 'Age', value: 42, reasoning: 'r' }).value).toBe(42);
      expect(schema.parse({ fieldName: 'Age', value: '42', reasoning: 'r' }).value).toBe(42);
      expect(() =>
        schema.parse({ fieldName: 'Age', value: 'not-a-number', reasoning: 'r' }),
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

      expect(schema.parse({ fieldName: 'Status', value: 'active', reasoning: 'r' }).value).toBe(
        'active',
      );
      expect(() =>
        schema.parse({ fieldName: 'Status', value: 'unknown', reasoning: 'r' }),
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

      expect(schema.parse({ fieldName: 'Flag', value: 'only', reasoning: 'r' }).value).toBe('only');
      expect(() => schema.parse({ fieldName: 'Flag', value: 'other', reasoning: 'r' })).toThrow();
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

      expect(schema.parse({ fieldName: 'Tag', value: 'anything', reasoning: 'r' }).value).toBe(
        'anything',
      );
    });

    it('Json: accepts valid JSON string, rejects non-JSON', async () => {
      const schema = await getToolSchema([
        { fieldName: 'metadata', displayName: 'Metadata', isRelationship: false, type: 'Json' },
      ]);

      expect(
        schema.parse({ fieldName: 'Metadata', value: '{"key":"val"}', reasoning: 'r' }).value,
      ).toBe('{"key":"val"}');
      expect(() =>
        schema.parse({ fieldName: 'Metadata', value: 'not json', reasoning: 'r' }),
      ).toThrow();
    });

    it('Point: accepts [longitude, latitude] array, rejects wrong length', async () => {
      const schema = await getToolSchema([
        { fieldName: 'location', displayName: 'Location', isRelationship: false, type: 'Point' },
      ]);

      expect(
        schema.parse({ fieldName: 'Location', value: [-0.5, 44.8], reasoning: 'r' }).value,
      ).toEqual([-0.5, 44.8]);
      expect(() => schema.parse({ fieldName: 'Location', value: [1], reasoning: 'r' })).toThrow();
    });

    it('String/Uuid/Time/File (default): accepts any string', async () => {
      const schemas = await Promise.all(
        (['String', 'Uuid', 'Time', 'File'] as const).map(type =>
          getToolSchema([{ fieldName: 'f', displayName: 'F', isRelationship: false, type }]),
        ),
      );

      for (const schema of schemas) {
        expect(schema.parse({ fieldName: 'F', value: 'anything', reasoning: 'r' }).value).toBe(
          'anything',
        );
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
          fieldName: 'Attachments',
          value: ['file1.pdf', 'file2.pdf'],
          reasoning: 'r',
        }).value,
      ).toEqual(['file1.pdf', 'file2.pdf']);
      expect(() =>
        schema.parse({ fieldName: 'Attachments', value: 'not-an-array', reasoning: 'r' }),
      ).toThrow();
    });

    it('any field: accepts null value', async () => {
      const schema = await getToolSchema([
        { fieldName: 'name', displayName: 'Name', isRelationship: false, type: 'String' },
      ]);

      expect(schema.parse({ fieldName: 'Name', value: null, reasoning: 'r' }).value).toBeNull();
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
        schema.parse({ fieldName: 'Data', value: ['{"a":1}', '{"b":2}'], reasoning: 'r' }).value,
      ).toEqual(['{"a":1}', '{"b":2}']);
      expect(() =>
        schema.parse({ fieldName: 'Data', value: ['not json'], reasoning: 'r' }),
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
        fieldName: 'Status',
        value: 'active',
        reasoning: 'test',
      });
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        runStore,
        stepDefinition: makeStep({ automaticExecution: true }),
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
});
