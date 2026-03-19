import type { AgentPort } from '../../src/ports/agent-port';
import type { RunStore } from '../../src/ports/run-store';
import type { WorkflowPort } from '../../src/ports/workflow-port';
import type { ExecutionContext, UserInput } from '../../src/types/execution';
import type { CollectionSchema, RecordRef } from '../../src/types/record';
import type { AiTaskStepDefinition } from '../../src/types/step-definition';
import type { UpdateRecordStepExecutionData } from '../../src/types/step-execution-data';

import { WorkflowExecutorError } from '../../src/errors';
import UpdateRecordStepExecutor from '../../src/executors/update-record-step-executor';
import { StepType } from '../../src/types/step-definition';

function makeStep(overrides: Partial<AiTaskStepDefinition> = {}): AiTaskStepDefinition {
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
    getPendingStepExecutions: jest.fn().mockResolvedValue([]),
    updateStepExecution: jest.fn().mockResolvedValue(undefined),
    getCollectionSchema: jest
      .fn()
      .mockImplementation((name: string) =>
        Promise.resolve(
          schemasByCollection[name] ?? makeCollectionSchema({ collectionName: name }),
        ),
      ),
    getMcpServerConfigs: jest.fn().mockResolvedValue([]),
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
  overrides: Partial<ExecutionContext<AiTaskStepDefinition>> = {},
): ExecutionContext<AiTaskStepDefinition> {
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
    history: [],
    remoteTools: [],
    ...overrides,
  };
}

