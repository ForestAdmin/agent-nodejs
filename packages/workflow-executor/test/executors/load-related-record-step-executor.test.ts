import type { ActivityLogPort } from '../../src/ports/activity-log-port';
import type { AgentPort } from '../../src/ports/agent-port';
import type { RunStore } from '../../src/ports/run-store';
import type { WorkflowPort } from '../../src/ports/workflow-port';
import type { ExecutionContext } from '../../src/types/execution-context';
import type { LoadRelatedRecordStepExecutionData } from '../../src/types/step-execution-data';
import type { CollectionSchema, RecordData, RecordRef } from '../../src/types/validated/collection';
import type { Step } from '../../src/types/validated/execution';
import type { LoadRelatedRecordStepDefinition } from '../../src/types/validated/step-definition';

import { AgentPortError, RunStorePortError } from '../../src/errors';
import ActivityLog from '../../src/executors/activity-log';
import AgentWithLog from '../../src/executors/agent-with-log';
import LoadRelatedRecordStepExecutor from '../../src/executors/load-related-record-step-executor';
import SchemaCache from '../../src/schema-cache';
import SchemaResolver from '../../src/schema-resolver';
import { StepExecutionMode, StepType } from '../../src/types/validated/step-definition';

function makeStep(
  overrides: Partial<LoadRelatedRecordStepDefinition> = {},
): LoadRelatedRecordStepDefinition {
  return {
    type: StepType.LoadRelatedRecord,
    executionType: StepExecutionMode.AutomatedWithConfirmation,
    prompt: 'Load the related order for this customer',
    ...overrides,
  };
}

// Wraps a raw recordId array into a LoadRelatedRecordCandidate for pendingData
// fixtures and assertions. Tests that care about referenceFieldValue pass the
// second argument; everything else gets `null`, which matches the executor's
// behavior when the related collection has no referenceField configured.
function cand(
  recordId: Array<string | number>,
  referenceFieldValue: string | null = null,
): { recordId: Array<string | number>; referenceFieldValue: string | null } {
  return { recordId, referenceFieldValue };
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
  // xToOne path uses getSingleRelatedData; mock returns the first relatedData entry shaped
  // as a RecordData with the recordId stringified, mirroring the real adapter which packs
  // composite ids via "|" and splits them back into strings. Tests can override per-call.
  const first = relatedData[0];
  const xToOneCandidate = first ? { ...first, recordId: first.recordId.map(String) } : null;
  const getSingleRelatedData = jest.fn(async () => xToOneCandidate);

  return {
    getRecord: jest.fn(),
    updateRecord: jest.fn(),
    getRelatedData: jest.fn().mockResolvedValue(relatedData),
    getSingleRelatedData,
    executeAction: jest.fn(),
  } as unknown as AgentPort;
}

