import type { AgentPort } from '../../src/ports/agent-port';
import type { RunStore } from '../../src/ports/run-store';
import type { WorkflowPort } from '../../src/ports/workflow-port';
import type { ExecutionContext } from '../../src/types/execution-context';
import type { CollectionSchema, RecordRef } from '../../src/types/validated/collection';
import type { Step } from '../../src/types/validated/execution';
import type { StepDefinition } from '../../src/types/validated/step-definition';

import activityLogContext from './activity-log-context';
import { ActivityLogCreationError, AgentPortError, RecordNotFoundError } from '../../src/errors';
import AgentWithLog from '../../src/executors/agent-with-log';
import LoadRelatedRecordStepExecutor from '../../src/executors/load-related-record-step-executor';
import ReadRecordStepExecutor from '../../src/executors/read-record-step-executor';
import TriggerRecordActionStepExecutor from '../../src/executors/trigger-record-action-step-executor';
import UpdateRecordStepExecutor from '../../src/executors/update-record-step-executor';
import SchemaCache from '../../src/schema-cache';
import SchemaResolver from '../../src/schema-resolver';
import {
  StepExecutionMode,
  StepType,
  WORKFLOW_START_STEP_ID,
} from '../../src/types/validated/step-definition';

const SCHEMAS: Record<string, CollectionSchema> = {
  claims: {
    collectionName: 'claims',
    collectionId: 'col-claims',
    collectionDisplayName: 'Claims',
    primaryKeyFields: ['id'],
    fields: [
      { fieldName: 'status', displayName: 'Status', isRelationship: false },
      {
        fieldName: 'customer',
        displayName: 'Customer',
        isRelationship: true,
        relationType: 'BelongsTo',
        relatedCollectionName: 'customers',
      },
    ],
    actions: [],
  },
  customers: {
    collectionName: 'customers',
    collectionId: 'col-customers',
    collectionDisplayName: 'Customers',
    primaryKeyFields: ['id'],
    fields: [
      { fieldName: 'name', displayName: 'Name', isRelationship: false },
      {
        fieldName: 'address',
        displayName: 'Address',
        isRelationship: true,
        relationType: 'HasOne',
        relatedCollectionName: 'addresses',
      },
      {
        fieldName: 'orders',
        displayName: 'Orders',
        isRelationship: true,
        relationType: 'HasMany',
        relatedCollectionName: 'orders',
      },
    ],
    actions: [],
  },
  addresses: {
    collectionName: 'addresses',
    collectionId: 'col-addresses',
    collectionDisplayName: 'Addresses',
    primaryKeyFields: ['id'],
    fields: [
      { fieldName: 'city', displayName: 'City', isRelationship: false, type: 'String' },
      {
        fieldName: 'country',
        displayName: 'Country',
        isRelationship: true,
        relationType: 'BelongsTo',
        relatedCollectionName: 'countries',
      },
    ],
    actions: [{ name: 'verify', displayName: 'Verify', endpoint: '/forest/actions/verify' }],
  },
  countries: {
    collectionName: 'countries',
    collectionId: 'col-countries',
    collectionDisplayName: 'Countries',
    primaryKeyFields: ['code'],
    fields: [{ fieldName: 'label', displayName: 'Label', isRelationship: false }],
    actions: [],
  },
};

const ROOT: RecordRef = { collectionName: 'claims', recordId: [3], stepIndex: 0 };

type Links = Record<string, string[] | null | Error>;

const DEFAULT_LINKS: Links = {
  'claims/3/customer': ['12'],
  'customers/12/address': ['78'],
};

