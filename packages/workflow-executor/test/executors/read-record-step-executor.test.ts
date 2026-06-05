import type { AgentPort } from '../../src/ports/agent-port';
import type { RunStore } from '../../src/ports/run-store';
import type { WorkflowPort } from '../../src/ports/workflow-port';
import type { ExecutionContext } from '../../src/types/execution-context';
import type { CollectionSchema, RecordRef } from '../../src/types/validated/collection';
import type { Step } from '../../src/types/validated/execution';
import type { ReadRecordStepDefinition } from '../../src/types/validated/step-definition';

import { AgentPortError, NoRecordsError, RecordNotFoundError } from '../../src/errors';
import ReadRecordStepExecutor from '../../src/executors/read-record-step-executor';
import SchemaCache from '../../src/schema-cache';
import { StepExecutionMode, StepType } from '../../src/types/validated/step-definition';

function makeStep(overrides: Partial<ReadRecordStepDefinition> = {}): ReadRecordStepDefinition {
  return {
    type: StepType.ReadRecord,
    executionType: StepExecutionMode.FullyAutomated,
    prompt: 'Read the customer email',
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
      .mockImplementation(({ collection }: { collection: string }) =>
        Promise.resolve(recordsByCollection[collection] ?? { values: {} }),
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

function makeContext(
  overrides: Partial<ExecutionContext<ReadRecordStepDefinition>> = {},
): ExecutionContext<ReadRecordStepDefinition> {
  return {
    runId: 'run-1',
    stepId: 'read-1',
    stepIndex: 0,
    collectionId: 'col-1',
    baseRecordRef: makeRecordRef(),
    stepDefinition: makeStep(),
    model: makeMockModel({ fieldNames: ['email'] }).model,
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
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },

    activityLogPort: {
      createPending: jest.fn().mockResolvedValue({ id: 'log-1', index: '0' }),
      markSucceeded: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
    },
    ...overrides,
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

describe('ReadRecordStepExecutor', () => {
  describe('single record, single field', () => {
    it('reads a single field and returns success', async () => {
      const mockModel = makeMockModel({ fieldNames: ['email'] });
      const runStore = makeMockRunStore();
      const context = makeContext({ model: mockModel.model, runStore });
      const executor = new ReadRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          type: 'read-record',
          stepIndex: 0,
          executionParams: { fields: [{ name: 'email', displayName: 'Email' }] },
          executionResult: {
            fields: [{ value: 'john@example.com', name: 'email', displayName: 'Email' }],
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

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionParams: {
            fields: [
              { name: 'email', displayName: 'Email' },
              { name: 'name', displayName: 'Full Name' },
            ],
          },
          executionResult: {
            fields: [
              { value: 'john@example.com', name: 'email', displayName: 'Email' },
              { value: 'John Doe', name: 'name', displayName: 'Full Name' },
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

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionParams: { fields: [{ name: 'name', displayName: 'Full Name' }] },
          executionResult: {
            fields: [{ value: 'John Doe', name: 'name', displayName: 'Full Name' }],
          },
        }),
      );
    });
  });

  describe('getRecord receives resolved field names', () => {
    it('passes resolved field names (not display names) to getRecord', async () => {
      const mockModel = makeMockModel({ fieldNames: ['Full Name', 'Email'] });
      const agentPort = makeMockAgentPort();
      const runStore = makeMockRunStore();
      const context = makeContext({ model: mockModel.model, agentPort, runStore });
      const executor = new ReadRecordStepExecutor(context);

      await executor.execute();

      expect(agentPort.getRecord).toHaveBeenCalledWith(
        { collection: 'customers', id: [42], fields: ['name', 'email'] },
        expect.objectContaining({ id: 1 }),
      );
    });

    it('passes only resolved field names when some fields are unresolved', async () => {
      const mockModel = makeMockModel({ fieldNames: ['Email', 'nonexistent'] });
      const agentPort = makeMockAgentPort();
      const runStore = makeMockRunStore();
      const context = makeContext({ model: mockModel.model, agentPort, runStore });
      const executor = new ReadRecordStepExecutor(context);

      await executor.execute();

      expect(agentPort.getRecord).toHaveBeenCalledWith(
        { collection: 'customers', id: [42], fields: ['email'] },
        expect.objectContaining({ id: 1 }),
      );
    });

    it('returns error when no fields can be resolved', async () => {
      const mockModel = makeMockModel({ fieldNames: ['nonexistent', 'unknown'] });
      const agentPort = makeMockAgentPort();
      const runStore = makeMockRunStore();
      const context = makeContext({ model: mockModel.model, agentPort, runStore });
      const executor = new ReadRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        "The AI selected fields that don't exist on this record. Try rephrasing the step's prompt.",
      );
      expect(agentPort.getRecord).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('field not found', () => {
    it('returns error per field without failing globally', async () => {
      const mockModel = makeMockModel({ fieldNames: ['email', 'nonexistent'] });
      const runStore = makeMockRunStore();
      const context = makeContext({ model: mockModel.model, runStore });
      const executor = new ReadRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionResult: {
            fields: [
              { value: 'john@example.com', name: 'email', displayName: 'Email' },
              {
                error: 'Field not found: nonexistent',
                name: 'nonexistent',
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

      await executor.execute();

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

  describe('no records available', () => {
    it('returns error when no records are available', () => {
      const error = new NoRecordsError();

      expect(error).toBeInstanceOf(NoRecordsError);
      expect(error.message).toBe('No records available');
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

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'This record type has no readable fields configured in Forest Admin.',
      );
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('multi-record AI selection', () => {
    it('uses AI to select among multiple records then reads fields', async () => {
      const baseRecordRef = makeRecordRef({ stepIndex: 1 });
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
      const executor = new ReadRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(bindTools).toHaveBeenCalledTimes(2);

      // First call: select-record tool
      const selectTool = bindTools.mock.calls[0][0][0];
      expect(selectTool.name).toBe('select-record');

      // Second call: read-selected-record-fields tool
      const readTool = bindTools.mock.calls[1][0][0];
      expect(readTool.name).toBe('read-selected-record-fields');

      const selectMessages = invoke.mock.calls[0][0];
      expect(selectMessages).toHaveLength(2);
      expect(selectMessages[0].content).toContain('Step executed by');
      expect(selectMessages[0].content).toContain('selecting the most relevant record');
      expect(selectMessages[1].content).toContain('Read the customer email');

      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionResult: {
            fields: [{ value: 'john@example.com', name: 'email', displayName: 'Email' }],
          },
          selectedRecordRef: expect.objectContaining({
            recordId: [42],
            collectionName: 'customers',
          }),
        }),
      );
    });

    it('reads fields from the second record when AI selects it', async () => {
      const baseRecordRef = makeRecordRef({ stepIndex: 1 });
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
            {
              name: 'read-selected-record-fields',
              args: { fieldNames: ['total'] },
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
      const agentPort = makeMockAgentPort({
        orders: { values: { total: 150 } },
      });
      const context = makeContext({
        baseRecordRef,
        model,
        runStore,
        workflowPort,
        agentPort,
        previousSteps: [makeLoadRelatedPreviousStep(2)],
      });
      const executor = new ReadRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionResult: {
            fields: [{ value: 150, name: 'total', displayName: 'Total' }],
          },
          selectedRecordRef: expect.objectContaining({
            recordId: [99],
            collectionName: 'orders',
          }),
        }),
      );
    });

    it('includes step index in select-record tool schema when records have stepIndex', async () => {
      const baseRecordRef = makeRecordRef({ stepIndex: 3 });
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
        getStepExecutions: jest.fn().mockResolvedValue([
          {
            type: 'load-related-record',
            stepIndex: 5,
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
      const executor = new ReadRecordStepExecutor(
        makeContext({
          baseRecordRef,
          model,
          runStore,
          workflowPort,
          previousSteps: [makeLoadRelatedPreviousStep(5)],
        }),
      );

      await executor.execute();

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
      const baseRecordRef = makeRecordRef();
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
        getStepExecutions: jest.fn().mockResolvedValue([
          {
            type: 'load-related-record',
            stepIndex: 1,
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
        previousSteps: [makeLoadRelatedPreviousStep(1)],
      });
      const executor = new ReadRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        "The AI made an unexpected choice. Try rephrasing the step's prompt.",
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

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'The record no longer exists. It may have been deleted.',
      );
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });

    it('returns error outcome for infrastructure errors', async () => {
      const agentPort = makeMockAgentPort();
      (agentPort.getRecord as jest.Mock).mockRejectedValue(new Error('Connection refused'));
      const mockModel = makeMockModel({ fieldNames: ['email'] });
      const context = makeContext({ model: mockModel.model, agentPort });
      const executor = new ReadRecordStepExecutor(context);

      const result = await executor.execute();
      expect(result.stepOutcome.status).toBe('error');
    });

    it('returns user message and logs cause when agentPort.getRecord throws an infra error', async () => {
      const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
      const agentPort = makeMockAgentPort();
      // Prod adapter normalizes infra errors into AgentPortError — simulate here.
      (agentPort.getRecord as jest.Mock).mockRejectedValue(
        new AgentPortError('getRecord', new Error('DB connection lost')),
      );
      const mockModel = makeMockModel({ fieldNames: ['email'] });
      const context = makeContext({ model: mockModel.model, agentPort, logger });
      const executor = new ReadRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'An error occurred while accessing your data. Please try again.',
      );
      expect(logger.error).toHaveBeenCalledWith(
        'Agent port "getRecord" failed: DB connection lost',
        expect.objectContaining({ cause: 'DB connection lost' }),
      );
    });
  });

  describe('model error', () => {
    it('returns error outcome for non-WorkflowExecutorError from AI invocation', async () => {
      const invoke = jest.fn().mockRejectedValue(new Error('API timeout'));
      const bindTools = jest.fn().mockReturnValue({ invoke });
      const context = makeContext({
        model: { bindTools } as unknown as ExecutionContext['model'],
      });
      const executor = new ReadRecordStepExecutor(context);

      const result = await executor.execute();
      expect(result.stepOutcome.status).toBe('error');
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

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        "The AI returned an unexpected response. Try rephrasing the step's prompt.",
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

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        "The AI couldn't decide what to do. Try rephrasing the step's prompt.",
      );
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('RunStore error propagation', () => {
    it('returns error outcome when saveStepExecution fails', async () => {
      const mockModel = makeMockModel({ fieldNames: ['email'] });
      const runStore = makeMockRunStore({
        saveStepExecution: jest.fn().mockRejectedValue(new Error('Storage full')),
      });
      const context = makeContext({ model: mockModel.model, runStore });
      const executor = new ReadRecordStepExecutor(context);

      const result = await executor.execute();
      expect(result.stepOutcome.status).toBe('error');
    });

    it('returns error outcome when getStepExecutions fails', async () => {
      const mockModel = makeMockModel({ fieldNames: ['email'] });
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockRejectedValue(new Error('Connection lost')),
      });
      const context = makeContext({ model: mockModel.model, runStore });
      const executor = new ReadRecordStepExecutor(context);

      const result = await executor.execute();
      expect(result.stepOutcome.status).toBe('error');
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
      const executor = new ReadRecordStepExecutor({
        ...context,
        stepId: 'read-2',
        stepIndex: 1,
      });

      await executor.execute();

      const messages = mockModel.invoke.mock.calls[0][0];
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toContain('Step executed by');
      expect(messages[0].content).toContain('Should we proceed?');
      expect(messages[0].content).toContain('"answer":"Yes"');
      expect(messages[0].content).toContain('reading fields from a record');
    });
  });

  describe('default prompt', () => {
    it('uses default prompt when step.prompt is undefined', async () => {
      const mockModel = makeMockModel({ fieldNames: ['email'] });
      const context = makeContext({
        model: mockModel.model,
        stepDefinition: makeStep({ prompt: undefined }),
      });
      const executor = new ReadRecordStepExecutor(context);

      await executor.execute();

      const messages = mockModel.invoke.mock.calls[0][0];
      const humanMessage = messages[messages.length - 1];
      expect(humanMessage.content).toBe('**Request**: Read the relevant fields.');
    });
  });

  describe('saveStepExecution arguments', () => {
    it('saves executionParams, executionResult, and selectedRecord', async () => {
      const mockModel = makeMockModel({ fieldNames: ['email', 'name'] });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        runStore,
        stepIndex: 3,
      });
      const executor = new ReadRecordStepExecutor(context);

      await executor.execute();

      expect(runStore.saveStepExecution).toHaveBeenCalledWith('run-1', {
        type: 'read-record',
        stepIndex: 3,
        executionParams: {
          fields: [
            { name: 'email', displayName: 'Email' },
            { name: 'name', displayName: 'Full Name' },
          ],
        },
        executionResult: {
          fields: [
            { value: 'john@example.com', name: 'email', displayName: 'Email' },
            { value: 'John Doe', name: 'name', displayName: 'Full Name' },
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

  describe('pre-recorded args', () => {
    it('skips AI calls when fieldNames are pre-recorded', async () => {
      const mockModel = makeMockModel();
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        runStore,
        stepDefinition: makeStep({
          preRecordedArgs: { fieldDisplayNames: ['Email'] },
        }),
      });
      const executor = new ReadRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(mockModel.bindTools).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionResult: {
            fields: [{ value: 'john@example.com', name: 'email', displayName: 'Email' }],
          },
        }),
      );
    });

    it('skips record selection AI when selectedRecordStepIndex is pre-recorded', async () => {
      const relatedRef = makeRecordRef({ collectionName: 'orders', recordId: [99], stepIndex: 1 });
      const mockModel = makeMockModel({ fieldNames: ['Email'] });
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([
          {
            type: 'load-related-record',
            stepIndex: 1,
            executionResult: {
              relation: { name: 'order', displayName: 'Order' },
              record: relatedRef,
            },
            selectedRecordRef: makeRecordRef(),
          },
        ]),
      });
      const context = makeContext({
        model: mockModel.model,
        runStore,
        previousSteps: [makeLoadRelatedPreviousStep(1)],
        stepDefinition: makeStep({
          preRecordedArgs: { selectedRecordStepIndex: 1 },
        }),
        workflowPort: makeMockWorkflowPort({
          customers: makeCollectionSchema(),
          orders: makeCollectionSchema({
            collectionName: 'orders',
            collectionDisplayName: 'Orders',
          }),
        }),
      });
      const executor = new ReadRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      // Only 1 AI call (selectFields), not 2 (no selectRecordRef)
      expect(mockModel.bindTools).toHaveBeenCalledTimes(1);
    });

    it('skips all AI calls when both selectedRecordStepIndex and fieldNames are pre-recorded', async () => {
      const mockModel = makeMockModel();
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        runStore,
        stepDefinition: makeStep({
          preRecordedArgs: { selectedRecordStepIndex: 0, fieldDisplayNames: ['Email'] },
        }),
      });
      const executor = new ReadRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(mockModel.bindTools).not.toHaveBeenCalled();
    });

    it('returns error when pre-recorded stepIndex does not match any record', async () => {
      const context = makeContext({
        stepDefinition: makeStep({
          preRecordedArgs: { selectedRecordStepIndex: 99 },
        }),
      });
      const executor = new ReadRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
    });

    it('returns error when all pre-recorded fieldNames are invalid', async () => {
      const mockModel = makeMockModel();
      const context = makeContext({
        model: mockModel.model,
        stepDefinition: makeStep({
          preRecordedArgs: { fieldDisplayNames: ['NonExistentField'] },
        }),
      });
      const executor = new ReadRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
    });

    it('falls back to AI when no preRecordedArgs', async () => {
      const mockModel = makeMockModel({ fieldNames: ['email'] });
      const context = makeContext({ model: mockModel.model });
      const executor = new ReadRecordStepExecutor(context);

      await executor.execute();

      expect(mockModel.bindTools).toHaveBeenCalledTimes(1);
    });
  });

  describe('record pool after revision', () => {
    // After a revision, dead-branch records must leave the pool. A live clone (new stepIndex,
    // never run by the executor) inherits its record from the copied step (originalStepIndex);
    // a re-executed step uses its OWN entry and never resurfaces the superseded original's
    // record — own-index-first resolution.
    function makeLoadRelatedExecution(stepIndex: number, recordId: number) {
      return {
        type: 'load-related-record',
        stepIndex,
        executionResult: {
          relation: { name: 'order', displayName: 'Order' },
          record: makeRecordRef({ collectionName: 'orders', recordId: [recordId], stepIndex }),
        },
        selectedRecordRef: makeRecordRef(),
      };
    }

    const ordersSchema = () =>
      makeCollectionSchema({
        collectionName: 'orders',
        collectionDisplayName: 'Orders',
        fields: [{ fieldName: 'total', displayName: 'Total', isRelationship: false }],
      });

    it('ignores records persisted by dead-branch steps when no live step claims them', async () => {
      // Given: the RunStore still holds a record loaded before the revision, but the cleaned
      // previousSteps no longer contains any load-related step.
      const mockModel = makeMockModel({ fieldNames: ['email'] });
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([makeLoadRelatedExecution(2, 99)]),
      });
      const agentPort = makeMockAgentPort();
      const context = makeContext({
        model: mockModel.model,
        runStore,
        agentPort,
        previousSteps: [],
      });
      const executor = new ReadRecordStepExecutor(context);

      // When
      const result = await executor.execute();

      // Then: the pool collapsed to the base record — no select-record AI round happened,
      // and the read targeted the base record, not the stale order.
      expect(result.stepOutcome.status).toBe('success');
      expect(mockModel.bindTools).toHaveBeenCalledTimes(1);
      expect((mockModel.bindTools.mock.calls[0][0][0] as { name: string }).name).toBe(
        'read-selected-record-fields',
      );
      expect(agentPort.getRecord).toHaveBeenCalledTimes(1);
      expect(agentPort.getRecord).toHaveBeenCalledWith(
        expect.objectContaining({ collection: 'customers', id: [42] }),
        expect.objectContaining({ id: 1 }),
      );
    });

    it("resolves a clone's record from the copied step's original RunStore entry", async () => {
      // Given: the live previous step is a clone at idx 7 (never run by the executor) that
      // copies idx 3, where its execution and record are stored.
      const invoke = jest
        .fn()
        .mockResolvedValueOnce({
          tool_calls: [
            { name: 'select-record', args: { recordIdentifier: 'Step 3 - Orders #99' }, id: 'c1' },
          ],
        })
        .mockResolvedValueOnce({
          tool_calls: [
            { name: 'read-selected-record-fields', args: { fieldNames: ['total'] }, id: 'c2' },
          ],
        });
      const bindTools = jest.fn().mockReturnValue({ invoke });
      const model = { bindTools } as unknown as ExecutionContext['model'];

      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([makeLoadRelatedExecution(3, 99)]),
      });
      const agentPort = makeMockAgentPort({ orders: { values: { total: 150 } } });
      const context = makeContext({
        model,
        runStore,
        agentPort,
        workflowPort: makeMockWorkflowPort({
          customers: makeCollectionSchema(),
          orders: ordersSchema(),
        }),
        previousSteps: [makeLoadRelatedPreviousStep(7, 3)],
      });
      const executor = new ReadRecordStepExecutor(context);

      // When
      const result = await executor.execute();

      // Then: the clone's record was offered and readable.
      expect(result.stepOutcome.status).toBe('success');
      expect(agentPort.getRecord).toHaveBeenCalledWith(
        expect.objectContaining({ collection: 'orders', id: [99] }),
        expect.objectContaining({ id: 1 }),
      );
    });

    it('does not resurface the copied original record when the re-executed step has no record (Alban repro)', async () => {
      // Given: a re-executed load step at idx 10 that copies idx 3 (originalStepIndex 3, where a
      // record was loaded before the revision) but produced no record of its own (skipped /
      // handled manually — its own entry has no executionResult.record).
      const mockModel = makeMockModel({ fieldNames: ['email'] });
      const runStore = makeMockRunStore({
        getStepExecutions: jest
          .fn()
          .mockResolvedValue([
            makeLoadRelatedExecution(3, 99),
            { type: 'load-related-record', stepIndex: 10, executionResult: { skipped: true } },
          ]),
      });
      const agentPort = makeMockAgentPort();
      const context = makeContext({
        model: mockModel.model,
        runStore,
        agentPort,
        previousSteps: [makeLoadRelatedPreviousStep(10, 3)],
      });
      const executor = new ReadRecordStepExecutor(context);

      // When
      const result = await executor.execute();

      // Then: own-index-first resolves idx 10 (record-less), so the dead idx-3 record never
      // enters the pool — it collapses to the base record, no select-record round.
      expect(result.stepOutcome.status).toBe('success');
      expect(mockModel.bindTools).toHaveBeenCalledTimes(1);
      expect((mockModel.bindTools.mock.calls[0][0][0] as { name: string }).name).toBe(
        'read-selected-record-fields',
      );
      expect(agentPort.getRecord).toHaveBeenCalledWith(
        expect.objectContaining({ collection: 'customers', id: [42] }),
        expect.objectContaining({ id: 1 }),
      );
    });

    it('does not resurface the copied original record when the re-executed step errored (no own entry)', async () => {
      // Given: the user revised "Load related", whose re-run ERRORED. A fully-automated
      // load-related persists nothing on error, so the clone at idx 10 (originalStepIndex 3) has
      // no own RunStore entry — only the pre-revision idx-3 record survives in the store.
      const mockModel = makeMockModel({ fieldNames: ['email'] });
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([makeLoadRelatedExecution(3, 99)]),
      });
      const agentPort = makeMockAgentPort();
      const erroredClone: Step = {
        ...makeLoadRelatedPreviousStep(10, 3),
        stepOutcome: { type: 'record', stepId: 'load-10', stepIndex: 10, status: 'error' },
      };
      const context = makeContext({
        model: mockModel.model,
        runStore,
        agentPort,
        previousSteps: [erroredClone],
      });
      const executor = new ReadRecordStepExecutor(context);

      // When
      const result = await executor.execute();

      // Then: the errored clone inherits nothing, so the dead idx-3 record never enters the pool —
      // it collapses to the base record, no select-record round.
      expect(result.stepOutcome.status).toBe('success');
      expect(mockModel.bindTools).toHaveBeenCalledTimes(1);
      expect((mockModel.bindTools.mock.calls[0][0][0] as { name: string }).name).toBe(
        'read-selected-record-fields',
      );
      expect(agentPort.getRecord).toHaveBeenCalledWith(
        expect.objectContaining({ collection: 'customers', id: [42] }),
        expect.objectContaining({ id: 1 }),
      );
    });

    it('offers both records when the same step ran twice on the live path (LinkTo loop)', async () => {
      // Given: a loop executed the same load step at idx 0 and idx 2 — two distinct live
      // instances, two distinct records, each resolved from its own index; neither shadows the other.
      const invoke = jest
        .fn()
        .mockResolvedValueOnce({
          tool_calls: [
            { name: 'select-record', args: { recordIdentifier: 'Step 2 - Orders #77' }, id: 'c1' },
          ],
        })
        .mockResolvedValueOnce({
          tool_calls: [
            { name: 'read-selected-record-fields', args: { fieldNames: ['total'] }, id: 'c2' },
          ],
        });
      const bindTools = jest.fn().mockReturnValue({ invoke });
      const model = { bindTools } as unknown as ExecutionContext['model'];

      const runStore = makeMockRunStore({
        getStepExecutions: jest
          .fn()
          .mockResolvedValue([makeLoadRelatedExecution(0, 99), makeLoadRelatedExecution(2, 77)]),
      });
      const agentPort = makeMockAgentPort({ orders: { values: { total: 150 } } });
      const context = makeContext({
        model,
        runStore,
        agentPort,
        workflowPort: makeMockWorkflowPort({
          customers: makeCollectionSchema(),
          orders: ordersSchema(),
        }),
        previousSteps: [makeLoadRelatedPreviousStep(0), makeLoadRelatedPreviousStep(2)],
        baseRecordRef: makeRecordRef({ stepIndex: 4 }),
      });
      const executor = new ReadRecordStepExecutor(context);

      // When
      const result = await executor.execute();

      // Then
      const selectTool = bindTools.mock.calls[0][0][0] as {
        schema: { shape: { recordIdentifier: { options: string[] } } };
      };
      expect(selectTool.schema.shape.recordIdentifier.options).toEqual([
        'Step 4 - Customers #42',
        'Step 0 - Orders #99',
        'Step 2 - Orders #77',
      ]);
      expect(result.stepOutcome.status).toBe('success');
    });
  });
});