/** Default schema: 'Order' is BelongsTo (single record), 'Address' is HasMany. */
function makeCollectionSchema(overrides: Partial<CollectionSchema> = {}): CollectionSchema {
  return {
    collectionName: 'customers',
    collectionId: 'col-customers',
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

function makeMockModel(toolCallArgs?: Record<string, unknown>, toolName = 'select-relation') {
  const invoke = jest.fn().mockResolvedValue({
    tool_calls: toolCallArgs ? [{ name: toolName, args: toolCallArgs, id: 'call_1' }] : undefined,
  });
  const bindTools = jest.fn().mockReturnValue({ invoke });
  const model = { bindTools } as unknown as ExecutionContext['model'];

  return { model, bindTools, invoke };
}

function makeContext(
  overrides: Partial<ExecutionContext<LoadRelatedRecordStepDefinition>> & {
    agentPort?: AgentPort;
    activityLogPort?: ActivityLogPort;
    activityLog?: ActivityLog;
    workflowPort?: WorkflowPort;
  } = {},
): ExecutionContext<LoadRelatedRecordStepDefinition> {
  const runId = overrides.runId ?? 'run-1';
  const workflowPort = overrides.workflowPort ?? makeMockWorkflowPort();
  const schemaCache = new SchemaCache();

  const base: Omit<ExecutionContext<LoadRelatedRecordStepDefinition>, 'agent' | 'activityLog'> = {
    runId,
    stepId: 'load-1',
    stepIndex: 0,
    collectionId: 'col-1',
    baseRecordRef: makeRecordRef(),
    stepDefinition: makeStep(),
    model: makeMockModel({ relationName: 'Order', reasoning: 'User requested order' }).model,
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

  const activityLog =
    overrides.activityLog ??
    new ActivityLog(
      overrides.activityLogPort ?? {
        createPending: jest.fn().mockResolvedValue({ id: 'log-1', index: '0' }),
        markSucceeded: jest.fn().mockResolvedValue(undefined),
        markFailed: jest.fn().mockResolvedValue(undefined),
      },
      base.user,
    );

  return {
    ...base,
    activityLog,
    agent:
      overrides.agent ??
      new AgentWithLog({
        agentPort: overrides.agentPort ?? makeMockAgentPort(),
        schemaResolver: base.schemaResolver,
        user: base.user,
        activityLog,
      }),
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
      availableFields: [
        { name: 'order', displayName: 'Order' },
        { name: 'address', displayName: 'Address' },
      ],
      suggestedField: { name: 'order', displayName: 'Order' },
      availableRecordIds: [cand([99])],
      suggestedRecord: cand([99]),
    },
    selectedRecordRef: makeRecordRef(),
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

describe('LoadRelatedRecordStepExecutor', () => {
  describe('executionType=FullyAutomated: BelongsTo — load direct (Branch B)', () => {
    it('fetches 1 related record and returns success', async () => {
      const agentPort = makeMockAgentPort();
      const mockModel = makeMockModel({ relationName: 'Order', reasoning: 'User requested order' });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        runStore,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      // BelongsTo: port's xToOne method; no /relationships call.
      expect(agentPort.getSingleRelatedData).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'customers',
          id: [42],
          relation: 'order',
          relatedSchema: expect.objectContaining({ collectionName: 'orders' }),
        }),
        expect.objectContaining({ id: 1 }),
      );
      expect(agentPort.getRelatedData).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          type: 'load-related-record',
          stepIndex: 0,
          executionParams: { displayName: 'Order', name: 'order' },
          executionResult: expect.objectContaining({
            record: expect.objectContaining({
              collectionName: 'orders',
              recordId: ['99'],
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

  describe('executionType=FullyAutomated: HasMany — 2 AI calls (Branch B)', () => {
    it('runs selectRelevantFields + selectBestRecord to pick the best candidate', async () => {
      const hasManySchema = makeCollectionSchema({
        fields: [
          { fieldName: 'name', displayName: 'Name', isRelationship: false },
          {
            fieldName: 'address',
            displayName: 'Address',
            isRelationship: true,
            relationType: 'HasMany',
            relatedCollectionName: 'addresses',
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
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
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
        expect.objectContaining({
          collection: 'customers',
          id: [42],
          relation: 'address',
          limit: 50,
          relatedSchema: expect.objectContaining({ collectionName: 'addresses' }),
        }),
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
            relatedCollectionName: 'addresses',
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
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
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
            relatedCollectionName: 'addresses',
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
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
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
            relatedCollectionName: 'addresses',
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
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
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
            relatedCollectionName: 'addresses',
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
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
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

  describe('executionType=FullyAutomated: HasOne — load direct (Branch B)', () => {
    it('fetches 1 related record (same path as BelongsTo) and returns success', async () => {
      const hasOneSchema = makeCollectionSchema({
        fields: [
          {
            fieldName: 'profile',
            displayName: 'Profile',
            isRelationship: true,
            relationType: 'HasOne',
            relatedCollectionName: 'profiles',
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
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      // HasOne uses the same xToOne path as BelongsTo. No /relationships call.
      expect(agentPort.getSingleRelatedData).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'customers',
          id: [42],
          relation: 'profile',
          relatedSchema: expect.objectContaining({ collectionName: 'profiles' }),
        }),
        expect.objectContaining({ id: 1 }),
      );
      expect(agentPort.getRelatedData).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionResult: expect.objectContaining({
            record: expect.objectContaining({ collectionName: 'profiles', recordId: ['5'] }),
          }),
        }),
      );
    });
  });

  // BelongsToMany falls through to the same to-many candidate path as the default
  // branch (neither xToOne nor HasMany). Routes through fetchFirstCandidate ->
  // fetchCandidates -> getRelatedData with limit: 1, then picks the first row.
  describe('executionType=FullyAutomated: BelongsToMany — load direct (Branch B)', () => {
    it('fetches 1 related record via /relationships and returns success', async () => {
      const belongsToManySchema = makeCollectionSchema({
        fields: [
          {
            fieldName: 'tags',
            displayName: 'Tags',
            isRelationship: true,
            relationType: 'BelongsToMany',
            relatedCollectionName: 'tags',
          },
        ],
      });
      const agentPort = makeMockAgentPort([{ collectionName: 'tags', recordId: [7], values: {} }]);
      const mockModel = makeMockModel({ relationName: 'Tags', reasoning: 'Load tags' });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        runStore,
        workflowPort: makeMockWorkflowPort({ customers: belongsToManySchema }),
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      // To-many path: /relationships call with limit: 1, no parent-record projection.
      expect(agentPort.getRelatedData).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'customers',
          id: [42],
          relation: 'tags',
          limit: 1,
          relatedSchema: expect.objectContaining({ collectionName: 'tags' }),
        }),
        expect.objectContaining({ id: 1 }),
      );
      expect(agentPort.getSingleRelatedData).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionResult: expect.objectContaining({
            record: expect.objectContaining({ collectionName: 'tags', recordId: [7] }),
          }),
        }),
      );
    });

    // fetchCandidates throws RelatedRecordNotFoundError when the agent returns an
    // empty list. Same user-facing message as the other empty-result paths.
    it('returns error when getRelatedData returns an empty array', async () => {
      const belongsToManySchema = makeCollectionSchema({
        fields: [
          {
            fieldName: 'tags',
            displayName: 'Tags',
            isRelationship: true,
            relationType: 'BelongsToMany',
            relatedCollectionName: 'tags',
          },
        ],
      });
      const agentPort = makeMockAgentPort([]);
      const mockModel = makeMockModel({ relationName: 'Tags', reasoning: 'Load tags' });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        runStore,
        workflowPort: makeMockWorkflowPort({ customers: belongsToManySchema }),
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'The related record could not be found. It may have been deleted.',
      );
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('operation activity log (PRD-442 #1)', () => {
    it('logs listRelatedData against the source record and its collection, not the trigger', async () => {
      const runStore = makeMockRunStore();
      const activityLogPort = {
        createPending: jest.fn().mockResolvedValue({ id: 'log-1', index: '0' }),
        markSucceeded: jest.fn().mockResolvedValue(undefined),
        markFailed: jest.fn().mockResolvedValue(undefined),
      };
      const { model } = makeMockModel({ relationName: 'Order', reasoning: 'r' });
      const context = makeContext({
        model,
        runStore,
        activityLogPort,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });

      await new LoadRelatedRecordStepExecutor(context).execute();

      expect(activityLogPort.createPending).toHaveBeenCalledWith({
        renderingId: 1,
        action: 'listRelatedData',
        type: 'read',
        collectionId: 'col-customers',
        recordId: [42],
        label: 'list relation "Order"',
      });
    });

    it('logs the relation read once on the awaiting-input (Branch C) path', async () => {
      const runStore = makeMockRunStore();
      const activityLogPort = {
        createPending: jest.fn().mockResolvedValue({ id: 'log-1', index: '0' }),
        markSucceeded: jest.fn().mockResolvedValue(undefined),
        markFailed: jest.fn().mockResolvedValue(undefined),
      };
      const { model } = makeMockModel({ relationName: 'Order', reasoning: 'r' });
      const context = makeContext({ model, runStore, activityLogPort });

      const result = await new LoadRelatedRecordStepExecutor(context).execute();

      expect(result.stepOutcome.status).toBe('awaiting-input');
      expect(activityLogPort.createPending).toHaveBeenCalledTimes(1);
      expect(activityLogPort.createPending).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'listRelatedData',
          type: 'read',
          collectionId: 'col-customers',
          recordId: [42],
          label: 'list relation "Order"',
        }),
      );
    });
  });

  describe('without executionType=FullyAutomated: awaiting-input (Branch C)', () => {
    it('saves AI suggestion in pendingData and returns awaiting-input (single record — no field/record AI calls)', async () => {
      const agentPort = makeMockAgentPort(); // returns 1 record: orders #99
      const mockModel = makeMockModel({ relationName: 'Order', reasoning: 'User requested order' });
      const runStore = makeMockRunStore();
      const context = makeContext({ model: mockModel.model, agentPort, runStore });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('awaiting-input');
      // BelongsTo → xToOne path. No /relationships call.
      expect(agentPort.getSingleRelatedData).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'customers',
          id: [42],
          relation: 'order',
          relatedSchema: expect.objectContaining({ collectionName: 'orders' }),
        }),
        expect.objectContaining({ id: 1 }),
      );
      expect(agentPort.getRelatedData).not.toHaveBeenCalled();
      // xToOne has exactly one candidate → only select-relation AI call (no field/record selection)
      expect(mockModel.bindTools).toHaveBeenCalledTimes(1);
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          type: 'load-related-record',
          stepIndex: 0,
          pendingData: {
            availableFields: [
              { name: 'order', displayName: 'Order' },
              { name: 'address', displayName: 'Address' },
            ],
            suggestedField: { name: 'order', displayName: 'Order' },
            availableRecordIds: [cand(['99'])],
            suggestedRecord: cand(['99']),
          },
          selectedRecordRef: expect.objectContaining({
            collectionName: 'customers',
            recordId: [42],
          }),
        }),
      );
    });

    // Uses HasMany ('Address') because BelongsTo/HasOne now short-circuit to a single
    // xToOne candidate (no select-fields/select-record-by-content AI calls).
    it('runs field-selection + record-selection AI calls when multiple related records exist', async () => {
      const relatedData: RecordData[] = [
        { collectionName: 'addresses', recordId: [1], values: { city: 'Paris' } },
        { collectionName: 'addresses', recordId: [2], values: { city: 'Lyon' } },
      ];
      const agentPort = makeMockAgentPort(relatedData);

      const addressesSchema = makeCollectionSchema({
        collectionName: 'addresses',
        collectionDisplayName: 'Addresses',
        fields: [{ fieldName: 'city', displayName: 'City', isRelationship: false }],
      });

      const invoke = jest
        .fn()
        .mockResolvedValueOnce({
          tool_calls: [
            {
              name: 'select-relation',
              args: { relationName: 'Address', reasoning: 'Load address' },
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
              args: { recordIndex: 1, reasoning: 'Lyon is best' },
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
          addresses: addressesSchema,
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
            availableFields: [
              { name: 'order', displayName: 'Order' },
              { name: 'address', displayName: 'Address' },
            ],
            suggestedField: { name: 'address', displayName: 'Address' },
            availableRecordIds: [cand([1]), cand([2])],
            suggestedRecord: cand([2]), // record at index 1
          },
        }),
      );
    });

    // Uses HasMany ('Address') because BelongsTo/HasOne now short-circuit to a single
    // xToOne candidate (no field/record AI selection).
    it('skips field-selection AI call when related collection has no non-relation fields', async () => {
      const relatedData: RecordData[] = [
        { collectionName: 'addresses', recordId: [1], values: {} },
        { collectionName: 'addresses', recordId: [2], values: {} },
      ];
      const agentPort = makeMockAgentPort(relatedData);

      const addressesSchema = makeCollectionSchema({
        collectionName: 'addresses',
        collectionDisplayName: 'Addresses',
        fields: [],
      });

      const invoke = jest
        .fn()
        .mockResolvedValueOnce({
          tool_calls: [
            {
              name: 'select-relation',
              args: { relationName: 'Address', reasoning: 'Load address' },
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
          addresses: addressesSchema,
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
            suggestedRecord: cand([1]),
            availableRecordIds: [cand([1]), cand([2])],
          }),
        }),
      );
    });

    // When the xToOne relation has no linked record, the step still awaits input with an empty
    // candidate list (no suggestedRecord) — the user can switch relation. It is NOT an error.
    it('returns awaiting-input with an empty candidate list when the xToOne relation has no linked record', async () => {
      const agentPort = makeMockAgentPort([]); // getSingleRelatedData → null
      const mockModel = makeMockModel({ relationName: 'Order', reasoning: 'Load order' });
      const runStore = makeMockRunStore();
      const context = makeContext({ model: mockModel.model, agentPort, runStore });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('awaiting-input');
      const saved = (runStore.saveStepExecution as jest.Mock).mock.calls[0][1];
      expect(saved.pendingData.availableRecordIds).toEqual([]);
      expect(saved.pendingData.suggestedRecord).toBeUndefined();
    });

    it('returns awaiting-input with an empty candidate list when the to-many relation has no records', async () => {
      const agentPort = makeMockAgentPort([]); // getRelatedData → []
      const mockModel = makeMockModel({ relationName: 'Address', reasoning: 'Load address' });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        runStore,
        workflowPort: makeMockWorkflowPort({
          customers: makeCollectionSchema({
            fields: [
              {
                fieldName: 'address',
                displayName: 'Address',
                isRelationship: true,
                relationType: 'HasMany',
                relatedCollectionName: 'addresses',
              },
            ],
          }),
        }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('awaiting-input');
      const saved = (runStore.saveStepExecution as jest.Mock).mock.calls[0][1];
      expect(saved.pendingData.availableRecordIds).toEqual([]);
      expect(saved.pendingData.suggestedRecord).toBeUndefined();
      expect(agentPort.getRelatedData).toHaveBeenCalled();
    });
  });

  describe('confirmation accepted (Branch A)', () => {
    it('uses suggestedRecord from pendingData, no getRelatedData call', async () => {
      const agentPort = makeMockAgentPort();
      const execution = makePendingExecution({
        pendingData: {
          availableFields: [
            { name: 'order', displayName: 'Order' },
            { name: 'address', displayName: 'Address' },
          ],
          suggestedField: { name: 'order', displayName: 'Order' },
          availableRecordIds: [cand([99])],
          suggestedRecord: cand([99]),
        },
        userConfirmation: { userConfirmed: true },
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
            suggestedField: { name: 'order', displayName: 'Order' },
            suggestedRecord: cand([99]),
          }),
        }),
      );
    });

    it('uses suggestedRecord when the user does not override the AI suggestion', async () => {
      const agentPort = makeMockAgentPort();
      const execution = makePendingExecution({
        pendingData: {
          availableFields: [
            { name: 'order', displayName: 'Order' },
            { name: 'address', displayName: 'Address' },
          ],
          suggestedField: { name: 'order', displayName: 'Order' },
          availableRecordIds: [cand([42])],
          suggestedRecord: cand([42]),
        },
        userConfirmation: { userConfirmed: true },
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

    // Confirming while the candidate list is empty (no suggestedRecord, no override) leaves
    // nothing to load → error. The front is expected to prevent this by offering a relation switch.
    it('returns error when confirming an empty candidate list with no selection', async () => {
      const execution = makePendingExecution({
        pendingData: {
          availableFields: [
            { name: 'order', displayName: 'Order' },
            { name: 'address', displayName: 'Address' },
          ],
          suggestedField: { name: 'order', displayName: 'Order' },
          availableRecordIds: [],
        },
        userConfirmation: { userConfirmed: true },
      });
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const context = makeContext({ agentPort: makeMockAgentPort(), runStore });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'The related record could not be found. It may have been deleted.',
      );
    });
  });

  describe('confirmation with user override of selectedRecordId (Branch A)', () => {
    it('preserves AI suggestion in pendingData and writes user choice to executionResult', async () => {
      // Persisted state: AI suggested record [99], awaiting confirmation.
      const execution = makePendingExecution({
        pendingData: {
          availableFields: [
            { name: 'order', displayName: 'Order' },
            { name: 'address', displayName: 'Address' },
          ],
          suggestedField: { name: 'order', displayName: 'Order' },
          availableRecordIds: [cand([99]), cand([42])],
          suggestedRecord: cand([99]),
        },
      });
      const agentPort = makeMockAgentPort();
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      // User confirms with a different record id: [42].
      const context = makeContext({
        agentPort,
        runStore,
        incomingPendingData: { userConfirmed: true, selectedRecordId: '42' },
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');

      // Final persisted execution must keep AI suggestion in pendingData
      // and use the user-overridden record id in executionResult.
      const finalSave = (runStore.saveStepExecution as jest.Mock).mock.calls.at(-1)?.[1];
      expect(finalSave).toEqual(
        expect.objectContaining({
          type: 'load-related-record',
          pendingData: expect.objectContaining({
            suggestedField: { name: 'order', displayName: 'Order' },
            suggestedRecord: cand([99]), // AI suggestion preserved
          }),
          executionResult: expect.objectContaining({
            record: expect.objectContaining({ collectionName: 'orders', recordId: ['42'] }),
          }),
        }),
      );
    });
  });

  describe('confirmation with user override of relation (Branch A)', () => {
    it('re-derives relatedCollectionName when the user switches to a different relation', async () => {
      // AI suggested "order" (→ orders collection). User switches to "Address" (→ addresses).
      const execution = makePendingExecution({
        pendingData: {
          availableFields: [
            { name: 'order', displayName: 'Order' },
            { name: 'address', displayName: 'Address' },
          ],
          suggestedField: { name: 'order', displayName: 'Order' },
          availableRecordIds: [cand([99])],
          suggestedRecord: cand([99]),
        },
      });
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const context = makeContext({
        runStore,
        incomingPendingData: {
          userConfirmed: true,
          fieldName: 'address',
          selectedRecordId: '7',
        },
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      const finalSave = (runStore.saveStepExecution as jest.Mock).mock.calls.at(-1)?.[1];
      expect(finalSave).toEqual(
        expect.objectContaining({
          // AI suggestion preserved on pendingData
          pendingData: expect.objectContaining({
            suggestedField: { name: 'order', displayName: 'Order' },
            suggestedRecord: cand([99]),
          }),
          // User-overridden relation resolves to the addresses collection
          executionParams: { name: 'address', displayName: 'Address' },
          executionResult: expect.objectContaining({
            relation: { name: 'address', displayName: 'Address' },
            record: expect.objectContaining({ collectionName: 'addresses', recordId: ['7'] }),
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
          availableFields: [{ name: 'order', displayName: 'Order' }],
          suggestedField: { name: 'order', displayName: 'Order' },
          availableRecordIds: [cand([99])],
          suggestedRecord: cand([99]),
        },
        userConfirmation: { userConfirmed: true },
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
          availableFields: [{ name: 'order', displayName: 'Order' }],
          suggestedField: { name: 'order', displayName: 'Order' },
          availableRecordIds: [cand([99])],
          suggestedRecord: cand([99]),
        },
        userConfirmation: { userConfirmed: true },
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

    it('returns error when the confirmed relation is not in availableFields (stale/renamed)', async () => {
      const agentPort = makeMockAgentPort();
      const execution = makePendingExecution({
        pendingData: {
          availableFields: [
            { name: 'order', displayName: 'Order' },
            { name: 'address', displayName: 'Address' },
          ],
          suggestedField: { name: 'order', displayName: 'Order' },
          availableRecordIds: [cand([99])],
          suggestedRecord: cand([99]),
        },
        // Frontend confirms a relation that no longer exists in availableFields.
        userConfirmation: { userConfirmed: true, fieldName: 'ghost', selectedRecordId: ['7'] },
      });
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const context = makeContext({ agentPort, runStore });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'An unexpected error occurred while processing this step.',
      );
      expect(agentPort.getRelatedData).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });

    it('uses overridden suggestedField from pendingData to derive relatedCollectionName', async () => {
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
      // Pending data already reflects 'address' as the suggested relation (e.g. user override
      // was previously persisted, or the AI picked it directly).
      const execution = makePendingExecution({
        pendingData: {
          availableFields: [
            { name: 'order', displayName: 'Order' },
            { name: 'address', displayName: 'Address' },
          ],
          suggestedField: { name: 'address', displayName: 'Address' },
          availableRecordIds: [cand([77])],
          suggestedRecord: cand([77]),
        },
        userConfirmation: { userConfirmed: true },
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
          availableFields: [{ name: 'order', displayName: 'Order' }],
          suggestedField: { name: 'order', displayName: 'Order' },
          availableRecordIds: [cand([99])],
          suggestedRecord: cand([99]),
        },
        userConfirmation: { userConfirmed: true },
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
          availableFields: [
            { name: 'order', displayName: 'Order' },
            { name: 'address', displayName: 'Address' },
          ],
          suggestedField: { name: 'order', displayName: 'Order' },
          availableRecordIds: [cand([99])],
          suggestedRecord: cand([99]),
        },
        userConfirmation: { userConfirmed: false },
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
          pendingData: expect.objectContaining({
            suggestedField: { name: 'order', displayName: 'Order' },
          }),
        }),
      );
    });
  });

  // The frontend lets the user switch to a different relation before confirming. To
  // populate the new relation's `availableRecordIds`, it POSTs a "preview" patch:
  // `{ fieldName }` with no `userConfirmed`. The executor re-lists candidates,
  // refreshes pendingData, clears userConfirmation, and stays awaiting-input.
  describe('field-preview patch (Branch A — no confirm)', () => {
    it('re-lists candidates for the new relation and stays awaiting-input', async () => {
      const execution = makePendingExecution({
        pendingData: {
          availableFields: [
            { name: 'order', displayName: 'Order' },
            { name: 'address', displayName: 'Address' },
          ],
          suggestedField: { name: 'order', displayName: 'Order' },
          availableRecordIds: [cand(['99'])],
          suggestedRecord: cand(['99']),
        },
      });
      // User switched to Address (HasMany). The default mock returns the order fixture;
      // override with address candidates so we can verify the new IDs land in pendingData.
      const agentPort = makeMockAgentPort([
        { collectionName: 'addresses', recordId: [1], values: { city: 'Paris' } },
        { collectionName: 'addresses', recordId: [2], values: { city: 'Lyon' } },
      ]);
      const addressesSchema = makeCollectionSchema({
        collectionName: 'addresses',
        collectionDisplayName: 'Addresses',
        fields: [{ fieldName: 'city', displayName: 'City', isRelationship: false }],
      });
      // The schema-cache fetch for 'addresses' goes through the workflow port.
      const workflowPort = makeMockWorkflowPort({
        customers: makeCollectionSchema(),
        addresses: addressesSchema,
      });
      // With 2 candidates, selectBestFromRelatedData calls the AI for field + record
      // selection. Wire those up so the preview can pick a suggestedRecord.
      const invoke = jest
        .fn()
        .mockResolvedValueOnce({
          tool_calls: [{ name: 'select-fields', args: { fieldNames: ['City'] }, id: 'c1' }],
        })
        .mockResolvedValueOnce({
          tool_calls: [
            {
              name: 'select-record-by-content',
              args: { recordIndex: 1, reasoning: 'Lyon' },
              id: 'c2',
            },
          ],
        });
      const model = {
        bindTools: jest.fn().mockReturnValue({ invoke }),
      } as unknown as ExecutionContext['model'];

      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const context = makeContext({
        model,
        agentPort,
        runStore,
        workflowPort,
        incomingPendingData: { fieldName: 'address' },
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('awaiting-input');

      // Two saves: one from patchAndReloadPendingData persisting userConfirmation,
      // one from refreshCandidatesForField writing the new pendingData. The latter
      // is the one the frontend reads.
      const finalSave = (runStore.saveStepExecution as jest.Mock).mock.calls.at(-1)?.[1];
      expect(finalSave).toEqual(
        expect.objectContaining({
          type: 'load-related-record',
          // userConfirmation cleared so the next bodyless trigger re-emits awaiting-input
          // cleanly via handleConfirmationFlow (no stale fieldName ghost-confirms).
          userConfirmation: undefined,
          pendingData: expect.objectContaining({
            // availableFields is immutable — only suggestedField + candidates change.
            availableFields: [
              { name: 'order', displayName: 'Order' },
              { name: 'address', displayName: 'Address' },
            ],
            suggestedField: { name: 'address', displayName: 'Address' },
            availableRecordIds: [cand([1]), cand([2])],
            suggestedRecord: cand([2]), // AI's select-record-by-content pick
          }),
        }),
      );
    });

    it('reruns xToOne candidate lookup when previewing a BelongsTo relation', async () => {
      // Same setup but switching to Order (BelongsTo). Verifies the xToOne path is
      // used inside refreshCandidatesForField — no AI calls, single candidate from
      // the parent's projected relation linkage.
      const execution = makePendingExecution({
        pendingData: {
          availableFields: [
            { name: 'order', displayName: 'Order' },
            { name: 'address', displayName: 'Address' },
          ],
          suggestedField: { name: 'address', displayName: 'Address' },
          availableRecordIds: [cand([1]), cand([2])],
          suggestedRecord: cand([2]),
        },
      });
      const agentPort = makeMockAgentPort(); // default: order recordId [99]
      const workflowPort = makeMockWorkflowPort({ customers: makeCollectionSchema() });
      const mockModel = makeMockModel({});
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        runStore,
        workflowPort,
        incomingPendingData: { fieldName: 'order' },
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('awaiting-input');
      // xToOne path goes through the port's getSingleRelatedData method.
      expect(agentPort.getSingleRelatedData).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'customers',
          id: [42],
          relation: 'order',
          relatedSchema: expect.objectContaining({ collectionName: 'orders' }),
        }),
        expect.objectContaining({ id: 1 }),
      );
      expect(agentPort.getRelatedData).not.toHaveBeenCalled();

      const finalSave = (runStore.saveStepExecution as jest.Mock).mock.calls.at(-1)?.[1];
      expect(finalSave).toEqual(
        expect.objectContaining({
          userConfirmation: undefined,
          pendingData: expect.objectContaining({
            suggestedField: { name: 'order', displayName: 'Order' },
            availableRecordIds: [cand(['99'])],
            suggestedRecord: cand(['99']),
          }),
        }),
      );
    });

    it('returns error when the previewed relation does not exist on the source collection', async () => {
      const execution = makePendingExecution();
      const agentPort = makeMockAgentPort();
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const context = makeContext({
        agentPort,
        runStore,
        incomingPendingData: { fieldName: 'notAField' },
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
    });

    // refreshCandidatesForField guards against a corrupted/partial execution where
    // a preview patch lands but the persisted execution carries no pendingData.
    // Twin of the "no pending data in confirmation flow" test for the resolve path.
    it('returns error when execution exists but pendingData is absent', async () => {
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([
          {
            type: 'load-related-record',
            stepIndex: 0,
            selectedRecordRef: makeRecordRef(),
          },
        ]),
      });
      const context = makeContext({
        runStore,
        incomingPendingData: { fieldName: 'address' },
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'An unexpected error occurred while processing this step.',
      );
    });
  });

  // The related collection may have a layout-level `referenceField` (e.g. `name`,
  // `title`) used to display records in the UI. When configured, candidate records
  // in pendingData carry the resolved value so the awaiting-input dropdown can show
  // human-readable labels instead of raw ids.
  describe('referenceField propagation in pendingData (Branch C)', () => {
    it('exposes referenceFieldValue from the related collection on each HasMany candidate', async () => {
      // HasMany path: fetchRelatedData returns full rows; the executor reads
      // values[referenceField] for each candidate.
      const relatedData: RecordData[] = [
        { collectionName: 'addresses', recordId: [1], values: { city: 'Paris' } },
        { collectionName: 'addresses', recordId: [2], values: { city: 'Lyon' } },
      ];
      const agentPort = makeMockAgentPort(relatedData);
      const addressesSchema = makeCollectionSchema({
        collectionName: 'addresses',
        collectionDisplayName: 'Addresses',
        referenceField: 'city',
        fields: [{ fieldName: 'city', displayName: 'City', isRelationship: false }],
      });
      const invoke = jest
        .fn()
        .mockResolvedValueOnce({
          tool_calls: [
            {
              name: 'select-relation',
              args: { relationName: 'Address', reasoning: 'Load address' },
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
              args: { recordIndex: 0, reasoning: 'Paris' },
              id: 'c3',
            },
          ],
        });
      const model = {
        bindTools: jest.fn().mockReturnValue({ invoke }),
      } as unknown as ExecutionContext['model'];
      const runStore = makeMockRunStore();
      const context = makeContext({
        model,
        agentPort,
        runStore,
        workflowPort: makeMockWorkflowPort({
          customers: makeCollectionSchema(),
          addresses: addressesSchema,
        }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      await executor.execute();

      const saved = (runStore.saveStepExecution as jest.Mock).mock.calls.at(-1)?.[1];
      expect(saved.pendingData.availableRecordIds).toEqual([
        { recordId: [1], referenceFieldValue: 'Paris' },
        { recordId: [2], referenceFieldValue: 'Lyon' },
      ]);
      expect(saved.pendingData.suggestedRecord).toEqual({
        recordId: [1],
        referenceFieldValue: 'Paris',
      });
    });

    it('exposes a null referenceFieldValue when a HasMany candidate has no value for the reference field', async () => {
      const relatedData: RecordData[] = [
        { collectionName: 'addresses', recordId: [1], values: { city: null } },
      ];
      const agentPort = makeMockAgentPort(relatedData);
      const addressesSchema = makeCollectionSchema({
        collectionName: 'addresses',
        collectionDisplayName: 'Addresses',
        referenceField: 'city',
        fields: [{ fieldName: 'city', displayName: 'City', isRelationship: false }],
      });
      const mockModel = makeMockModel({ relationName: 'Address', reasoning: 'Load address' });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        runStore,
        workflowPort: makeMockWorkflowPort({
          customers: makeCollectionSchema({
            fields: [
              {
                fieldName: 'address',
                displayName: 'Address',
                isRelationship: true,
                relationType: 'HasMany',
                relatedCollectionName: 'addresses',
              },
            ],
          }),
          addresses: addressesSchema,
        }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      await executor.execute();

      const saved = (runStore.saveStepExecution as jest.Mock).mock.calls.at(-1)?.[1];
      expect(saved.pendingData.availableRecordIds).toEqual([
        { recordId: [1], referenceFieldValue: null },
      ]);
    });

    it('passes the referenceField to getSingleRelatedData and extracts its value from the result', async () => {
      const ordersSchema = makeCollectionSchema({
        collectionName: 'orders',
        collectionDisplayName: 'Orders',
        referenceField: 'reference',
        fields: [{ fieldName: 'reference', displayName: 'Reference', isRelationship: false }],
      });

      const agentPort = makeMockAgentPort();
      (agentPort.getSingleRelatedData as jest.Mock).mockResolvedValue({
        collectionName: 'orders',
        recordId: ['99'],
        values: { id: '99', reference: 'ORD-2026-001' },
      });
      const mockModel = makeMockModel({ relationName: 'Order', reasoning: 'Load order' });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        runStore,
        workflowPort: makeMockWorkflowPort({
          customers: makeCollectionSchema(),
          orders: ordersSchema,
        }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      await executor.execute();

      expect(agentPort.getSingleRelatedData).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'customers',
          id: [42],
          relation: 'order',
          fields: ['reference'],
        }),
        expect.objectContaining({ id: 1 }),
      );

      const saved = (runStore.saveStepExecution as jest.Mock).mock.calls.at(-1)?.[1];
      expect(saved.pendingData.suggestedRecord).toEqual({
        recordId: ['99'],
        referenceFieldValue: 'ORD-2026-001',
      });
    });

    it('falls back to null referenceFieldValue when the related collection has no referenceField configured', async () => {
      // Default makeCollectionSchema doesn't set referenceField → executor omits `fields`
      // when calling getSingleRelatedData and writes null on every candidate.
      const agentPort = makeMockAgentPort();
      const mockModel = makeMockModel({ relationName: 'Order', reasoning: 'Load order' });
      const runStore = makeMockRunStore();
      const context = makeContext({ model: mockModel.model, agentPort, runStore });
      const executor = new LoadRelatedRecordStepExecutor(context);

      await executor.execute();

      expect(agentPort.getSingleRelatedData).toHaveBeenCalledWith(
        expect.not.objectContaining({ fields: expect.anything() }),
        expect.objectContaining({ id: 1 }),
      );

      const saved = (runStore.saveStepExecution as jest.Mock).mock.calls.at(-1)?.[1];
      expect(saved.pendingData.suggestedRecord).toEqual({
        recordId: ['99'],
        referenceFieldValue: null,
      });
    });
  });

  // Bounds what is sent to the record-selection AI call; the full candidate list is still
  // returned to the front via availableRecordIds (HasMany / to-many path, awaiting-input).
  describe('AI payload bounding (HasMany)', () => {
    const wideSchema = (count: number) =>
      makeCollectionSchema({
        collectionName: 'addresses',
        collectionDisplayName: 'Addresses',
        fields: Array.from({ length: count }, (_, i) => ({
          fieldName: `f${i}`,
          displayName: `F${i}`,
          isRelationship: false,
        })),
      });

    // Answers the 3 HasMany AI calls in order: select-relation, select-fields, select-record.
    const buildModel = (selectedFieldDisplayNames: string[], recordIndex = 0) => {
      const invoke = jest
        .fn()
        .mockResolvedValueOnce({
          tool_calls: [
            {
              name: 'select-relation',
              args: { relationName: 'Address', reasoning: 'r' },
              id: 'c1',
            },
          ],
        })
        .mockResolvedValueOnce({
          tool_calls: [
            { name: 'select-fields', args: { fieldNames: selectedFieldDisplayNames }, id: 'c2' },
          ],
        })
        .mockResolvedValueOnce({
          tool_calls: [
            {
              name: 'select-record-by-content',
              args: { recordIndex, reasoning: 'r' },
              id: 'c3',
            },
          ],
        });

      return {
        invoke,
        model: {
          bindTools: jest.fn().mockReturnValue({ invoke }),
        } as unknown as ExecutionContext['model'],
      };
    };

    // Concatenated content of the select-record AI call (3rd invoke), robust to system-message merge.
    const selectRecordPrompt = (invoke: jest.Mock): string =>
      (invoke.mock.calls[2][0] as Array<{ content: unknown }>)
        .map(m => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)))
        .join('\n');

    it('caps the fields sent to the record-selection call at MAX_RELEVANT_FIELDS (6)', async () => {
      const values = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`f${i}`, `v${i}`]));
      const relatedData: RecordData[] = [
        { collectionName: 'addresses', recordId: [1], values },
        { collectionName: 'addresses', recordId: [2], values },
      ];
      const { invoke, model } = buildModel(Array.from({ length: 8 }, (_, i) => `F${i}`)); // AI returns 8
      const context = makeContext({
        model,
        agentPort: makeMockAgentPort(relatedData),
        runStore: makeMockRunStore(),
        workflowPort: makeMockWorkflowPort({
          customers: makeCollectionSchema(),
          addresses: wideSchema(8),
        }),
      });

      await new LoadRelatedRecordStepExecutor(context).execute();

      const firstRow = JSON.parse(selectRecordPrompt(invoke).match(/\[0\] (\{[^\n]*\})/)![1]);
      expect(Object.keys(firstRow)).toHaveLength(6);
    });

    it('truncates an over-long field value in the AI candidate list', async () => {
      const longValue = 'x'.repeat(200);
      const relatedData: RecordData[] = [
        { collectionName: 'addresses', recordId: [1], values: { bio: longValue } },
        { collectionName: 'addresses', recordId: [2], values: { bio: 'short' } },
      ];
      const schema = makeCollectionSchema({
        collectionName: 'addresses',
        collectionDisplayName: 'Addresses',
        fields: [{ fieldName: 'bio', displayName: 'Bio', isRelationship: false }],
      });
      const { invoke, model } = buildModel(['Bio']);
      const context = makeContext({
        model,
        agentPort: makeMockAgentPort(relatedData),
        runStore: makeMockRunStore(),
        workflowPort: makeMockWorkflowPort({
          customers: makeCollectionSchema(),
          addresses: schema,
        }),
      });

      await new LoadRelatedRecordStepExecutor(context).execute();

      const content = selectRecordPrompt(invoke);
      expect(content).toContain('… (truncated)');
      expect(content).not.toContain(longValue);
    });

    it('caps the candidate list to the global budget but still returns all records', async () => {
      const big = 'y'.repeat(80);
      const values = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`f${i}`, big]));
      const relatedData: RecordData[] = Array.from({ length: 50 }, (_, i) => ({
        collectionName: 'addresses',
        recordId: [i + 1],
        values,
      }));
      const { invoke, model } = buildModel(Array.from({ length: 6 }, (_, i) => `F${i}`));
      const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
      const runStore = makeMockRunStore();
      const context = makeContext({
        model,
        logger,
        agentPort: makeMockAgentPort(relatedData),
        runStore,
        workflowPort: makeMockWorkflowPort({
          customers: makeCollectionSchema(),
          addresses: wideSchema(6),
        }),
      });

      await new LoadRelatedRecordStepExecutor(context).execute();

      const shownRows = (selectRecordPrompt(invoke).match(/\[\d+\] \{/g) ?? []).length;
      expect(shownRows).toBeGreaterThan(1);
      expect(shownRows).toBeLessThan(50);
      // The warn carries the run-correlation context (logCtx) alongside the counters.
      expect(logger.warn).toHaveBeenCalledWith(
        'load-related-record: candidate list truncated for AI prompt',
        expect.objectContaining({ total: 50, runId: 'run-1', stepIndex: 0 }),
      );
      // The full list is still returned to the front, untrimmed.
      const saved = (runStore.saveStepExecution as jest.Mock).mock.calls.at(-1)?.[1];
      expect(saved.pendingData.availableRecordIds).toHaveLength(50);
    });

    // The AI sees only the budgeted prefix, but its index maps back into the FULL list — so a
    // non-zero pick must resolve to the correct full-list record (cap the prompt, not the data).
    it('maps a non-zero AI index back into the full candidate list after truncation', async () => {
      const big = 'y'.repeat(80);
      const values = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`f${i}`, big]));
      const relatedData: RecordData[] = Array.from({ length: 50 }, (_, i) => ({
        collectionName: 'addresses',
        recordId: [i + 1],
        values,
      }));
      const { model } = buildModel(
        Array.from({ length: 6 }, (_, i) => `F${i}`),
        5,
      ); // AI picks index 5
      const runStore = makeMockRunStore();
      const context = makeContext({
        model,
        logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
        agentPort: makeMockAgentPort(relatedData),
        runStore,
        workflowPort: makeMockWorkflowPort({
          customers: makeCollectionSchema(),
          addresses: wideSchema(6),
        }),
      });

      await new LoadRelatedRecordStepExecutor(context).execute();

      const saved = (runStore.saveStepExecution as jest.Mock).mock.calls.at(-1)?.[1];
      // relatedData[5] has recordId [6] — proves index 5 maps to the full array, not a truncated copy.
      expect(saved.pendingData.suggestedRecord.recordId).toEqual([6]);
      expect(saved.pendingData.availableRecordIds).toHaveLength(50);
    });

    it('clamps non-string field values: short stays intact, oversized object is truncated', async () => {
      const bigObject = { note: 'z'.repeat(120) };
      const relatedData: RecordData[] = [
        { collectionName: 'addresses', recordId: [1], values: { count: 42, meta: bigObject } },
        { collectionName: 'addresses', recordId: [2], values: { count: 7, meta: { note: 'ok' } } },
      ];
      const schema = makeCollectionSchema({
        collectionName: 'addresses',
        collectionDisplayName: 'Addresses',
        fields: [
          { fieldName: 'count', displayName: 'Count', isRelationship: false },
          { fieldName: 'meta', displayName: 'Meta', isRelationship: false },
        ],
      });
      const { invoke, model } = buildModel(['Count', 'Meta']);
      const context = makeContext({
        model,
        agentPort: makeMockAgentPort(relatedData),
        runStore: makeMockRunStore(),
        workflowPort: makeMockWorkflowPort({
          customers: makeCollectionSchema(),
          addresses: schema,
        }),
      });

      await new LoadRelatedRecordStepExecutor(context).execute();

      const content = selectRecordPrompt(invoke);
      expect(content).toContain('"count":42'); // number passes through unchanged (not stringified)
      expect(content).toContain('… (truncated)'); // oversized object value truncated
      expect(content).not.toContain('z'.repeat(120));
    });
  });

  describe('trigger before PATCH (Branch A)', () => {
    it('re-emits awaiting-input when userConfirmation is not yet set', async () => {
      const agentPort = makeMockAgentPort();
      const execution = makePendingExecution(); // userConfirmation not yet set
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

  describe('StepStateError on malformed schema', () => {
    // A relationship field with no relatedCollectionName can't be followed — throw rather than
    // silently falling back to the field name (which would 404 later as a bogus collection).
    it('returns error when the selected relation has no relatedCollectionName', async () => {
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
      const mockModel = makeMockModel({ relationName: 'Order', reasoning: 'test' });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        runStore,
        workflowPort: makeMockWorkflowPort({ customers: schema }),
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'An unexpected error occurred while processing this step.',
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
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
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
            relatedCollectionName: 'addresses',
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
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'The related record could not be found. It may have been deleted.',
      );
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('RunStorePortError post-load', () => {
    it('returns error outcome when saveStepExecution fails after load (Branch B)', async () => {
      const runStore = makeMockRunStore({
        saveStepExecution: jest
          .fn()
          .mockRejectedValue(new RunStorePortError('saveStepExecution', new Error('Disk full'))),
      });
      const context = makeContext({
        runId: 'run-1',
        stepIndex: 0,
        runStore,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe('The step state could not be accessed. Please retry.');
    });

    it('returns error outcome when saveStepExecution fails after load (Branch A confirmed)', async () => {
      const execution = makePendingExecution({
        pendingData: {
          availableFields: [
            { name: 'order', displayName: 'Order' },
            { name: 'address', displayName: 'Address' },
          ],
          suggestedField: { name: 'order', displayName: 'Order' },
          availableRecordIds: [cand([99])],
          suggestedRecord: cand([99]),
        },
        userConfirmation: { userConfirmed: true },
      });
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
        saveStepExecution: jest
          .fn()
          .mockRejectedValue(new RunStorePortError('saveStepExecution', new Error('Disk full'))),
      });
      const context = makeContext({ runId: 'run-1', stepIndex: 0, runStore });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe('The step state could not be accessed. Please retry.');
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
            relatedCollectionName: 'orders',
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
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
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
    // Uses HasMany ('Address') because xToOne reads from the parent record via getRecord,
    // not getRelatedData. The infra-error contract is the same for both port methods.
    it('returns error outcome for getRelatedData infrastructure errors (Branch B)', async () => {
      const agentPort = makeMockAgentPort();
      (agentPort.getRelatedData as jest.Mock).mockRejectedValue(new Error('Connection refused'));
      const mockModel = makeMockModel({ relationName: 'Address', reasoning: 'test' });
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();
      expect(result.stepOutcome.status).toBe('error');
    });

    it('returns error outcome for getRelatedData infrastructure errors (Branch C)', async () => {
      const agentPort = makeMockAgentPort();
      (agentPort.getRelatedData as jest.Mock).mockRejectedValue(new Error('Connection refused'));
      const mockModel = makeMockModel({ relationName: 'Address', reasoning: 'test' });
      const context = makeContext({ model: mockModel.model, agentPort });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();
      expect(result.stepOutcome.status).toBe('error');
    });

    it('returns user message and logs cause when agentPort.getRelatedData throws an infra error', async () => {
      const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
      const agentPort = makeMockAgentPort();
      (agentPort.getRelatedData as jest.Mock).mockRejectedValue(
        new AgentPortError('getRelatedData', new Error('DB connection lost')),
      );
      const mockModel = makeMockModel({ relationName: 'Address', reasoning: 'test' });
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        logger,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
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
            relatedCollectionName: 'invoices',
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
      const context = makeContext({
        baseRecordRef,
        model,
        runStore,
        workflowPort,
        agentPort,
        previousSteps: [makeLoadRelatedPreviousStep(2)],
      });
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
            suggestedField: { name: 'invoice', displayName: 'Invoice' },
            // xToOne path packs the related PK as a string via split('|') of the
            // agent's serialized relation id.
            suggestedRecord: cand(['55']),
          }),
          selectedRecordRef: expect.objectContaining({ recordId: [99], collectionName: 'orders' }),
        }),
      );
    });
  });

  describe('stepOutcome shape', () => {
    it('emits correct type, stepId and stepIndex in the outcome', async () => {
      const context = makeContext({
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
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
      const executor = new LoadRelatedRecordStepExecutor({
        ...context,
        stepId: 'load-2',
        stepIndex: 1,
      });

      await executor.execute();

      const messages = mockModel.invoke.mock.calls[0][0];
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toContain('Step executed by');
      expect(messages[0].content).toContain('Should we proceed?');
      expect(messages[0].content).toContain('"answer":"Yes"');
      expect(messages[0].content).toContain('loading a related record');
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
          availableFields: [
            { name: 'order', displayName: 'Order' },
            { name: 'address', displayName: 'Address' },
          ],
          suggestedField: { name: 'order', displayName: 'Order' },
          availableRecordIds: [cand([99])],
          suggestedRecord: cand([99]),
        },
        userConfirmation: { userConfirmed: false },
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
            relatedCollectionName: 'orders',
          },
        ],
      });
      const workflowPort = makeMockWorkflowPort({ customers: schema });
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        workflowPort,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      // BelongsTo → xToOne path: port's getSingleRelatedData method.
      expect(agentPort.getSingleRelatedData).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'customers',
          id: [42],
          relation: 'order',
        }),
        expect.objectContaining({ id: 1 }),
      );
      expect(agentPort.getRelatedData).not.toHaveBeenCalled();
    });
  });

  describe('schema caching', () => {
    // Both xToOne and HasMany now fetch the related schema (xToOne reads
    // relatedSchema.referenceField for the dropdown label projection). The test
    // asserts each schema is fetched at most once per run.
    it('fetches getCollectionSchema once per collection (parent + related, no duplicate fetches)', async () => {
      const workflowPort = makeMockWorkflowPort({
        customers: makeCollectionSchema(),
        addresses: makeCollectionSchema({
          collectionName: 'addresses',
          collectionDisplayName: 'Addresses',
        }),
      });
      const mockModel = makeMockModel({ relationName: 'Address', reasoning: 'Load address' });
      const context = makeContext({
        model: mockModel.model,
        workflowPort,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      await executor.execute();

      // Parent (customers) and related (addresses) — fetched once each, no duplicates.
      expect(workflowPort.getCollectionSchema).toHaveBeenCalledTimes(2);
      expect(workflowPort.getCollectionSchema).toHaveBeenCalledWith('customers', 'run-1');
      expect(workflowPort.getCollectionSchema).toHaveBeenCalledWith('addresses', 'run-1');
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
          availableFields: [{ name: 'invoice', displayName: 'Invoice' }],
          suggestedField: { name: 'invoice', displayName: 'Invoice' },
          availableRecordIds: [cand([55])],
          suggestedRecord: cand([55]),
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
            relatedCollectionName: 'orders',
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
      const context = makeContext({
        baseRecordRef,
        model,
        runStore,
        workflowPort,
        previousSteps: [makeLoadRelatedPreviousStep(2), makeLoadRelatedPreviousStep(3)],
      });
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
          executionType: StepExecutionMode.FullyAutomated,
          preRecordedArgs: { relationName: 'order' },
        }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(bindTools).not.toHaveBeenCalled();
      // Pre-recorded reference is the technical name 'order'; the persisted displayName 'Order'
      // is resolved from the schema, not received on the wire.
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionResult: expect.objectContaining({
            relation: { name: 'order', displayName: 'Order' },
          }),
        }),
      );
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
          executionType: StepExecutionMode.FullyAutomated,
          preRecordedArgs: { relationName: 'address', selectedRecordIndex: 1 },
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
          executionType: StepExecutionMode.FullyAutomated,
          preRecordedArgs: { relationName: 'address', selectedRecordIndex: 99 },
        }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
    });

    it('returns error when a pre-recorded relationName does not resolve', async () => {
      const { model } = makeMockModel();
      const context = makeContext({
        model,
        stepDefinition: makeStep({
          executionType: StepExecutionMode.FullyAutomated,
          preRecordedArgs: { relationName: 'does_not_exist' },
        }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
    });

    it('resolves a pre-recorded technical relationName to its own relation, not another whose displayName collides', async () => {
      const { model } = makeMockModel();
      const runStore = makeMockRunStore();
      // Relation B's displayName ('order') equals relation A's technical fieldName ('order').
      const workflowPort = makeMockWorkflowPort({
        customers: makeCollectionSchema({
          fields: [
            {
              fieldName: 'order',
              displayName: 'Linked Address',
              isRelationship: true,
              relationType: 'BelongsTo',
              relatedCollectionName: 'orders',
            },
            {
              fieldName: 'addr',
              displayName: 'order',
              isRelationship: true,
              relationType: 'BelongsTo',
              relatedCollectionName: 'addresses',
            },
          ],
        }),
      });
      const context = makeContext({
        model,
        runStore,
        workflowPort,
        stepDefinition: makeStep({
          executionType: StepExecutionMode.FullyAutomated,
          preRecordedArgs: { relationName: 'order' },
        }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      // Follows relation A ('order' / 'Linked Address'), not B ('addr' / displayName 'order').
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionResult: expect.objectContaining({
            relation: { name: 'order', displayName: 'Linked Address' },
          }),
        }),
      );
    });

    it('falls back to AI when no preRecordedArgs', async () => {
      const { model, bindTools } = makeMockModel({ relationName: 'Orders', reasoning: 'r' });
      const context = makeContext({
        model,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      await executor.execute();

      expect(bindTools).toHaveBeenCalled();
    });
  });

  describe('record pool after revision', () => {
    it('re-executes a revised load step from the base record, not from the dead branch record', async () => {
      // Given: the run loaded an owner before the user revised the "Load store" step. The
      // owner's execution survives in the RunStore (dead branch), but the cleaned
      // previousSteps no longer claims it.
      const mockModel = makeMockModel({ relationName: 'Order', reasoning: 'reload' });
      const agentPort = makeMockAgentPort();
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([
          {
            type: 'load-related-record',
            stepIndex: 2,
            executionResult: {
              relation: { name: 'owner', displayName: 'Owner' },
              record: makeRecordRef({ collectionName: 'owners', recordId: [7], stepIndex: 2 }),
            },
            selectedRecordRef: makeRecordRef(),
          },
        ]),
      });
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        runStore,
        previousSteps: [],
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
      const executor = new LoadRelatedRecordStepExecutor(context);

      // When
      const result = await executor.execute();

      // Then: the pool collapsed to the base record — no select-record round; the relation
      // was selected and loaded directly from the base record (previously the dead branch's
      // owner was offered as a source instead).
      expect(result.stepOutcome.status).toBe('success');
      expect(mockModel.bindTools).toHaveBeenCalledTimes(1);
      expect((mockModel.bindTools.mock.calls[0][0][0] as { name: string }).name).toBe(
        'select-relation',
      );
      expect(agentPort.getSingleRelatedData).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'customers',
          id: [42],
          relation: 'order',
        }),
        expect.objectContaining({ id: 1 }),
      );
    });
  });
});