function makeAgentPort(
  links: Links = DEFAULT_LINKS,
  recordReadError?: Error,
): jest.Mocked<AgentPort> {
  return {
    getRelatedRecordId: jest.fn(({ collection, id, relation }) => {
      const link = links[`${collection}/${id.join('|')}/${relation}`];
      if (link instanceof Error) return Promise.reject(link);

      return Promise.resolve(link ?? null);
    }),
    getRecord: jest.fn(({ collection, id }) => {
      if (recordReadError) return Promise.reject(recordReadError);

      return Promise.resolve({
        collectionName: collection,
        recordId: id,
        values: { city: 'Lyon', name: 'Ada' },
      });
    }),
    updateRecord: jest.fn(({ collection, id, values }) =>
      Promise.resolve({ collectionName: collection, recordId: id, values }),
    ),
    getRelatedData: jest.fn().mockResolvedValue([]),
    getSingleRelatedData: jest.fn().mockResolvedValue(null),
    resolvePolymorphicType: jest.fn().mockResolvedValue(null),
    executeAction: jest.fn().mockResolvedValue({ result: undefined }),
    getActionFormInfo: jest.fn().mockResolvedValue({ hasForm: false }),
    getActionForm: jest
      .fn()
      .mockResolvedValue({ fields: [], canExecute: true, requiredFields: [], skippedFields: [] }),
    probe: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AgentPort>;
}

function makeRunStore(executions: unknown[] = []): RunStore {
  return {
    init: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    getStepExecutions: jest.fn().mockResolvedValue(executions),
    saveStepExecution: jest.fn().mockResolvedValue(undefined),
    deleteStepExecution: jest.fn().mockResolvedValue(undefined),
  };
}

function makeWorkflowPort(): WorkflowPort {
  return {
    getAvailableRuns: jest.fn().mockResolvedValue({ pending: [], malformed: [] }),
    getAvailableRun: jest.fn().mockResolvedValue(null),
    updateStepExecution: jest.fn().mockResolvedValue(undefined),
    getCollectionSchema: jest.fn((name: string) => Promise.resolve(SCHEMAS[name])),
    getMcpServerConfigs: jest.fn().mockResolvedValue({}),
    hasRunAccess: jest.fn().mockResolvedValue(true),
    reportExecutorMetadata: jest.fn().mockResolvedValue(undefined),
    releaseRun: jest.fn().mockResolvedValue(undefined),
    renewRunLock: jest.fn().mockResolvedValue({ status: 'renewed', lockedAt: 'renewed-lock' }),
  };
}

function makeContext<TStep extends StepDefinition>(
  stepDefinition: TStep,
  {
    agentPort = makeAgentPort(),
    runStore = makeRunStore(),
    previousSteps = [],
  }: { agentPort?: AgentPort; runStore?: RunStore; previousSteps?: Step[] } = {},
): ExecutionContext<TStep> {
  const schemaResolver = new SchemaResolver(new SchemaCache(), makeWorkflowPort(), 'run-1', 1);
  const user = {
    id: 1,
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    team: 'admin',
    renderingId: 1,
    role: 'admin',
    permissionLevel: 'admin',
    tags: {},
  };
  const activityLog = activityLogContext();

  return {
    runId: 'run-1',
    stepId: 'step-1',
    stepIndex: 2,
    collectionId: 'col-claims',
    baseRecordRef: ROOT,
    stepDefinition,
    model: {} as ExecutionContext['model'],
    runStore,
    user,
    schemaResolver,
    previousSteps,
    timezone: 'UTC',
    logger: jest.fn(),
    activityLog,
    agent: new AgentWithLog({ agentPort, schemaResolver, user, activityLog }),
  };
}

const readStep = (preRecordedArgs: Record<string, unknown>) => ({
  type: StepType.ReadRecord as const,
  executionType: StepExecutionMode.FullyAutomated as const,
  title: 'Read address',
  preRecordedArgs: { fieldNames: ['city'], ...preRecordedArgs },
});

describe('a record step whose source is reached through to-one relations', () => {
  describe('on Get Data, from the starting record', () => {
    it('reads the record at the end of the path, with one agent call per hop plus one', async () => {
      const agentPort = makeAgentPort();
      const runStore = makeRunStore();
      const context = makeContext(
        readStep({
          selectedRecordStepId: WORKFLOW_START_STEP_ID,
          relationPath: ['customer', 'address'],
        }),
        { agentPort, runStore },
      );

      const result = await new ReadRecordStepExecutor(context).execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(agentPort.getRelatedRecordId.mock.calls.map(([query]) => query)).toEqual([
        {
          collection: 'claims',
          id: [3],
          relation: 'customer',
          relatedSchema: SCHEMAS.customers,
        },
        {
          collection: 'customers',
          id: ['12'],
          relation: 'address',
          relatedSchema: SCHEMAS.addresses,
        },
      ]);
      expect(agentPort.getRecord.mock.calls.map(([query]) => query)).toEqual([
        { collection: 'addresses', id: ['78'], fields: ['id'] },
        { collection: 'addresses', id: ['78'], fields: ['city'] },
      ]);
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          selectedRecordRef: { collectionName: 'addresses', recordId: ['78'], stepIndex: 0 },
          executionResult: { fields: [{ name: 'city', displayName: 'City', value: 'Lyon' }] },
        }),
      );
    });

    it('logs each hop as a related-data listing named after its relation', async () => {
      const agentPort = makeAgentPort();
      const context = makeContext(
        readStep({ selectedRecordStepId: WORKFLOW_START_STEP_ID, relationPath: ['customer'] }),
        { agentPort },
      );

      await new ReadRecordStepExecutor(context).execute();

      expect(agentPort.getRelatedRecordId).toHaveBeenCalledWith(
        expect.objectContaining({ relation: 'customer' }),
        expect.objectContaining({ id: 1 }),
        expect.objectContaining({ call: { label: 'list relation "Customer"' } }),
      );
    });
  });

  describe('when the path leads nowhere', () => {
    it.each([
      [
        'the last relation links no record',
        { 'claims/3/customer': ['12'], 'customers/12/address': null },
        'no Address was found at Starting record › Customer › Address.',
      ],
      [
        'the first relation links no record',
        { 'claims/3/customer': null },
        'no Customer was found at Starting record › Customer.',
      ],
      [
        'a record in the middle of the path is out of the caller’s scope',
        {
          'claims/3/customer': ['12'],
          'customers/12/address': new RecordNotFoundError('customers', ['12']),
        },
        'no Customer was found at Starting record › Customer.',
      ],
    ])('fails the step naming the missing record when %s', async (_case, links, message) => {
      const context = makeContext(
        readStep({
          selectedRecordStepId: WORKFLOW_START_STEP_ID,
          relationPath: ['customer', 'address'],
        }),
        { agentPort: makeAgentPort(links) },
      );

      const result = await new ReadRecordStepExecutor(context).execute();

      expect(result.stepOutcome).toMatchObject({
        status: 'error',
        error: `Couldn't run "Read address": ${message}`,
        errorKind: 'operator',
      });
    });

    it('fails the step when the record at the end is out of the caller’s scope', async () => {
      const context = makeContext(
        readStep({
          selectedRecordStepId: WORKFLOW_START_STEP_ID,
          relationPath: ['customer', 'address'],
        }),
        { agentPort: makeAgentPort(DEFAULT_LINKS, new RecordNotFoundError('addresses', ['78'])) },
      );

      const result = await new ReadRecordStepExecutor(context).execute();

      expect(result.stepOutcome.error).toBe(
        'Couldn\'t run "Read address": no Address was found at Starting record › Customer › Address.',
      );
    });

    it('keeps reporting a starting record that no longer exists as such', async () => {
      const context = makeContext(
        readStep({ selectedRecordStepId: WORKFLOW_START_STEP_ID, relationPath: ['customer'] }),
        {
          agentPort: makeAgentPort({
            'claims/3/customer': new RecordNotFoundError('claims', [3]),
          }),
        },
      );

      const result = await new ReadRecordStepExecutor(context).execute();

      expect(result.stepOutcome.error).toBe(
        'The record no longer exists. It may have been deleted.',
      );
    });
  });

  describe('when the person running the workflow cannot read a collection of the path', () => {
    it('fails the step naming the collection the hop leads to when the agent refuses the read', async () => {
      const refusal = new AgentPortError('getRelatedRecordId', { status: 403 });
      const context = makeContext(
        readStep({
          selectedRecordStepId: WORKFLOW_START_STEP_ID,
          relationPath: ['customer', 'address'],
        }),
        {
          agentPort: makeAgentPort({
            'claims/3/customer': ['12'],
            'customers/12/address': refusal,
          }),
        },
      );

      const result = await new ReadRecordStepExecutor(context).execute();

      expect(result.stepOutcome).toMatchObject({
        status: 'error',
        error:
          'Couldn\'t run "Read address": the user running this workflow can\'t access Addresses.',
        errorKind: 'configuration',
      });
    });

    it('reports a refused activity log as an audit log failure, not as a refused collection', async () => {
      const context = makeContext(
        readStep({
          selectedRecordStepId: WORKFLOW_START_STEP_ID,
          relationPath: ['customer', 'address'],
        }),
        {
          agentPort: makeAgentPort({
            'claims/3/customer': ['12'],
            'customers/12/address': new ActivityLogCreationError({ reason: 'notAuthorized' }),
          }),
        },
      );

      const result = await new ReadRecordStepExecutor(context).execute();

      expect(result.stepOutcome).toMatchObject({
        status: 'error',
        error:
          'Could not record this step in the audit log. Please try again, or contact your administrator if the problem persists.',
      });
    });

    it('names the collection at the end of the path when its record is refused', async () => {
      const context = makeContext(
        readStep({ selectedRecordStepId: WORKFLOW_START_STEP_ID, relationPath: ['customer'] }),
        {
          agentPort: makeAgentPort(DEFAULT_LINKS, new AgentPortError('getRecord', { status: 403 })),
        },
      );

      const result = await new ReadRecordStepExecutor(context).execute();

      expect(result.stepOutcome.error).toBe(
        'Couldn\'t run "Read address": the user running this workflow can\'t access Customers.',
      );
    });

    it('keeps any other agent failure as it is', async () => {
      const context = makeContext(
        readStep({ selectedRecordStepId: WORKFLOW_START_STEP_ID, relationPath: ['customer'] }),
        {
          agentPort: makeAgentPort({
            'claims/3/customer': new AgentPortError('getRelatedRecordId', { status: 500 }),
          }),
        },
      );

      const result = await new ReadRecordStepExecutor(context).execute();

      expect(result.stepOutcome.error).toBe(
        'An error occurred while accessing your data. Please try again.',
      );
    });
  });

  it.each([
    ['a to-many relation', ['customer', 'orders']],
    ['a relation the collection does not have', ['customer', 'invoice']],
  ])('refuses a path through %s as a configuration error', async (_case, relationPath) => {
    const agentPort = makeAgentPort();
    const context = makeContext(
      readStep({ selectedRecordStepId: WORKFLOW_START_STEP_ID, relationPath }),
      { agentPort },
    );

    const result = await new ReadRecordStepExecutor(context).execute();

    expect(result.stepOutcome).toMatchObject({
      status: 'error',
      error: 'The pre-configured step parameters are invalid',
      errorKind: 'configuration',
    });
    expect(agentPort.getRecord).not.toHaveBeenCalled();
  });

  describe('from a record a Load Related Record step loaded', () => {
    const loadStep: Step = {
      stepDefinition: {
        type: StepType.LoadRelatedRecord,
        executionType: StepExecutionMode.FullyAutomated,
        title: 'Find claim',
      },
      stepOutcome: { type: 'record', stepId: 'find-claim', stepIndex: 1, status: 'success' },
    };
    const loaded: RecordRef = { collectionName: 'claims', recordId: [9], stepIndex: 1 };
    const loadExecution = {
      type: 'load-related-record',
      stepIndex: 1,
      executionResult: { relation: { name: 'claim', displayName: 'Claim' }, record: loaded },
    };

    it('starts the path from the loaded record', async () => {
      const agentPort = makeAgentPort({ 'claims/9/customer': ['44'] });
      const runStore = makeRunStore([loadExecution]);
      const context = makeContext(
        readStep({
          selectedRecordStepId: 'find-claim',
          relationPath: ['customer'],
          fieldNames: ['name'],
        }),
        { agentPort, runStore, previousSteps: [loadStep] },
      );

      const result = await new ReadRecordStepExecutor(context).execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          selectedRecordRef: { collectionName: 'customers', recordId: ['44'], stepIndex: 1 },
        }),
      );
    });

    it('names the loading step at the start of the path when a record is missing', async () => {
      const context = makeContext(
        readStep({ selectedRecordStepId: 'find-claim', relationPath: ['customer'] }),
        {
          agentPort: makeAgentPort({ 'claims/9/customer': null }),
          runStore: makeRunStore([loadExecution]),
          previousSteps: [loadStep],
        },
      );

      const result = await new ReadRecordStepExecutor(context).execute();

      expect(result.stepOutcome.error).toBe(
        'Couldn\'t run "Read address": no Customer was found at "Find claim" › Customer.',
      );
    });
  });

  it('writes on the record at the end of the path on Update Data', async () => {
    const agentPort = makeAgentPort();
    const context = makeContext(
      {
        type: StepType.UpdateRecord,
        executionType: StepExecutionMode.FullyAutomated,
        title: 'Fix city',
        preRecordedArgs: {
          selectedRecordStepId: WORKFLOW_START_STEP_ID,
          relationPath: ['customer', 'address'],
          fieldName: 'city',
          value: 'Paris',
        },
      },
      { agentPort },
    );

    const result = await new UpdateRecordStepExecutor(context).execute();

    expect(result.stepOutcome.status).toBe('success');
    expect(agentPort.updateRecord).toHaveBeenCalledWith(
      { collection: 'addresses', id: ['78'], values: { city: 'Paris' } },
      expect.objectContaining({ id: 1 }),
      expect.anything(),
    );
  });

  it('refuses to write when the path leads nowhere on Update Data', async () => {
    const agentPort = makeAgentPort({ 'claims/3/customer': null });
    const context = makeContext(
      {
        type: StepType.UpdateRecord,
        executionType: StepExecutionMode.FullyAutomated,
        title: 'Fix city',
        preRecordedArgs: {
          selectedRecordStepId: WORKFLOW_START_STEP_ID,
          relationPath: ['customer', 'address'],
          fieldName: 'city',
          value: 'Paris',
        },
      },
      { agentPort },
    );

    const result = await new UpdateRecordStepExecutor(context).execute();

    expect(result.stepOutcome.error).toBe(
      'Couldn\'t run "Fix city": no Customer was found at Starting record › Customer.',
    );
    expect(agentPort.updateRecord).not.toHaveBeenCalled();
  });

  it('runs the action on the record at the end of the path on Trigger Action', async () => {
    const agentPort = makeAgentPort();
    const context = makeContext(
      {
        type: StepType.TriggerAction,
        executionType: StepExecutionMode.FullyAutomated,
        title: 'Verify address',
        preRecordedArgs: {
          selectedRecordStepId: WORKFLOW_START_STEP_ID,
          relationPath: ['customer', 'address'],
          actionName: 'verify',
        },
      },
      { agentPort },
    );

    const result = await new TriggerRecordActionStepExecutor(context).execute();

    expect(result.stepOutcome.status).toBe('success');
    expect(agentPort.executeAction).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'addresses', action: 'verify', id: ['78'] }),
      expect.anything(),
      expect.anything(),
    );
  });

  it('follows its relation from the record at the end of the path on Load Related Record', async () => {
    const agentPort = makeAgentPort();
    agentPort.getSingleRelatedData.mockResolvedValue({
      collectionName: 'countries',
      recordId: ['FR'],
      values: { label: 'France' },
    });
    const context = makeContext(
      {
        type: StepType.LoadRelatedRecord,
        executionType: StepExecutionMode.FullyAutomated,
        title: 'Load country',
        preRecordedArgs: {
          selectedRecordStepId: WORKFLOW_START_STEP_ID,
          relationPath: ['customer', 'address'],
          relationName: 'country',
        },
      },
      { agentPort },
    );

    await new LoadRelatedRecordStepExecutor(context).execute();

    expect(agentPort.getSingleRelatedData).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'addresses', id: ['78'], relation: 'country' }),
      expect.anything(),
      expect.anything(),
    );
  });
});
