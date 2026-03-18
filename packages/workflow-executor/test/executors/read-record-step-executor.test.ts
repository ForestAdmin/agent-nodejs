import type { RunStore } from '../../src/ports/run-store';
import type { ExecutionContext } from '../../src/types/execution';
import type { RecordData } from '../../src/types/record';
import type { AiTaskStepDefinition } from '../../src/types/step-definition';
import type { AiTaskStepHistory } from '../../src/types/step-history';

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

function makeRecord(overrides: Partial<RecordData> = {}): RecordData {
  return {
    stepIndex: 0,
    recordId: '42',
    collectionName: 'customers',
    collectionDisplayName: 'Customers',
    fields: [
      { fieldName: 'email', displayName: 'Email', type: 'String', isRelationship: false },
      { fieldName: 'name', displayName: 'Full Name', type: 'String', isRelationship: false },
      {
        fieldName: 'orders',
        displayName: 'Orders',
        type: 'HasMany',
        isRelationship: true,
        referencedCollectionName: 'orders',
      },
    ],
    values: {
      email: 'john@example.com',
      name: 'John Doe',
      orders: null,
    },
    ...overrides,
  };
}

function makeMockRunStore(overrides: Partial<RunStore> = {}): RunStore {
  return {
    getRecords: jest.fn().mockResolvedValue([makeRecord()]),
    getRecord: jest.fn().mockResolvedValue(null),
    saveRecord: jest.fn().mockResolvedValue(undefined),
    getStepExecutions: jest.fn().mockResolvedValue([]),
    getStepExecution: jest.fn().mockResolvedValue(null),
    saveStepExecution: jest.fn().mockResolvedValue(undefined),
    ...overrides,
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
    model: makeMockModel({ fieldNames: ['email'] }).model,
    agentPort: {} as ExecutionContext['agentPort'],
    workflowPort: {} as ExecutionContext['workflowPort'],
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
      const record = makeRecord({
        fields: [
          {
            fieldName: 'orders',
            displayName: 'Orders',
            type: 'HasMany',
            isRelationship: true,
            referencedCollectionName: 'orders',
          },
        ],
      });
      const mockModel = makeMockModel({ fieldNames: ['email'] });
      const runStore = makeMockRunStore({
        getRecords: jest.fn().mockResolvedValue([record]),
      });
      const context = makeContext({ model: mockModel.model, runStore });
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
      const record1 = makeRecord({ stepIndex: 1 });
      const record2 = makeRecord({
        stepIndex: 2,
        recordId: '99',
        collectionName: 'orders',
        collectionDisplayName: 'Orders',
        fields: [
          { fieldName: 'total', displayName: 'Total', type: 'Number', isRelationship: false },
        ],
        values: { total: 150 },
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
        getRecords: jest.fn().mockResolvedValue([record1, record2]),
      });
      const context = makeContext({ model, runStore });
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
            recordId: '42',
            collectionName: 'customers',
          }),
        }),
      );
    });

    it('reads fields from the second record when AI selects it', async () => {
      const record1 = makeRecord({ stepIndex: 1 });
      const record2 = makeRecord({
        stepIndex: 2,
        recordId: '99',
        collectionName: 'orders',
        collectionDisplayName: 'Orders',
        fields: [
          { fieldName: 'total', displayName: 'Total', type: 'Number', isRelationship: false },
        ],
        values: { total: 150 },
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
        getRecords: jest.fn().mockResolvedValue([record1, record2]),
      });
      const context = makeContext({ model, runStore });
      const executor = new ReadRecordStepExecutor(context);

      const result = await executor.execute(makeStep(), makeStepHistory());

      expect(result.stepHistory.status).toBe('success');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          executionResult: {
            fields: [{ value: 150, fieldName: 'total', displayName: 'Total' }],
          },
          selectedRecordRef: expect.objectContaining({
            recordId: '99',
            collectionName: 'orders',
          }),
        }),
      );
    });

    it('includes step index in select-record tool schema when records have stepIndex', async () => {
      const record1 = makeRecord({ stepIndex: 3 });
      const record2 = makeRecord({
        stepIndex: 5,
        recordId: '99',
        collectionName: 'orders',
        collectionDisplayName: 'Orders',
        fields: [
          { fieldName: 'total', displayName: 'Total', type: 'Number', isRelationship: false },
        ],
        values: { total: 150 },
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
        getRecords: jest.fn().mockResolvedValue([record1, record2]),
      });
      const executor = new ReadRecordStepExecutor(makeContext({ model, runStore }));

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
      const record1 = makeRecord();
      const record2 = makeRecord({
        recordId: '99',
        collectionName: 'orders',
        collectionDisplayName: 'Orders',
        fields: [
          { fieldName: 'total', displayName: 'Total', type: 'Number', isRelationship: false },
        ],
        values: { total: 150 },
      });

      const invoke = jest.fn().mockResolvedValueOnce({
        tool_calls: [
          { name: 'select-record', args: { recordIdentifier: 'NonExistent #999' }, id: 'call_1' },
        ],
      });
      const bindTools = jest.fn().mockReturnValue({ invoke });
      const model = { bindTools } as unknown as ExecutionContext['model'];

      const runStore = makeMockRunStore({
        getRecords: jest.fn().mockResolvedValue([record1, record2]),
      });
      const context = makeContext({ model, runStore });
      const executor = new ReadRecordStepExecutor(context);

      const result = await executor.execute(makeStep(), makeStepHistory());

      expect(result.stepHistory.status).toBe('error');
      expect(result.stepHistory.error).toBe(
        'AI selected record "NonExistent #999" which does not match any available record',
      );
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('no records available', () => {
    it('returns error when no records exist', async () => {
      const mockModel = makeMockModel({ fieldNames: ['email'] });
      const runStore = makeMockRunStore({
        getRecords: jest.fn().mockResolvedValue([]),
      });
      const context = makeContext({ model: mockModel.model, runStore });
      const executor = new ReadRecordStepExecutor(context);

      const result = await executor.execute(makeStep(), makeStepHistory());

      expect(result.stepHistory.status).toBe('error');
      expect(result.stepHistory.error).toBe('No records available');
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('model error', () => {
    it('returns error status when AI invocation fails', async () => {
      const invoke = jest.fn().mockRejectedValue(new Error('API timeout'));
      const bindTools = jest.fn().mockReturnValue({ invoke });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: { bindTools } as unknown as ExecutionContext['model'],
        runStore,
      });
      const executor = new ReadRecordStepExecutor(context);

      const result = await executor.execute(makeStep(), makeStepHistory());

      expect(result.stepHistory.status).toBe('error');
      expect(result.stepHistory.error).toBe('API timeout');
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
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

    it('lets getRecords errors propagate', async () => {
      const mockModel = makeMockModel({ fieldNames: ['email'] });
      const runStore = makeMockRunStore({
        getRecords: jest.fn().mockRejectedValue(new Error('Connection lost')),
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
    it('saves executionParams, executionResult, and selectedRecordRef', async () => {
      const record = makeRecord();
      const mockModel = makeMockModel({ fieldNames: ['email', 'name'] });
      const runStore = makeMockRunStore({
        getRecords: jest.fn().mockResolvedValue([record]),
      });
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
          recordId: '42',
          collectionName: 'customers',
          collectionDisplayName: 'Customers',
          fields: record.fields,
        },
      });
    });
  });
});
