import type { AgentPort } from '../../src/ports/agent-port';
import type { RunStore } from '../../src/ports/run-store';
import type { WorkflowPort } from '../../src/ports/workflow-port';
import type { ExecutionContext } from '../../src/types/execution';
import type { CollectionSchema, RecordData, RecordRef } from '../../src/types/record';
import type { LoadRelatedRecordStepDefinition } from '../../src/types/step-definition';
import type { LoadRelatedRecordStepExecutionData } from '../../src/types/step-execution-data';

import SafeAgentPort from '../../src/adapters/safe-agent-port';
import LoadRelatedRecordStepExecutor from '../../src/executors/load-related-record-step-executor';
import SchemaCache from '../../src/schema-cache';
import { StepType } from '../../src/types/step-definition';

function makeStep(
  overrides: Partial<LoadRelatedRecordStepDefinition> = {},
): LoadRelatedRecordStepDefinition {
  return {
    type: StepType.LoadRelatedRecord,
    prompt: 'Load the related order for this customer',
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

function makeRelatedRecordData(overrides: Partial<RecordData> = {}): RecordData {
  return {
    collectionName: 'orders',
    recordId: [99],
    values: { total: 150 },
    ...overrides,
  };
}

function makeMockAgentPort(relatedData: RecordData[] = [makeRelatedRecordData()]): AgentPort {
  return {
    getRecord: jest.fn(),
    updateRecord: jest.fn(),
    getRelatedData: jest.fn().mockResolvedValue(relatedData),
    executeAction: jest.fn(),
  } as unknown as AgentPort;
}

/** Default schema: 'Order' is BelongsTo (single record), 'Address' is HasMany. */
function makeCollectionSchema(overrides: Partial<CollectionSchema> = {}): CollectionSchema {
  return {
    collectionName: 'customers',
    collectionDisplayName: 'Customers',
    primaryKeyFields: ['id'],
    fields: [
      { fieldName: 'email', displayName: 'Email', isRelationship: false },
      {
        fieldName: 'order',
        displayName: 'Order',
        isRelationship: true,
        relationType: 'BelongsTo',
        relatedCollectionName: 'orders',
      },
      {
        fieldName: 'address',
        displayName: 'Address',
        isRelationship: true,
        relationType: 'HasMany',
        relatedCollectionName: 'addresses',
      },
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

function makeMockModel(toolCallArgs?: Record<string, unknown>, toolName = 'select-relation') {
  const invoke = jest.fn().mockResolvedValue({
    tool_calls: toolCallArgs ? [{ name: toolName, args: toolCallArgs, id: 'call_1' }] : undefined,
  });
  const bindTools = jest.fn().mockReturnValue({ invoke });
  const model = { bindTools } as unknown as ExecutionContext['model'];

  return { model, bindTools, invoke };
}

function makeContext(
  overrides: Partial<ExecutionContext<LoadRelatedRecordStepDefinition>> = {},
): ExecutionContext<LoadRelatedRecordStepDefinition> {
  return {
    runId: 'run-1',
    stepId: 'load-1',
    stepIndex: 0,
    baseRecordRef: makeRecordRef(),
    stepDefinition: makeStep(),
    model: makeMockModel({ relationName: 'Order', reasoning: 'User requested order' }).model,
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

/** Builds a valid pending execution for Branch A tests. */
function makePendingExecution(
  overrides: Partial<LoadRelatedRecordStepExecutionData> = {},
): LoadRelatedRecordStepExecutionData {
  return {
    type: 'load-related-record',
    stepIndex: 0,
    pendingData: {
      displayName: 'Order',
      name: 'order',
      selectedRecordId: [99],
      suggestedFields: ['status', 'amount'],
    },
    selectedRecordRef: makeRecordRef(),
    ...overrides,
  };
}

describe('LoadRelatedRecordStepExecutor', () => {
  describe('automaticExecution: BelongsTo — load direct (Branch B)', () => {
    it('fetches 1 related record and returns success', async () => {
      const agentPort = makeMockAgentPort();
      const mockModel = makeMockModel({ relationName: 'Order', reasoning: 'User requested order' });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        runStore,
        stepDefinition: makeStep({ automaticExecution: true }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(agentPort.getRelatedData).toHaveBeenCalledWith(
        { collection: 'customers', id: [42], relation: 'order', limit: 1 },
        expect.objectContaining({ id: 1 }),
      );
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          type: 'load-related-record',
          stepIndex: 0,
          executionParams: { displayName: 'Order', name: 'order' },
          executionResult: expect.objectContaining({
            record: expect.objectContaining({
              collectionName: 'orders',
              recordId: [99],
              stepIndex: 0,
            }),
          }),
          selectedRecordRef: expect.objectContaining({
            collectionName: 'customers',
            recordId: [42],
          }),
        }),
      );
    });
  });

  describe('automaticExecution: HasMany — 2 AI calls (Branch B)', () => {
    it('runs selectRelevantFields + selectBestRecord to pick the best candidate', async () => {
      const hasManySchema = makeCollectionSchema({
        fields: [
          { fieldName: 'name', displayName: 'Name', isRelationship: false },
          {
            fieldName: 'address',
            displayName: 'Address',
            isRelationship: true,
            relationType: 'HasMany',
          },
        ],
      });

      const relatedData: RecordData[] = [
        { collectionName: 'addresses', recordId: [1], values: { city: 'Paris' } },
        { collectionName: 'addresses', recordId: [2], values: { city: 'Lyon' } },
      ];
      const agentPort = makeMockAgentPort(relatedData);

      const addressSchema = makeCollectionSchema({
        collectionName: 'addresses',
        collectionDisplayName: 'Addresses',
        fields: [
          { fieldName: 'city', displayName: 'City', isRelationship: false },
          { fieldName: 'zip', displayName: 'Zip', isRelationship: false },
        ],
      });

      // Call 1: select-relation → Address; Call 2: select-fields → ['City'] (displayName);
      // Call 3: select-record-by-content → index 1 (Lyon)
      const invoke = jest
        .fn()
        .mockResolvedValueOnce({
          tool_calls: [
            {
              name: 'select-relation',
              args: { relationName: 'Address', reasoning: 'Load addresses' },
              id: 'c1',
            },
          ],
        })
        .mockResolvedValueOnce({
          tool_calls: [{ name: 'select-fields', args: { fieldNames: ['City'] }, id: 'c2' }],
        })
        .mockResolvedValueOnce({
          tool_calls: [
            {
              name: 'select-record-by-content',
              args: { recordIndex: 1, reasoning: 'Lyon is relevant' },
              id: 'c3',
            },
          ],
        });
      const bindTools = jest.fn().mockReturnValue({ invoke });
      const model = { bindTools } as unknown as ExecutionContext['model'];

      const runStore = makeMockRunStore();
      const context = makeContext({
        model,
        agentPort,
        runStore,
        workflowPort: makeMockWorkflowPort({
          customers: hasManySchema,
          addresses: addressSchema,
        }),
        stepDefinition: makeStep({ automaticExecution: true }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(bindTools).toHaveBeenCalledTimes(3);
      expect(bindTools.mock.calls[0][0][0].name).toBe('select-relation');
      expect(bindTools.mock.calls[1][0][0].name).toBe('select-fields');
      expect(bindTools.mock.calls[2][0][0].name).toBe('select-record-by-content');

      // Fetches 50 candidates (HasMany)
      expect(agentPort.getRelatedData).toHaveBeenCalledWith(
        { collection: 'customers', id: [42], relation: 'address', limit: 50 },
        expect.objectContaining({ id: 1 }),
      );

      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionResult: expect.objectContaining({
            record: expect.objectContaining({ collectionName: 'addresses', recordId: [2] }),
          }),
        }),
      );
    });

    it('skips field-selection AI call when related collection has no non-relation fields', async () => {
      const hasManySchema = makeCollectionSchema({
        fields: [
          {
            fieldName: 'address',
            displayName: 'Address',
            isRelationship: true,
            relationType: 'HasMany',
          },
        ],
      });
      const relatedData: RecordData[] = [
        { collectionName: 'addresses', recordId: [1], values: {} },
        { collectionName: 'addresses', recordId: [2], values: {} },
      ];
      const agentPort = makeMockAgentPort(relatedData);
      const addressSchema = makeCollectionSchema({
        collectionName: 'addresses',
        collectionDisplayName: 'Addresses',
        fields: [],
      });

      // Call 1: select-relation; Call 2: select-record-by-content (no select-fields)
      const invoke = jest
        .fn()
        .mockResolvedValueOnce({
          tool_calls: [
            {
              name: 'select-relation',
              args: { relationName: 'Address', reasoning: 'Load addresses' },
              id: 'c1',
            },
          ],
        })
        .mockResolvedValueOnce({
          tool_calls: [
            {
              name: 'select-record-by-content',
              args: { recordIndex: 0, reasoning: 'First is best' },
              id: 'c2',
            },
          ],
        });
      const bindTools = jest.fn().mockReturnValue({ invoke });
      const model = { bindTools } as unknown as ExecutionContext['model'];

      const context = makeContext({
        model,
        agentPort,
        workflowPort: makeMockWorkflowPort({ customers: hasManySchema, addresses: addressSchema }),
        stepDefinition: makeStep({ automaticExecution: true }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(bindTools).toHaveBeenCalledTimes(2);
      expect(bindTools.mock.calls[0][0][0].name).toBe('select-relation');
      expect(bindTools.mock.calls[1][0][0].name).toBe('select-record-by-content');
    });

    it('takes the single candidate directly without AI record-selection calls', async () => {
      const hasManySchema = makeCollectionSchema({
        fields: [
          {
            fieldName: 'address',
            displayName: 'Address',
            isRelationship: true,
            relationType: 'HasMany',
          },
        ],
      });
      const agentPort = makeMockAgentPort([
        { collectionName: 'addresses', recordId: [1], values: { city: 'Paris' } },
      ]);

      const invoke = jest.fn().mockResolvedValueOnce({
        tool_calls: [
          {
            name: 'select-relation',
            args: { relationName: 'Address', reasoning: 'Load address' },
            id: 'c1',
          },
        ],
      });
      const bindTools = jest.fn().mockReturnValue({ invoke });
      const model = { bindTools } as unknown as ExecutionContext['model'];

      const context = makeContext({
        model,
        agentPort,
        workflowPort: makeMockWorkflowPort({ customers: hasManySchema }),
        stepDefinition: makeStep({ automaticExecution: true }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      // Only select-relation was called — no field/record AI calls for single candidate
      expect(bindTools).toHaveBeenCalledTimes(1);
    });

    it('returns error outcome when AI selects an out-of-range record index', async () => {
      const hasManySchema = makeCollectionSchema({
        fields: [
          {
            fieldName: 'address',
            displayName: 'Address',
            isRelationship: true,
            relationType: 'HasMany',
          },
        ],
      });
      const relatedData: RecordData[] = [
        { collectionName: 'addresses', recordId: [1], values: { city: 'Paris' } },
        { collectionName: 'addresses', recordId: [2], values: { city: 'Lyon' } },
      ];
      const agentPort = makeMockAgentPort(relatedData);
      const addressSchema = makeCollectionSchema({
        collectionName: 'addresses',
        collectionDisplayName: 'Addresses',
        fields: [{ fieldName: 'city', displayName: 'City', isRelationship: false }],
      });

      // Call 1: select-relation; Call 2: select-fields; Call 3: out-of-range index 999
      const invoke = jest
        .fn()
        .mockResolvedValueOnce({
          tool_calls: [
            {
              name: 'select-relation',
              args: { relationName: 'Address', reasoning: 'Load addresses' },
              id: 'c1',
            },
          ],
        })
        .mockResolvedValueOnce({
          tool_calls: [{ name: 'select-fields', args: { fieldNames: ['city'] }, id: 'c2' }],
        })
        .mockResolvedValueOnce({
          tool_calls: [
            {
              name: 'select-record-by-content',
              args: { recordIndex: 999, reasoning: 'Out of range' },
              id: 'c3',
            },
          ],
        });
      const bindTools = jest.fn().mockReturnValue({ invoke });
      const model = { bindTools } as unknown as ExecutionContext['model'];

      const runStore = makeMockRunStore();
      const context = makeContext({
        model,
        agentPort,
        runStore,
        workflowPort: makeMockWorkflowPort({ customers: hasManySchema, addresses: addressSchema }),
        stepDefinition: makeStep({ automaticExecution: true }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        "The AI made an unexpected choice. Try rephrasing the step's prompt.",
      );
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });

    it('returns error when AI returns empty fieldNames violating the min:1 constraint', async () => {
      const hasManySchema = makeCollectionSchema({
        fields: [
          {
            fieldName: 'address',
            displayName: 'Address',
            isRelationship: true,
            relationType: 'HasMany',
          },
        ],
      });
      const relatedData: RecordData[] = [
        { collectionName: 'addresses', recordId: [1], values: { city: 'Paris' } },
        { collectionName: 'addresses', recordId: [2], values: { city: 'Lyon' } },
      ];
      const agentPort = makeMockAgentPort(relatedData);
      const addressSchema = makeCollectionSchema({
        collectionName: 'addresses',
        collectionDisplayName: 'Addresses',
        fields: [{ fieldName: 'city', displayName: 'City', isRelationship: false }],
      });

      // Call 1: select-relation; Call 2: select-fields returns empty array (AI violation)
      const invoke = jest
        .fn()
        .mockResolvedValueOnce({
          tool_calls: [
            {
              name: 'select-relation',
              args: { relationName: 'Address', reasoning: 'Load addresses' },
              id: 'c1',
            },
          ],
        })
        .mockResolvedValueOnce({
          tool_calls: [{ name: 'select-fields', args: { fieldNames: [] }, id: 'c2' }],
        });
      const bindTools = jest.fn().mockReturnValue({ invoke });
      const model = { bindTools } as unknown as ExecutionContext['model'];

      const runStore = makeMockRunStore();
      const context = makeContext({
        model,
        agentPort,
        runStore,
        workflowPort: makeMockWorkflowPort({ customers: hasManySchema, addresses: addressSchema }),
        stepDefinition: makeStep({ automaticExecution: true }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        "The AI made an unexpected choice. Try rephrasing the step's prompt.",
      );
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('automaticExecution: HasOne — load direct (Branch B)', () => {
    it('fetches 1 related record (same path as BelongsTo) and returns success', async () => {
      const hasOneSchema = makeCollectionSchema({
        fields: [
          {
            fieldName: 'profile',
            displayName: 'Profile',
            isRelationship: true,
            relationType: 'HasOne',
          },
        ],
      });
      const agentPort = makeMockAgentPort([
        { collectionName: 'profiles', recordId: [5], values: {} },
      ]);
      const mockModel = makeMockModel({ relationName: 'Profile', reasoning: 'Load profile' });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        runStore,
        workflowPort: makeMockWorkflowPort({ customers: hasOneSchema }),
        stepDefinition: makeStep({ automaticExecution: true }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      // HasOne uses the same fetchFirstCandidate path as BelongsTo — limit: 1
      expect(agentPort.getRelatedData).toHaveBeenCalledWith(
        { collection: 'customers', id: [42], relation: 'profile', limit: 1 },
        expect.objectContaining({ id: 1 }),
      );
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionResult: expect.objectContaining({
            record: expect.objectContaining({ collectionName: 'profiles', recordId: [5] }),
          }),
        }),
      );
    });
  });

  describe('without automaticExecution: awaiting-input (Branch C)', () => {
    it('saves AI suggestion in pendingData and returns awaiting-input (single record — no field/record AI calls)', async () => {
      const agentPort = makeMockAgentPort(); // returns 1 record: orders #99
      const mockModel = makeMockModel({ relationName: 'Order', reasoning: 'User requested order' });
      const runStore = makeMockRunStore();
      const context = makeContext({ model: mockModel.model, agentPort, runStore });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('awaiting-input');
      expect(agentPort.getRelatedData).toHaveBeenCalledWith(
        { collection: 'customers', id: [42], relation: 'order', limit: 50 },
        expect.objectContaining({ id: 1 }),
      );
      // Single record → only select-relation AI call
      expect(mockModel.bindTools).toHaveBeenCalledTimes(1);
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          type: 'load-related-record',
          stepIndex: 0,
          pendingData: {
            displayName: 'Order',
            name: 'order',
            selectedRecordId: [99],
            suggestedFields: [],
          },
          selectedRecordRef: expect.objectContaining({
            collectionName: 'customers',
            recordId: [42],
          }),
        }),
      );
    });

    it('runs field-selection + record-selection AI calls when multiple related records exist', async () => {
      const relatedData: RecordData[] = [
        { collectionName: 'orders', recordId: [1], values: { status: 'pending' } },
        { collectionName: 'orders', recordId: [2], values: { status: 'completed' } },
      ];
      const agentPort = makeMockAgentPort(relatedData);

      const ordersSchema = makeCollectionSchema({
        collectionName: 'orders',
        collectionDisplayName: 'Orders',
        fields: [{ fieldName: 'status', displayName: 'Status', isRelationship: false }],
      });

      const invoke = jest
        .fn()
        .mockResolvedValueOnce({
          tool_calls: [
            {
              name: 'select-relation',
              args: { relationName: 'Order', reasoning: 'Load order' },
              id: 'c1',
            },
          ],
        })
        .mockResolvedValueOnce({
          tool_calls: [{ name: 'select-fields', args: { fieldNames: ['Status'] }, id: 'c2' }],
        })
        .mockResolvedValueOnce({
          tool_calls: [
            {
              name: 'select-record-by-content',
              args: { recordIndex: 1, reasoning: 'Completed is best' },
              id: 'c3',
            },
          ],
        });
      const bindTools = jest.fn().mockReturnValue({ invoke });
      const model = { bindTools } as unknown as ExecutionContext['model'];

      const runStore = makeMockRunStore();
      const context = makeContext({
        model,
        agentPort,
        runStore,
        workflowPort: makeMockWorkflowPort({
          customers: makeCollectionSchema(),
          orders: ordersSchema,
        }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('awaiting-input');
      expect(bindTools).toHaveBeenCalledTimes(3);
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          pendingData: {
            displayName: 'Order',
            name: 'order',
            selectedRecordId: [2], // record at index 1
            suggestedFields: ['status'],
          },
        }),
      );
    });

    it('skips field-selection AI call when related collection has no non-relation fields', async () => {
      const relatedData: RecordData[] = [
        { collectionName: 'orders', recordId: [1], values: {} },
        { collectionName: 'orders', recordId: [2], values: {} },
      ];
      const agentPort = makeMockAgentPort(relatedData);

      const ordersSchema = makeCollectionSchema({
        collectionName: 'orders',
        collectionDisplayName: 'Orders',
        fields: [],
      });

      const invoke = jest
        .fn()
        .mockResolvedValueOnce({
          tool_calls: [
            {
              name: 'select-relation',
              args: { relationName: 'Order', reasoning: 'Load order' },
              id: 'c1',
            },
          ],
        })
        .mockResolvedValueOnce({
          tool_calls: [
            {
              name: 'select-record-by-content',
              args: { recordIndex: 0, reasoning: 'First' },
              id: 'c2',
            },
          ],
        });
      const bindTools = jest.fn().mockReturnValue({ invoke });
      const model = { bindTools } as unknown as ExecutionContext['model'];

      const runStore = makeMockRunStore();
      const context = makeContext({
        model,
        agentPort,
        runStore,
        workflowPort: makeMockWorkflowPort({
          customers: makeCollectionSchema(),
          orders: ordersSchema,
        }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('awaiting-input');
      // select-relation + select-record-by-content (no select-fields)
      expect(bindTools).toHaveBeenCalledTimes(2);
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          pendingData: expect.objectContaining({
            selectedRecordId: [1],
            suggestedFields: [],
          }),
        }),
      );
    });
  });

  describe('confirmation accepted (Branch A)', () => {
    it('uses selectedRecordId from pendingData, no getRelatedData call', async () => {
      const agentPort = makeMockAgentPort();
      const execution = makePendingExecution({
        pendingData: {
          displayName: 'Order',
          name: 'order',
          suggestedFields: ['status', 'amount'],
          selectedRecordId: [99],
          userConfirmed: true,
        },
      });
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const context = makeContext({ agentPort, runStore });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(agentPort.getRelatedData).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          type: 'load-related-record',
          executionParams: { displayName: 'Order', name: 'order' },
          executionResult: expect.objectContaining({
            record: expect.objectContaining({ collectionName: 'orders', recordId: [99] }),
          }),
          pendingData: expect.objectContaining({
            displayName: 'Order',
            name: 'order',
            selectedRecordId: [99],
          }),
        }),
      );
    });

    it('uses selectedRecordId when the user overrides the AI suggestion', async () => {
      const agentPort = makeMockAgentPort();
      const execution = makePendingExecution({
        pendingData: {
          displayName: 'Order',
          name: 'order',
          suggestedFields: ['status', 'amount'],
          selectedRecordId: [42],
          userConfirmed: true,
        },
      });
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const context = makeContext({ agentPort, runStore });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(agentPort.getRelatedData).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionResult: expect.objectContaining({
            record: expect.objectContaining({ collectionName: 'orders', recordId: [42] }),
          }),
        }),
      );
    });
  });

  describe('resolveFromSelection — relatedCollectionName resolution (Branch A)', () => {
    it('derives relatedCollectionName from schema when confirmed', async () => {
      const schema = makeCollectionSchema({
        fields: [
          {
            fieldName: 'order',
            displayName: 'Order',
            isRelationship: true,
            relationType: 'BelongsTo',
            relatedCollectionName: 'orders',
          },
        ],
      });
      const execution = makePendingExecution({
        pendingData: {
          displayName: 'Order',
          name: 'order',
          suggestedFields: [],
          selectedRecordId: [99],
          userConfirmed: true,
        },
      });
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const workflowPort = makeMockWorkflowPort({ customers: schema });
      const context = makeContext({ runStore, workflowPort });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionResult: expect.objectContaining({
            record: expect.objectContaining({ collectionName: 'orders', recordId: [99] }),
          }),
        }),
      );
    });

    it('returns error when schema has no relatedCollectionName for the relation', async () => {
      const schema = makeCollectionSchema({
        fields: [
          {
            fieldName: 'order',
            displayName: 'Order',
            isRelationship: true,
            relationType: 'BelongsTo',
            // relatedCollectionName intentionally absent
          },
        ],
      });
      const execution = makePendingExecution({
        pendingData: {
          displayName: 'Order',
          name: 'order',
          suggestedFields: [],
          selectedRecordId: [99],
          userConfirmed: true,
        },
      });
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const workflowPort = makeMockWorkflowPort({ customers: schema });
      const context = makeContext({ runStore, workflowPort });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'An unexpected error occurred while processing this step.',
      );
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });

    it('uses overridden relation name from pendingData to derive relatedCollectionName', async () => {
      const schema = makeCollectionSchema({
        fields: [
          {
            fieldName: 'order',
            displayName: 'Order',
            isRelationship: true,
            relationType: 'BelongsTo',
            relatedCollectionName: 'orders',
          },
          {
            fieldName: 'address',
            displayName: 'Address',
            isRelationship: true,
            relationType: 'HasMany',
            relatedCollectionName: 'addresses',
          },
        ],
      });
      // User overrode AI's suggestion of 'order' to 'address' via PATCH
      const execution = makePendingExecution({
        pendingData: {
          displayName: 'Address',
          name: 'address',
          suggestedFields: [],
          selectedRecordId: [77],
          userConfirmed: true,
        },
      });
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const workflowPort = makeMockWorkflowPort({ customers: schema });
      const context = makeContext({ runStore, workflowPort });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionResult: expect.objectContaining({
            record: expect.objectContaining({ collectionName: 'addresses', recordId: [77] }),
          }),
        }),
      );
    });

    it('calls getCollectionSchema with selectedRecordRef.collectionName', async () => {
      const execution = makePendingExecution({
        selectedRecordRef: { collectionName: 'customers', recordId: [42], stepIndex: 0 },
        pendingData: {
          displayName: 'Order',
          name: 'order',
          suggestedFields: [],
          selectedRecordId: [99],
          userConfirmed: true,
        },
      });
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const workflowPort = makeMockWorkflowPort({ customers: makeCollectionSchema() });
      const context = makeContext({ runStore, workflowPort });
      const executor = new LoadRelatedRecordStepExecutor(context);

      await executor.execute();

      expect(workflowPort.getCollectionSchema).toHaveBeenCalledWith(
        'customers',
        expect.any(String),
      );
    });
  });

  describe('confirmation rejected (Branch A)', () => {
    it('skips the load when user rejects', async () => {
      const agentPort = makeMockAgentPort();
      const execution = makePendingExecution({
        pendingData: {
          displayName: 'Order',
          name: 'order',
          suggestedFields: ['status', 'amount'],
          selectedRecordId: [99],
          userConfirmed: false,
        },
      });
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const context = makeContext({ agentPort, runStore });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(agentPort.getRelatedData).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionResult: { skipped: true },
          pendingData: expect.objectContaining({ displayName: 'Order', name: 'order' }),
        }),
      );
    });
  });

  describe('trigger before PATCH (Branch A)', () => {
    it('re-emits awaiting-input when userConfirmed is not yet set in pendingData', async () => {
      const agentPort = makeMockAgentPort();
      const execution = makePendingExecution(); // pendingData has no userConfirmed
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const context = makeContext({ agentPort, runStore });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('awaiting-input');
      expect(agentPort.getRelatedData).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('no pending data in confirmation flow (Branch A)', () => {
    it('returns error outcome when execution exists but pendingData is absent', async () => {
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([
          {
            type: 'load-related-record',
            stepIndex: 0,
            selectedRecordRef: makeRecordRef(),
          },
        ]),
      });
      const context = makeContext({ runStore });
      const executor = new LoadRelatedRecordStepExecutor(context);

      await expect(executor.execute()).resolves.toMatchObject({
        stepOutcome: {
          type: 'record',
          stepId: 'load-1',
          stepIndex: 0,
          status: 'error',
          error: 'An unexpected error occurred while processing this step.',
        },
      });
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('NoRelationshipFieldsError', () => {
    it('returns error when collection has no relationship fields', async () => {
      const schema = makeCollectionSchema({
        fields: [{ fieldName: 'email', displayName: 'Email', isRelationship: false }],
      });
      const mockModel = makeMockModel({ relationName: 'Order', reasoning: 'test' });
      const workflowPort = makeMockWorkflowPort({ customers: schema });
      const runStore = makeMockRunStore();
      const context = makeContext({ model: mockModel.model, runStore, workflowPort });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'This record type has no relations configured in Forest Admin.',
      );
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('RelatedRecordNotFoundError', () => {
    it('returns error when BelongsTo getRelatedData returns empty array (Branch B)', async () => {
      const agentPort = makeMockAgentPort([]);
      const mockModel = makeMockModel({ relationName: 'Order', reasoning: 'test' });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        runStore,
        stepDefinition: makeStep({ automaticExecution: true }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'The related record could not be found. It may have been deleted.',
      );
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });

    it('returns error when HasMany getRelatedData returns empty array (Branch B)', async () => {
      const hasManySchema = makeCollectionSchema({
        fields: [
          {
            fieldName: 'address',
            displayName: 'Address',
            isRelationship: true,
            relationType: 'HasMany',
          },
        ],
      });
      const agentPort = makeMockAgentPort([]);
      const mockModel = makeMockModel({ relationName: 'Address', reasoning: 'test' });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        runStore,
        workflowPort: makeMockWorkflowPort({ customers: hasManySchema }),
        stepDefinition: makeStep({ automaticExecution: true }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'The related record could not be found. It may have been deleted.',
      );
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });

    it('returns error when getRelatedData returns empty array (Branch C)', async () => {
      const agentPort = makeMockAgentPort([]);
      const mockModel = makeMockModel({ relationName: 'Order', reasoning: 'test' });
      const runStore = makeMockRunStore();
      const context = makeContext({ model: mockModel.model, agentPort, runStore });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'The related record could not be found. It may have been deleted.',
      );
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('StepPersistenceError post-load', () => {
    it('returns error outcome when saveStepExecution fails after load (Branch B)', async () => {
      const runStore = makeMockRunStore({
        saveStepExecution: jest.fn().mockRejectedValue(new Error('Disk full')),
      });
      const context = makeContext({
        runId: 'run-1',
        stepIndex: 0,
        runStore,
        stepDefinition: makeStep({ automaticExecution: true }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe('The step result could not be saved. Please retry.');
    });

    it('returns error outcome when saveStepExecution fails after load (Branch A confirmed)', async () => {
      const execution = makePendingExecution({
        pendingData: {
          displayName: 'Order',
          name: 'order',
          suggestedFields: ['status', 'amount'],
          selectedRecordId: [99],
          userConfirmed: true,
        },
      });
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
        saveStepExecution: jest.fn().mockRejectedValue(new Error('Disk full')),
      });
      const context = makeContext({ runId: 'run-1', stepIndex: 0, runStore });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe('The step result could not be saved. Please retry.');
    });
  });

  describe('resolveRelationName failure', () => {
    it('returns error when AI returns a relation name not found in the schema', async () => {
      const agentPort = makeMockAgentPort();
      const mockModel = makeMockModel({ relationName: 'NonExistentRelation', reasoning: 'test' });
      const schema = makeCollectionSchema({
        fields: [
          {
            fieldName: 'order',
            displayName: 'Order',
            isRelationship: true,
            relationType: 'BelongsTo',
          },
        ],
      });
      const workflowPort = makeMockWorkflowPort({ customers: schema });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        runStore,
        workflowPort,
        stepDefinition: makeStep({ automaticExecution: true }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        "The AI selected a relation that doesn't exist on this record. Try rephrasing the step's prompt.",
      );
      expect(agentPort.getRelatedData).not.toHaveBeenCalled();
    });
  });

  describe('AI malformed/missing tool call', () => {
    it('returns error on malformed tool call', async () => {
      const invoke = jest.fn().mockResolvedValue({
        tool_calls: [],
        invalid_tool_calls: [
          { name: 'select-relation', args: '{bad json', error: 'JSON parse error' },
        ],
      });
      const bindTools = jest.fn().mockReturnValue({ invoke });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: { bindTools } as unknown as ExecutionContext['model'],
        runStore,
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.type).toBe('record');
      expect(result.stepOutcome.stepId).toBe('load-1');
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
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.type).toBe('record');
      expect(result.stepOutcome.stepId).toBe('load-1');
      expect(result.stepOutcome.stepIndex).toBe(0);
      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        "The AI couldn't decide what to do. Try rephrasing the step's prompt.",
      );
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('infra error propagation', () => {
    it('returns error outcome for getRelatedData infrastructure errors (Branch B)', async () => {
      const agentPort = makeMockAgentPort();
      (agentPort.getRelatedData as jest.Mock).mockRejectedValue(new Error('Connection refused'));
      const mockModel = makeMockModel({ relationName: 'Order', reasoning: 'test' });
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        stepDefinition: makeStep({ automaticExecution: true }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();
      expect(result.stepOutcome.status).toBe('error');
    });

    it('returns error outcome for getRelatedData infrastructure errors (Branch C)', async () => {
      const agentPort = makeMockAgentPort();
      (agentPort.getRelatedData as jest.Mock).mockRejectedValue(new Error('Connection refused'));
      const mockModel = makeMockModel({ relationName: 'Order', reasoning: 'test' });
      const context = makeContext({ model: mockModel.model, agentPort });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();
      expect(result.stepOutcome.status).toBe('error');
    });

    it('returns user message and logs cause when agentPort.getRelatedData throws an infra error', async () => {
      const logger = { info: jest.fn(), error: jest.fn() };
      const rawAgentPort = makeMockAgentPort();
      (rawAgentPort.getRelatedData as jest.Mock).mockRejectedValue(new Error('DB connection lost'));
      const agentPort = new SafeAgentPort(rawAgentPort);
      const mockModel = makeMockModel({ relationName: 'Order', reasoning: 'test' });
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        logger,
        stepDefinition: makeStep({ automaticExecution: true }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'An error occurred while accessing your data. Please try again.',
      );
      expect(logger.error).toHaveBeenCalledWith(
        'Agent port "getRelatedData" failed: DB connection lost',
        expect.objectContaining({ cause: 'DB connection lost' }),
      );
    });
  });

  describe('multi-record AI selection (base record pool)', () => {
    it('uses AI to select among multiple base records then loads relation', async () => {
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
          {
            fieldName: 'invoice',
            displayName: 'Invoice',
            isRelationship: true,
            relationType: 'BelongsTo',
          },
        ],
      });

      // Call 1: select-record; Call 2: select-relation
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
              name: 'select-relation',
              args: { relationName: 'Invoice', reasoning: 'Load the invoice' },
              id: 'call_2',
            },
          ],
        });
      const bindTools = jest.fn().mockReturnValue({ invoke });
      const model = { bindTools } as unknown as ExecutionContext['model'];

      const agentPort = makeMockAgentPort([
        { collectionName: 'invoices', recordId: [55], values: {} },
      ]);

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
      const context = makeContext({ baseRecordRef, model, runStore, workflowPort, agentPort });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('awaiting-input');
      expect(bindTools).toHaveBeenCalledTimes(2);

      const selectRecordTool = bindTools.mock.calls[0][0][0];
      expect(selectRecordTool.name).toBe('select-record');

      const selectRelationTool = bindTools.mock.calls[1][0][0];
      expect(selectRelationTool.name).toBe('select-relation');

      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          pendingData: expect.objectContaining({
            displayName: 'Invoice',
            name: 'invoice',
            selectedRecordId: [55],
          }),
          selectedRecordRef: expect.objectContaining({ recordId: [99], collectionName: 'orders' }),
        }),
      );
    });
  });

  describe('stepOutcome shape', () => {
    it('emits correct type, stepId and stepIndex in the outcome', async () => {
      const context = makeContext({ stepDefinition: makeStep({ automaticExecution: true }) });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome).toMatchObject({
        type: 'record',
        stepId: 'load-1',
        stepIndex: 0,
        status: 'success',
      });
    });
  });

  describe('previous steps context', () => {
    it('includes previous steps summary in select-relation messages', async () => {
      const mockModel = makeMockModel({ relationName: 'Order', reasoning: 'test' });
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
      const executor = new LoadRelatedRecordStepExecutor({
        ...context,
        stepId: 'load-2',
        stepIndex: 1,
      });

      await executor.execute();

      const messages = mockModel.invoke.mock.calls[0][0];
      // context + previous steps message + system prompt + collection info + human message = 5
      expect(messages).toHaveLength(5);
      expect(messages[0].content).toContain('Step executed by');
      expect(messages[1].content).toContain('Should we proceed?');
      expect(messages[1].content).toContain('"answer":"Yes"');
      expect(messages[2].content).toContain('loading a related record');
    });
  });

  describe('default prompt', () => {
    it('uses default prompt when step.prompt is undefined', async () => {
      const mockModel = makeMockModel({ relationName: 'Order', reasoning: 'test' });
      const context = makeContext({
        model: mockModel.model,
        stepDefinition: makeStep({ prompt: undefined }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      await executor.execute();

      const messages = mockModel.invoke.mock.calls[mockModel.invoke.mock.calls.length - 1][0];
      const humanMessage = messages[messages.length - 1];
      expect(humanMessage.content).toBe('**Request**: Load the relevant related record.');
    });
  });

  describe('RunStore error propagation', () => {
    it('returns error outcome when getStepExecutions fails (Branch A)', async () => {
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockRejectedValue(new Error('DB timeout')),
      });
      const context = makeContext({ runStore });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();
      expect(result.stepOutcome.status).toBe('error');
    });

    it('returns error outcome when saveStepExecution fails saving awaiting-input (Branch C)', async () => {
      const agentPort = makeMockAgentPort();
      const runStore = makeMockRunStore({
        saveStepExecution: jest.fn().mockRejectedValue(new Error('Disk full')),
      });
      const context = makeContext({ agentPort, runStore });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();
      expect(result.stepOutcome.status).toBe('error');
    });

    it('returns error outcome when saveStepExecution fails on user reject (Branch A)', async () => {
      const execution = makePendingExecution({
        pendingData: {
          displayName: 'Order',
          name: 'order',
          suggestedFields: ['status', 'amount'],
          selectedRecordId: [99],
          userConfirmed: false,
        },
      });
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
        saveStepExecution: jest.fn().mockRejectedValue(new Error('Disk full')),
      });
      const context = makeContext({ runStore });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();
      expect(result.stepOutcome.status).toBe('error');
    });
  });

  describe('displayName → fieldName resolution fallback', () => {
    it('resolves relation when AI returns technical name instead of displayName', async () => {
      const agentPort = makeMockAgentPort();
      // AI returns technical name 'order' instead of display name 'Order'
      const mockModel = makeMockModel({ relationName: 'order', reasoning: 'fallback' });
      const schema = makeCollectionSchema({
        fields: [
          {
            fieldName: 'order',
            displayName: 'Order',
            isRelationship: true,
            relationType: 'BelongsTo',
          },
        ],
      });
      const workflowPort = makeMockWorkflowPort({ customers: schema });
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        workflowPort,
        stepDefinition: makeStep({ automaticExecution: true }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(agentPort.getRelatedData).toHaveBeenCalledWith(
        { collection: 'customers', id: [42], relation: 'order', limit: 1 },
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
      const executor = new LoadRelatedRecordStepExecutor(context);

      await executor.execute();

      expect(workflowPort.getCollectionSchema).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAvailableRecordRefs filtering', () => {
    it('excludes a pending load-related-record (no record field) from the record pool', async () => {
      const baseRecordRef = makeRecordRef({ stepIndex: 1 });
      // A completed load-related-record (has record) — should appear in pool
      const completedRecord = makeRecordRef({
        stepIndex: 2,
        recordId: [99],
        collectionName: 'orders',
      });
      // A pending load-related-record (no record — awaiting-input state) — should be excluded
      const pendingExecution = {
        type: 'load-related-record' as const,
        stepIndex: 3,
        selectedRecordRef: makeRecordRef(),
        pendingData: {
          displayName: 'Invoice',
          name: 'invoice',
          selectedRecordId: [55],
        },
      };

      const ordersSchema = makeCollectionSchema({
        collectionName: 'orders',
        collectionDisplayName: 'Orders',
        fields: [
          {
            fieldName: 'order',
            displayName: 'Order',
            isRelationship: true,
            relationType: 'BelongsTo',
          },
        ],
      });

      // Call 1: select-record (picks the completed related record)
      // Call 2: select-relation
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
              name: 'select-relation',
              args: { relationName: 'Order', reasoning: 'test' },
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
              record: completedRecord,
            },
            selectedRecordRef: makeRecordRef(),
          },
          pendingExecution,
        ]),
      });
      const workflowPort = makeMockWorkflowPort({
        customers: makeCollectionSchema(),
        orders: ordersSchema,
      });
      const context = makeContext({ baseRecordRef, model, runStore, workflowPort });
      const executor = new LoadRelatedRecordStepExecutor(context);

      await executor.execute();

      // Pool = [base, completedRecord] = 2 items → select-record IS invoked
      // Pool does NOT include pending execution (no record) → only 2 options, not 3
      expect(bindTools).toHaveBeenCalledTimes(2);
      const selectRecordTool = bindTools.mock.calls[0][0][0];
      expect(selectRecordTool.name).toBe('select-record');
      expect(selectRecordTool.schema.shape.recordIdentifier.options).toHaveLength(2);
      expect(selectRecordTool.schema.shape.recordIdentifier.options).not.toContain(
        expect.stringContaining('stepIndex: 3'),
      );
    });
  });

  describe('pre-recorded args', () => {
    it('skips AI relation selection when relationName is pre-recorded', async () => {
      const { model, bindTools } = makeMockModel();
      const runStore = makeMockRunStore();
      const context = makeContext({
        model,
        runStore,
        stepDefinition: makeStep({
          automaticExecution: true,
          preRecordedArgs: { relationDisplayName: 'Order' },
        }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(bindTools).not.toHaveBeenCalled();
    });

    it('skips AI record selection when selectedRecordIndex is pre-recorded with HasMany', async () => {
      const relatedData = [
        makeRelatedRecordData({
          collectionName: 'addresses',
          recordId: [101],
          values: { city: 'Paris' },
        }),
        makeRelatedRecordData({
          collectionName: 'addresses',
          recordId: [102],
          values: { city: 'Lyon' },
        }),
      ];

      const { model, bindTools } = makeMockModel();
      const runStore = makeMockRunStore();
      const context = makeContext({
        model,
        runStore,
        agentPort: makeMockAgentPort(relatedData),
        stepDefinition: makeStep({
          automaticExecution: true,
          preRecordedArgs: { relationDisplayName: 'Address', selectedRecordIndex: 1 },
        }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(bindTools).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionResult: expect.objectContaining({
            record: expect.objectContaining({ recordId: [102] }),
          }),
        }),
      );
    });

    it('returns error when selectedRecordIndex is out of range', async () => {
      const relatedData = [
        makeRelatedRecordData({
          collectionName: 'addresses',
          recordId: [1],
          values: { city: 'Paris' },
        }),
        makeRelatedRecordData({
          collectionName: 'addresses',
          recordId: [2],
          values: { city: 'Lyon' },
        }),
      ];
      const { model } = makeMockModel();
      const context = makeContext({
        model,
        agentPort: makeMockAgentPort(relatedData),
        stepDefinition: makeStep({
          automaticExecution: true,
          preRecordedArgs: { relationDisplayName: 'Address', selectedRecordIndex: 99 },
        }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
    });

    it('falls back to AI when no preRecordedArgs', async () => {
      const { model, bindTools } = makeMockModel({ relationName: 'Orders', reasoning: 'r' });
      const context = makeContext({
        model,
        stepDefinition: makeStep({ automaticExecution: true }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      await executor.execute();

      expect(bindTools).toHaveBeenCalled();
    });
  });
});