describe('UpdateRecordStepExecutor', () => {
  describe('automaticCompletion: update direct (Branch B)', () => {
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
        stepDefinition: makeStep({ automaticCompletion: true }),
      });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(agentPort.updateRecord).toHaveBeenCalledWith('customers', [42], { status: 'active' });
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'update-record',
          stepIndex: 0,
          executionParams: { fieldDisplayName: 'Status', value: 'active' },
          executionResult: { updatedValues },
          selectedRecordRef: expect.objectContaining({
            collectionName: 'customers',
            recordId: [42],
          }),
        }),
      );
    });
  });

  describe('without automaticCompletion: awaiting-input (Branch C)', () => {
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
        expect.objectContaining({
          type: 'update-record',
          stepIndex: 0,
          pendingUpdate: { fieldDisplayName: 'Status', value: 'active' },
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
        pendingUpdate: { fieldDisplayName: 'Status', value: 'active' },
        selectedRecordRef: makeRecordRef(),
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const userInput: UserInput = { type: 'confirmation', confirmed: true };
      const context = makeContext({ agentPort, runStore, userInput });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(agentPort.updateRecord).toHaveBeenCalledWith('customers', [42], { status: 'active' });
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'update-record',
          executionParams: { fieldDisplayName: 'Status', value: 'active' },
          executionResult: { updatedValues },
          pendingUpdate: { fieldDisplayName: 'Status', value: 'active' },
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
        pendingUpdate: { fieldDisplayName: 'Status', value: 'active' },
        selectedRecordRef: makeRecordRef(),
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const userInput: UserInput = { type: 'confirmation', confirmed: false };
      const context = makeContext({ agentPort, runStore, userInput });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(agentPort.updateRecord).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          executionResult: { skipped: true },
          pendingUpdate: { fieldDisplayName: 'Status', value: 'active' },
        }),
      );
    });
  });

  describe('no pending update in phase 2 (Branch A)', () => {
    it('throws when no pending update is found', async () => {
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([]),
      });
      const userInput: UserInput = { type: 'confirmation', confirmed: true };
      const context = makeContext({ runStore, userInput });
      const executor = new UpdateRecordStepExecutor(context);

      await expect(executor.execute()).rejects.toThrow('No pending update found for this step');
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
        getStepExecutions: jest
          .fn()
          .mockResolvedValue([
            { type: 'load-related-record', stepIndex: 2, record: relatedRecord },
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
        expect.objectContaining({
          pendingUpdate: { fieldDisplayName: 'Order Status', value: 'shipped' },
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
        'No writable fields on record from collection "customers"',
      );
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('resolveFieldName failure', () => {
    it('returns error when field is not found during confirmation (Branch A)', async () => {
      const schema = makeCollectionSchema({
        fields: [{ fieldName: 'email', displayName: 'Email', isRelationship: false }],
      });
      const execution: UpdateRecordStepExecutionData = {
        type: 'update-record',
        stepIndex: 0,
        pendingUpdate: { fieldDisplayName: 'NonExistentField', value: 'active' },
        selectedRecordRef: makeRecordRef(),
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const workflowPort = makeMockWorkflowPort({ customers: schema });
      const userInput: UserInput = { type: 'confirmation', confirmed: true };
      const context = makeContext({ runStore, workflowPort, userInput });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'Field "NonExistentField" not found in collection "customers"',
      );
    });

    it('returns error when field is not found during automaticCompletion (Branch B)', async () => {
      // AI returns a display name that doesn't match any field in the schema
      const mockModel = makeMockModel({
        fieldName: 'NonExistentField',
        value: 'test',
        reasoning: 'test',
      });
      const context = makeContext({
        model: mockModel.model,
        stepDefinition: makeStep({ automaticCompletion: true }),
      });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'Field "NonExistentField" not found in collection "customers"',
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

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'AI returned a malformed tool call for "update-record-field": JSON parse error',
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

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe('AI did not return a tool call');
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('agentPort.updateRecord WorkflowExecutorError (Branch B)', () => {
    it('returns error when updateRecord throws WorkflowExecutorError', async () => {
      const agentPort = makeMockAgentPort();
      (agentPort.updateRecord as jest.Mock).mockRejectedValue(
        new WorkflowExecutorError('Record locked'),
      );
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
        stepDefinition: makeStep({ automaticCompletion: true }),
      });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe('Record locked');
    });
  });

  describe('agentPort.updateRecord WorkflowExecutorError (Branch A)', () => {
    it('returns error when updateRecord throws WorkflowExecutorError during confirmation', async () => {
      const agentPort = makeMockAgentPort();
      (agentPort.updateRecord as jest.Mock).mockRejectedValue(
        new WorkflowExecutorError('Record locked'),
      );
      const execution: UpdateRecordStepExecutionData = {
        type: 'update-record',
        stepIndex: 0,
        pendingUpdate: { fieldDisplayName: 'Status', value: 'active' },
        selectedRecordRef: makeRecordRef(),
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const userInput: UserInput = { type: 'confirmation', confirmed: true };
      const context = makeContext({ agentPort, runStore, userInput });
      const executor = new UpdateRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe('Record locked');
    });
  });

  describe('agentPort.updateRecord infra error', () => {
    it('lets infrastructure errors propagate (Branch B)', async () => {
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
        stepDefinition: makeStep({ automaticCompletion: true }),
      });
      const executor = new UpdateRecordStepExecutor(context);

      await expect(executor.execute()).rejects.toThrow('Connection refused');
    });

    it('lets infrastructure errors propagate (Branch A)', async () => {
      const agentPort = makeMockAgentPort();
      (agentPort.updateRecord as jest.Mock).mockRejectedValue(new Error('Connection refused'));
      const execution: UpdateRecordStepExecutionData = {
        type: 'update-record',
        stepIndex: 0,
        pendingUpdate: { fieldDisplayName: 'Status', value: 'active' },
        selectedRecordRef: makeRecordRef(),
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const userInput: UserInput = { type: 'confirmation', confirmed: true };
      const context = makeContext({ agentPort, runStore, userInput });
      const executor = new UpdateRecordStepExecutor(context);

      await expect(executor.execute()).rejects.toThrow('Connection refused');
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
        history: [
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
      // previous steps summary + system prompt + collection info + human message = 4
      expect(messages).toHaveLength(4);
      expect(messages[0].content).toContain('Should we proceed?');
      expect(messages[0].content).toContain('"answer":"Yes"');
      expect(messages[1].content).toContain('updating a field on a record');
    });
  });
});
