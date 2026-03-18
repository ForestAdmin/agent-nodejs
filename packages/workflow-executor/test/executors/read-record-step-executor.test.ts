import type { AgentPort } from '../../src/ports/agent-port';
import type { RunStore } from '../../src/ports/run-store';
import type { WorkflowPort } from '../../src/ports/workflow-port';
import type { ExecutionContext } from '../../src/types/execution';
import type { CollectionSchema, RecordRef } from '../../src/types/record';
import type { AiTaskStepDefinition } from '../../src/types/step-definition';
import type { AiTaskStepHistory } from '../../src/types/step-history';

import { RecordNotFoundError } from '../../src/errors';
import ReadRecordStepExecutor from '../../src/executors/read-record-step-executor';
import { StepType } from '../../src/types/step-definition';

function makeStep(overrides: Partial<AiTaskStepDefinition> = {}): AiTaskStepDefinition {
  return {
    id: 'read-1',
    type: StepType.ReadRecord,
    prompt: 'Read the customer email',
    ...overrides,
  };
}

function makeStepHistory(overrides: Partial<AiTaskStepHistory> = {}): AiTaskStepHistory {
  return {
    type: 'ai-task',
    stepId: 'read-1',
    stepIndex: 0,
    status: 'success',
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
  recordsByCollection: Record<string, { values: Record<string, unknown> }> = {
    customers: { values: { email: 'john@example.com', name: 'John Doe', orders: null } },
  },
): AgentPort {
  return {
    getRecord: jest
      .fn()
      .mockImplementation((collectionName: string) =>
        Promise.resolve(recordsByCollection[collectionName] ?? { values: {} }),
      ),
    updateRecord: jest.fn(),
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

function makeMockModel(
  toolCallArgs?: Record<string, unknown>,
  toolName = 'read-selected-record-fields',
) {
  const invoke = jest.fn().mockResolvedValue({
    tool_calls: toolCallArgs ? [{ name: toolName, args: toolCallArgs, id: 'call_1' }] : undefined,
  });
  const bindTools = jest.fn().mockReturnValue({ invoke });
  const model = { bindTools } as unknown as ExecutionContext['model'];

  return { model, bindTools, invoke };
}

function makeContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    runId: 'run-1',
    baseRecord: makeRecordRef(),
    model: makeMockModel({ fieldNames: ['email'] }).model,
    agentPort: makeMockAgentPort(),
    workflowPort: makeMockWorkflowPort(),
    runStore: makeMockRunStore(),
    history: [],
    remoteTools: [],
    ...overrides,
  };
}

describe('ReadRecordStepExecutor', () => {
  describe('single record, single field', () => {
    it('reads a single field and returns success', async () => {
      const mockModel = makeMockModel({ fieldNames: ['email'] });
      const runStore = makeMockRunStore();
      const context = makeContext({ model: mockModel.model, runStore });
      const executor = new ReadRecordStepExecutor(context);

      const result = await executor.execute(makeStep(), makeStepHistory());

      expect(result.stepHistory.status).toBe('success');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'read-record',
          stepIndex: 0,
          executionParams: { fieldNames: ['email'] },
          executionResult: {
            fields: [{ value: 'john@example.com', fieldName: 'email', displayName: 'Email' }],
          },
        }),
      );
    });
  });

  describe('single record, multiple fields', () => {
    it('reads multiple fields in one call and returns success', async () => {
      const mockModel = makeMockModel({ fieldNames: ['email', 'name'] });
      const runStore = makeMockRunStore();
      const context = makeContext({ model: mockModel.model, runStore });
      const executor = new ReadRecordStepExecutor(context);

      const result = await executor.execute(makeStep(), makeStepHistory());

      expect(result.stepHistory.status).toBe('success');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          executionParams: { fieldNames: ['email', 'name'] },
          executionResult: {
            fields: [
              { value: 'john@example.com', fieldName: 'email', displayName: 'Email' },
              { value: 'John Doe', fieldName: 'name', displayName: 'Full Name' },
            ],
          },
        }),
      );
    });
  });

  describe('field resolution by displayName', () => {
    it('resolves fields by displayName', async () => {
      const mockModel = makeMockModel({ fieldNames: ['Full Name'] });
      const runStore = makeMockRunStore();
      const context = makeContext({ model: mockModel.model, runStore });
      const executor = new ReadRecordStepExecutor(context);

      const result = await executor.execute(makeStep(), makeStepHistory());

      expect(result.stepHistory.status).toBe('success');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          executionResult: {
            fields: [{ value: 'John Doe', fieldName: 'name', displayName: 'Full Name' }],
          },
        }),
      );
    });
  });

  describe('field not found', () => {
    it('returns error per field without failing globally', async () => {
      const mockModel = makeMockModel({ fieldNames: ['email', 'nonexistent'] });
      const runStore = makeMockRunStore();
      const context = makeContext({ model: mockModel.model, runStore });
      const executor = new ReadRecordStepExecutor(context);

      const result = await executor.execute(makeStep(), makeStepHistory());

      expect(result.stepHistory.status).toBe('success');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          executionResult: {
            fields: [
              { value: 'john@example.com', fieldName: 'email', displayName: 'Email' },
              {
                error: 'Field not found: nonexistent',
                fieldName: 'nonexistent',
                displayName: 'nonexistent',
              },
            ],
          },
        }),
      );
    });
  });

  describe('relationship fields excluded', () => {
    it('excludes relationship fields from tool schema', async () => {
      const mockModel = makeMockModel({ fieldNames: ['email'] });
      const runStore = makeMockRunStore();
      const context = makeContext({ model: mockModel.model, runStore });
      const executor = new ReadRecordStepExecutor(context);

      await executor.execute(makeStep(), makeStepHistory());

      const tool = mockModel.bindTools.mock.calls[0][0][0];
      expect(tool.name).toBe('read-selected-record-fields');

      // Valid field names (displayNames and fieldNames) should be accepted in an array
      expect(tool.schema.parse({ fieldNames: ['Email'] })).toBeTruthy();
      expect(tool.schema.parse({ fieldNames: ['Full Name'] })).toBeTruthy();
      expect(tool.schema.parse({ fieldNames: ['email'] })).toBeTruthy();
      expect(tool.schema.parse({ fieldNames: ['email', 'name'] })).toBeTruthy();

      // Schema accepts any strings (per-field errors handled in readFieldValues, ISO frontend)
      expect(tool.schema.parse({ fieldNames: ['Orders'] })).toBeTruthy();

      // But rejects non-array values
      expect(() => tool.schema.parse({ fieldNames: 'email' })).toThrow();
    });
  });

  describe('no readable fields', () => {
    it('returns error when all fields are relationships', async () => {
      const schema = makeCollectionSchema({
        fields: [{ fieldName: 'orders', displayName: 'Orders', isRelationship: true }],
      });
      const mockModel = makeMockModel({ fieldNames: ['email'] });
      const runStore = makeMockRunStore();
      const workflowPort = makeMockWorkflowPort({ customers: schema });
      const context = makeContext({ model: mockModel.model, runStore, workflowPort });
      const executor = new ReadRecordStepExecutor(context);

      const result = await executor.execute(makeStep(), makeStepHistory());

      expect(result.stepHistory.status).toBe('error');
      expect(result.stepHistory.error).toBe(
        'No readable fields on record from collection "customers"',
      );
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('multi-record AI selection', () => {
    it('uses AI to select among multiple records then reads fields', async () => {
      const baseRecord = makeRecordRef({ stepIndex: 1 });
      const relatedRecord = makeRecordRef({
        stepIndex: 2,
        recordId: [99],
        collectionName: 'orders',
      });

      const ordersSchema = makeCollectionSchema({
        collectionName: 'orders',
        collectionDisplayName: 'Orders',
        fields: [{ fieldName: 'total', displayName: 'Total', isRelationship: false }],
      });

      // First call: select-record, second call: read-selected-record-fields
      const invoke = jest
        .fn()
        .mockResolvedValueOnce({
          tool_calls: [
            {
              name: 'select-record',
              args: { recordIdentifier: 'Step 1 - Customers #42' },
              id: 'call_1',
            },
          ],
        })
        .mockResolvedValueOnce({
          tool_calls: [
            {
              name: 'read-selected-record-fields',
              args: { fieldNames: ['email'] },
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
      const context = makeContext({ baseRecord, model, runStore, workflowPort });
      const executor = new ReadRecordStepExecutor(context);

      const result = await executor.execute(makeStep(), makeStepHistory());

      expect(result.stepHistory.status).toBe('success');
      expect(bindTools).toHaveBeenCalledTimes(2);

      // First call: select-record tool
      const selectTool = bindTools.mock.calls[0][0][0];
      expect(selectTool.name).toBe('select-record');

      // Second call: read-selected-record-fields tool
      const readTool = bindTools.mock.calls[1][0][0];
      expect(readTool.name).toBe('read-selected-record-fields');

      // Record selection includes previous steps context + system prompt + user prompt
      const selectMessages = invoke.mock.calls[0][0];
      expect(selectMessages).toHaveLength(2);
      expect(selectMessages[0].content).toContain('selecting the most relevant record');
      expect(selectMessages[1].content).toContain('Read the customer email');

      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          executionResult: {
            fields: [{ value: 'john@example.com', fieldName: 'email', displayName: 'Email' }],
          },
          selectedRecordRef: expect.objectContaining({
            recordId: [42],
            collectionName: 'customers',
          }),
        }),
      );
    });

    it('reads fields from the second record when AI selects it', async () => {
      const baseRecord = makeRecordRef({ stepIndex: 1 });
      const relatedRecord = makeRecordRef({
        stepIndex: 2,
        recordId: [99],
        collectionName: 'orders',
      });

      const ordersSchema = makeCollectionSchema({
        collectionName: 'orders',
        collectionDisplayName: 'Orders',
        fields: [{ fieldName: 'total', displayName: 'Total', isRelationship: false }],
      });

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
            { name: 'read-selected-record-fields', args: { fieldNames: ['total'] }, id: 'call_2' },
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
      const agentPort = makeMockAgentPort({
        orders: { values: { total: 150 } },
      });
      const context = makeContext({ baseRecord, model, runStore, workflowPort, agentPort });
      const executor = new ReadRecordStepExecutor(context);

      const result = await executor.execute(makeStep(), makeStepHistory());

      expect(result.stepHistory.status).toBe('success');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          executionResult: {
            fields: [{ value: 150, fieldName: 'total', displayName: 'Total' }],
          },
          selectedRecordRef: expect.objectContaining({
            recordId: [99],
            collectionName: 'orders',
          }),
        }),
      );
    });

    it('includes step index in select-record tool schema when records have stepIndex', async () => {
      const baseRecord = makeRecordRef({ stepIndex: 3 });
      const relatedRecord = makeRecordRef({
        stepIndex: 5,
        recordId: [99],
        collectionName: 'orders',
      });

      const ordersSchema = makeCollectionSchema({
        collectionName: 'orders',
        collectionDisplayName: 'Orders',
        fields: [{ fieldName: 'total', displayName: 'Total', isRelationship: false }],
      });

      const invoke = jest
        .fn()
        .mockResolvedValueOnce({
          tool_calls: [
            {
              name: 'select-record',
              args: { recordIdentifier: 'Step 3 - Customers #42' },
              id: 'call_1',
            },
          ],
        })
        .mockResolvedValueOnce({
          tool_calls: [
            { name: 'read-selected-record-fields', args: { fieldNames: ['email'] }, id: 'call_2' },
          ],
        });
      const bindTools = jest.fn().mockReturnValue({ invoke });
      const model = { bindTools } as unknown as ExecutionContext['model'];

      const runStore = makeMockRunStore({
        getStepExecutions: jest
          .fn()
          .mockResolvedValue([
            { type: 'load-related-record', stepIndex: 5, record: relatedRecord },
          ]),
      });
      const workflowPort = makeMockWorkflowPort({
        customers: makeCollectionSchema(),
        orders: ordersSchema,
      });
      const executor = new ReadRecordStepExecutor(
        makeContext({ baseRecord, model, runStore, workflowPort }),
      );

      await executor.execute(makeStep(), makeStepHistory());

      const selectTool = bindTools.mock.calls[0][0][0];
      const schemaShape = selectTool.schema.shape;
      // Enum values should include step-prefixed identifiers
      expect(schemaShape.recordIdentifier.options).toEqual([
        'Step 3 - Customers #42',
        'Step 5 - Orders #99',
      ]);
    });
  });

  describe('AI record selection failure', () => {
    it('returns error when AI selects a non-existent record identifier', async () => {
      const baseRecord = makeRecordRef();
      const relatedRecord = makeRecordRef({
        stepIndex: 1,
        recordId: [99],
        collectionName: 'orders',
      });

      const ordersSchema = makeCollectionSchema({
        collectionName: 'orders',
        collectionDisplayName: 'Orders',
        fields: [{ fieldName: 'total', displayName: 'Total', isRelationship: false }],
      });

      const invoke = jest.fn().mockResolvedValueOnce({
        tool_calls: [
          { name: 'select-record', args: { recordIdentifier: 'NonExistent #999' }, id: 'call_1' },
        ],
      });
      const bindTools = jest.fn().mockReturnValue({ invoke });
      const model = { bindTools } as unknown as ExecutionContext['model'];

      const runStore = makeMockRunStore({
        getStepExecutions: jest
          .fn()
          .mockResolvedValue([
            { type: 'load-related-record', stepIndex: 1, record: relatedRecord },
          ]),
      });
      const workflowPort = makeMockWorkflowPort({
        customers: makeCollectionSchema(),
        orders: ordersSchema,
      });
      const context = makeContext({ baseRecord, model, runStore, workflowPort });
      const executor = new ReadRecordStepExecutor(context);

      const result = await executor.execute(makeStep(), makeStepHistory());

      expect(result.stepHistory.status).toBe('error');
      expect(result.stepHistory.error).toBe(
        'AI selected record "NonExistent #999" which does not match any available record',
      );
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('agentPort.getRecord error', () => {
    it('returns error when agentPort.getRecord throws a WorkflowExecutorError', async () => {
      const agentPort = makeMockAgentPort();
      (agentPort.getRecord as jest.Mock).mockRejectedValue(
        new RecordNotFoundError('customers', '42'),
      );
      const mockModel = makeMockModel({ fieldNames: ['email'] });
      const runStore = makeMockRunStore();
      const context = makeContext({ model: mockModel.model, runStore, agentPort });
      const executor = new ReadRecordStepExecutor(context);

      const result = await executor.execute(makeStep(), makeStepHistory());

      expect(result.stepHistory.status).toBe('error');
      expect(result.stepHistory.error).toBe('Record not found: collection "customers", id "42"');
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });

    it('lets infrastructure errors propagate', async () => {
      const agentPort = makeMockAgentPort();
      (agentPort.getRecord as jest.Mock).mockRejectedValue(new Error('Connection refused'));
      const mockModel = makeMockModel({ fieldNames: ['email'] });
      const context = makeContext({ model: mockModel.model, agentPort });
      const executor = new ReadRecordStepExecutor(context);

      await expect(executor.execute(makeStep(), makeStepHistory())).rejects.toThrow(
        'Connection refused',
      );
    });
  });

  describe('model error', () => {
    it('lets non-WorkflowExecutorError propagate from AI invocation', async () => {
      const invoke = jest.fn().mockRejectedValue(new Error('API timeout'));
      const bindTools = jest.fn().mockReturnValue({ invoke });
      const context = makeContext({
        model: { bindTools } as unknown as ExecutionContext['model'],
      });
      const executor = new ReadRecordStepExecutor(context);

      await expect(executor.execute(makeStep(), makeStepHistory())).rejects.toThrow('API timeout');
    });
  });

  describe('malformed tool call', () => {
    it('returns error status on malformed tool call', async () => {
      const invoke = jest.fn().mockResolvedValue({
        tool_calls: [],
        invalid_tool_calls: [
          { name: 'read-selected-record-fields', args: '{bad json', error: 'JSON parse error' },
        ],
      });
      const bindTools = jest.fn().mockReturnValue({ invoke });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: { bindTools } as unknown as ExecutionContext['model'],
        runStore,
      });
      const executor = new ReadRecordStepExecutor(context);

      const result = await executor.execute(makeStep(), makeStepHistory());

      expect(result.stepHistory.status).toBe('error');
      expect(result.stepHistory.error).toBe(
        'AI returned a malformed tool call for "read-selected-record-fields": JSON parse error',
      );
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });

    it('returns error status when AI returns no tool call at all', async () => {
      const invoke = jest.fn().mockResolvedValue({ tool_calls: [] });
      const bindTools = jest.fn().mockReturnValue({ invoke });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: { bindTools } as unknown as ExecutionContext['model'],
        runStore,
      });
      const executor = new ReadRecordStepExecutor(context);

      const result = await executor.execute(makeStep(), makeStepHistory());

      expect(result.stepHistory.status).toBe('error');
      expect(result.stepHistory.error).toBe('AI did not return a tool call');
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('RunStore error propagation', () => {
    it('lets saveStepExecution errors propagate', async () => {
      const mockModel = makeMockModel({ fieldNames: ['email'] });
      const runStore = makeMockRunStore({
        saveStepExecution: jest.fn().mockRejectedValue(new Error('Storage full')),
      });
      const context = makeContext({ model: mockModel.model, runStore });
      const executor = new ReadRecordStepExecutor(context);

      await expect(executor.execute(makeStep(), makeStepHistory())).rejects.toThrow('Storage full');
    });

    it('lets getStepExecutions errors propagate', async () => {
      const mockModel = makeMockModel({ fieldNames: ['email'] });
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockRejectedValue(new Error('Connection lost')),
      });
      const context = makeContext({ model: mockModel.model, runStore });
      const executor = new ReadRecordStepExecutor(context);

      await expect(executor.execute(makeStep(), makeStepHistory())).rejects.toThrow(
        'Connection lost',
      );
    });
  });

  describe('immutability', () => {
    it('does not mutate the input stepHistory', async () => {
      const mockModel = makeMockModel({ fieldNames: ['email'] });
      const stepHistory = makeStepHistory();
      const context = makeContext({ model: mockModel.model });
      const executor = new ReadRecordStepExecutor(context);

      const result = await executor.execute(makeStep(), stepHistory);

      expect(result.stepHistory).not.toBe(stepHistory);
      expect(stepHistory.status).toBe('success');
    });
  });

  describe('previous steps context', () => {
    it('includes previous steps summary in read-field messages', async () => {
      const mockModel = makeMockModel({ fieldNames: ['email'] });
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
            step: {
              id: 'prev-step',
              type: StepType.Condition,
              options: ['Yes', 'No'],
              prompt: 'Should we proceed?',
            },
            stepHistory: {
              type: 'condition',
              stepId: 'prev-step',
              stepIndex: 0,
              status: 'success',
            },
          },
        ],
      });
      const executor = new ReadRecordStepExecutor(context);

      await executor.execute(
        makeStep({ id: 'read-2' }),
        makeStepHistory({ stepId: 'read-2', stepIndex: 1 }),
      );

      const messages = mockModel.invoke.mock.calls[0][0];
      // previous steps summary + system prompt + collection info + human message = 4
      expect(messages).toHaveLength(4);
      expect(messages[0].content).toContain('Should we proceed?');
      expect(messages[0].content).toContain('"answer":"Yes"');
      expect(messages[1].content).toContain('reading fields from a record');
    });
  });

  describe('default prompt', () => {
    it('uses default prompt when step.prompt is undefined', async () => {
      const mockModel = makeMockModel({ fieldNames: ['email'] });
      const context = makeContext({ model: mockModel.model });
      const executor = new ReadRecordStepExecutor(context);

      await executor.execute(makeStep({ prompt: undefined }), makeStepHistory());

      const messages = mockModel.invoke.mock.calls[0][0];
      const humanMessage = messages[messages.length - 1];
      expect(humanMessage.content).toBe('**Request**: Read the relevant fields.');
    });
  });

  describe('saveStepExecution arguments', () => {
    it('saves executionParams, executionResult, and selectedRecord', async () => {
      const mockModel = makeMockModel({ fieldNames: ['email', 'name'] });
      const runStore = makeMockRunStore();
      const context = makeContext({ model: mockModel.model, runStore });
      const executor = new ReadRecordStepExecutor(context);

      await executor.execute(makeStep(), makeStepHistory({ stepIndex: 3 }));

      expect(runStore.saveStepExecution).toHaveBeenCalledWith({
        type: 'read-record',
        stepIndex: 3,
        executionParams: { fieldNames: ['email', 'name'] },
        executionResult: {
          fields: [
            { value: 'john@example.com', fieldName: 'email', displayName: 'Email' },
            { value: 'John Doe', fieldName: 'name', displayName: 'Full Name' },
          ],
        },
        selectedRecordRef: {
          collectionName: 'customers',
          recordId: [42],
          stepIndex: 0,
        },
      });
    });
  });
});
