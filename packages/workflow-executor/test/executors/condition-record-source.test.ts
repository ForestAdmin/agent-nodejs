import type { AgentPort } from '../../src/ports/agent-port';
import type { RunStore } from '../../src/ports/run-store';
import type { WorkflowPort } from '../../src/ports/workflow-port';
import type { ExecutionContext } from '../../src/types/execution-context';
import type { StepExecutionData } from '../../src/types/step-execution-data';
import type { CollectionSchema, RecordRef } from '../../src/types/validated/collection';
import type { Step } from '../../src/types/validated/execution';
import type { ConditionStepDefinition } from '../../src/types/validated/step-definition';
import type { ConditionStepOutcome } from '../../src/types/validated/step-outcome';
import type { z } from 'zod';

import activityLogContext from './activity-log-context';
import { AgentPortError, RecordNotFoundError } from '../../src/errors';
import AgentWithLog from '../../src/executors/agent-with-log';
import ConditionStepExecutor from '../../src/executors/condition-step-executor';
import SchemaCache from '../../src/schema-cache';
import SchemaResolver from '../../src/schema-resolver';
import {
  ConditionStepDefinitionSchema,
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
    ],
    actions: [],
  },
  addresses: {
    collectionName: 'addresses',
    collectionId: 'col-addresses',
    collectionDisplayName: 'Addresses',
    primaryKeyFields: ['id'],
    fields: [
      { fieldName: 'city', displayName: 'City', isRelationship: false },
      { fieldName: 'zip', displayName: 'Zip', isRelationship: false },
    ],
    actions: [],
  },
};

const ROOT: RecordRef = { collectionName: 'claims', recordId: [3], stepIndex: 0 };

type Links = Record<string, string[] | null | Error>;
type Values = Record<string, Record<string, unknown> | Error>;

const DEFAULT_LINKS: Links = {
  'claims/3/customer': ['12'],
  'customers/12/address': ['78'],
};

const DEFAULT_VALUES: Values = {
  'claims/3': { status: 'open' },
  'addresses/78': { city: 'Lyon', zip: '69001' },
};

function makeAgentPort(links: Links = DEFAULT_LINKS, values: Values = DEFAULT_VALUES) {
  return {
    getRelatedRecordId: jest.fn(({ collection, id, relation }) => {
      const link = links[`${collection}/${id.join('|')}/${relation}`];
      if (link instanceof Error) return Promise.reject(link);

      return Promise.resolve(link ?? null);
    }),
    getRecord: jest.fn(({ collection, id, fields }) => {
      const record = values[`${collection}/${id.join('|')}`] ?? {};
      if (record instanceof Error) return Promise.reject(record);

      const projected = Object.fromEntries(
        Object.entries(record).filter(([name]) => fields.includes(name)),
      );

      return Promise.resolve({ collectionName: collection, recordId: id, values: projected });
    }),
  } as unknown as jest.Mocked<AgentPort>;
}

function makeRunStore(executions: StepExecutionData[] = []): jest.Mocked<RunStore> {
  return {
    init: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    getStepExecutions: jest.fn().mockResolvedValue(executions),
    saveStepExecution: jest.fn().mockResolvedValue(undefined),
    deleteStepExecution: jest.fn().mockResolvedValue(undefined),
  } as jest.Mocked<RunStore>;
}

function makeWorkflowPort(): WorkflowPort {
  return {
    getCollectionSchema: jest.fn((name: string) => Promise.resolve(SCHEMAS[name])),
  } as unknown as WorkflowPort;
}

type ConditionPreRecordedArgs = NonNullable<
  z.input<typeof ConditionStepDefinitionSchema>['preRecordedArgs']
>;
type ConditionInput = Record<string, unknown>;

function makeStep(optionConditions: ConditionPreRecordedArgs['optionConditions']) {
  return ConditionStepDefinitionSchema.parse({
    type: StepType.Condition,
    executionType: StepExecutionMode.Manual,
    title: 'Route the claim',
    options: [...optionConditions.map(o => o.option), 'Other'],
    preRecordedArgs: { optionConditions, fallbackOption: 'Other' },
  });
}

const recordCondition = (overrides: ConditionInput = {}): ConditionInput => ({
  sourceType: 'record',
  sourceStepId: WORKFLOW_START_STEP_ID,
  relationPath: ['customer', 'address'],
  fieldName: 'city',
  operator: 'equal',
  value: 'Lyon',
  ...overrides,
});

const option = (name: string, ...conditions: ConditionInput[]) => ({
  option: name,
  aggregator: 'and' as const,
  conditions: conditions as ConditionPreRecordedArgs['optionConditions'][number]['conditions'],
});

function makeContext(
  stepDefinition: ConditionStepDefinition,
  {
    agentPort = makeAgentPort(),
    runStore = makeRunStore(),
    previousSteps = [],
  }: { agentPort?: AgentPort; runStore?: RunStore; previousSteps?: Step[] } = {},
): ExecutionContext<ConditionStepDefinition> {
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
    stepId: 'cond-1',
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

const loadStep = (stepIndex = 1): Step => ({
  stepDefinition: {
    type: StepType.LoadRelatedRecord,
    executionType: StepExecutionMode.FullyAutomated,
    title: 'Load customers',
  },
  stepOutcome: { type: 'record', stepId: 'load-1', stepIndex, status: 'success' },
});

const customer = (id: string): RecordRef => ({
  collectionName: 'customers',
  recordId: [id],
  stepIndex: 1,
});

const loadExecution = (
  executionResult: Extract<StepExecutionData, { type: 'load-related-record' }>['executionResult'],
): StepExecutionData => ({ type: 'load-related-record', stepIndex: 1, executionResult });

const relation = { name: 'customer', displayName: 'Customer' } as never;

async function run(context: ExecutionContext<ConditionStepDefinition>) {
  const result = await new ConditionStepExecutor(context).execute();

  return result.stepOutcome as ConditionStepOutcome;
}

function savedEvaluations(runStore: jest.Mocked<RunStore>) {
  const [, saved] = runStore.saveStepExecution.mock.calls.at(-1) as [string, StepExecutionData];

  return ((saved as { executionParams: unknown }).executionParams as { evaluations: unknown[] })
    .evaluations;
}

describe('a decision on a record reached through to-one relations', () => {
  describe('from the starting record', () => {
    it('compares the field of the record at the end of the path, read in n + 1 agent calls', async () => {
      const agentPort = makeAgentPort();
      const context = makeContext(makeStep([option('In Lyon', recordCondition())]), {
        agentPort,
      });

      const outcome = await run(context);

      expect(outcome).toMatchObject({ status: 'success', selectedOption: 'In Lyon' });
      expect(agentPort.getRelatedRecordId).toHaveBeenCalledTimes(2);
      expect(agentPort.getRecord).toHaveBeenCalledTimes(1);
      expect(agentPort.getRecord).toHaveBeenCalledWith(
        { collection: 'addresses', id: ['78'], fields: ['city'] },
        expect.anything(),
        expect.anything(),
      );
    });

    it('reads the starting record itself when the condition has no relation path', async () => {
      const agentPort = makeAgentPort();
      const context = makeContext(
        makeStep([
          option(
            'Open',
            recordCondition({ relationPath: undefined, fieldName: 'status', value: 'open' }),
          ),
        ]),
        { agentPort },
      );

      const outcome = await run(context);

      expect(outcome.selectedOption).toBe('Open');
      expect(agentPort.getRelatedRecordId).not.toHaveBeenCalled();
      expect(agentPort.getRecord).toHaveBeenCalledWith(
        { collection: 'claims', id: [3], fields: ['status'] },
        expect.anything(),
        expect.anything(),
      );
    });

    it('reads a record once with every field its conditions compare', async () => {
      const agentPort = makeAgentPort();
      const context = makeContext(
        makeStep([
          option(
            'Lyon centre',
            recordCondition(),
            recordCondition({ fieldName: 'zip', value: '69001' }),
          ),
          option('Elsewhere', recordCondition({ operator: 'not_equal' })),
        ]),
        { agentPort },
      );

      const outcome = await run(context);

      expect(outcome.selectedOption).toBe('Lyon centre');
      expect(agentPort.getRelatedRecordId).toHaveBeenCalledTimes(2);
      expect(agentPort.getRecord).toHaveBeenCalledTimes(1);
      expect(agentPort.getRecord.mock.calls[0][0].fields).toEqual(['city', 'zip']);
    });

    it('reads nothing for an option past the one that matched', async () => {
      const agentPort = makeAgentPort();
      const context = makeContext(
        makeStep([
          option(
            'Open',
            recordCondition({ relationPath: undefined, fieldName: 'status', value: 'open' }),
          ),
          option('In Lyon', recordCondition()),
        ]),
        { agentPort },
      );

      const outcome = await run(context);

      expect(outcome.selectedOption).toBe('Open');
      expect(agentPort.getRelatedRecordId).not.toHaveBeenCalled();
    });

    it('counts the condition as not met when a relation of the path links no record', async () => {
      const runStore = makeRunStore();
      const context = makeContext(makeStep([option('In Lyon', recordCondition())]), {
        agentPort: makeAgentPort({ 'claims/3/customer': ['12'], 'customers/12/address': null }),
        runStore,
      });

      const outcome = await run(context);

      expect(outcome).toMatchObject({ status: 'success', selectedOption: 'Other' });
      expect(savedEvaluations(runStore)).toEqual([
        {
          option: 'In Lyon',
          outcome: 'not-matched',
          conditions: [{ index: 0, met: null, reason: 'record-not-found' }],
        },
      ]);
    });

    it('counts the condition as not met when the starting record is gone', async () => {
      const runStore = makeRunStore();
      const context = makeContext(makeStep([option('In Lyon', recordCondition())]), {
        agentPort: makeAgentPort({
          'claims/3/customer': new RecordNotFoundError('claims', [3]),
        }),
        runStore,
      });

      const outcome = await run(context);

      expect(outcome).toMatchObject({ status: 'success', selectedOption: 'Other' });
      expect(savedEvaluations(runStore)).toEqual([
        expect.objectContaining({
          conditions: [{ index: 0, met: null, reason: 'record-not-found' }],
        }),
      ]);
    });

    it('stops the step when the user cannot read a collection of the path', async () => {
      const context = makeContext(makeStep([option('In Lyon', recordCondition())]), {
        agentPort: makeAgentPort({
          'claims/3/customer': ['12'],
          'customers/12/address': new AgentPortError('getRelatedRecordId', { status: 403 }),
        }),
      });

      const outcome = await run(context);

      expect(outcome.status).toBe('error');
      expect(outcome.error).toBe(
        `Couldn't run "Route the claim": the user running this workflow can't access Addresses.`,
      );
    });
  });

  describe('from a Load Related Record step', () => {
    const fromLoad = (overrides: ConditionInput = {}) =>
      recordCondition({ sourceStepId: 'load-1', relationPath: ['address'], ...overrides });

    it('follows the path from the record the step loaded', async () => {
      const agentPort = makeAgentPort();
      const context = makeContext(makeStep([option('In Lyon', fromLoad())]), {
        agentPort,
        previousSteps: [loadStep()],
        runStore: makeRunStore([loadExecution({ relation, record: customer('12') })]),
      });

      const outcome = await run(context);

      expect(outcome.selectedOption).toBe('In Lyon');
      expect(agentPort.getRelatedRecordId).toHaveBeenCalledTimes(1);
    });

    it('counts the condition as not met when the step loaded no record', async () => {
      const runStore = makeRunStore([loadExecution({ skipped: true })]);
      const context = makeContext(makeStep([option('In Lyon', fromLoad())]), {
        previousSteps: [loadStep()],
        runStore,
      });

      const outcome = await run(context);

      expect(outcome.selectedOption).toBe('Other');
      expect(savedEvaluations(runStore)).toEqual([
        expect.objectContaining({
          conditions: [{ index: 0, met: null, reason: 'record-not-found' }],
        }),
      ]);
    });

    it('counts the condition as not met when the step was not reached', async () => {
      const runStore = makeRunStore();
      const context = makeContext(makeStep([option('In Lyon', fromLoad())]), { runStore });

      const outcome = await run(context);

      expect(outcome.selectedOption).toBe('Other');
      expect(savedEvaluations(runStore)).toEqual([
        expect.objectContaining({
          conditions: [{ index: 0, met: null, reason: 'source-step-not-reached' }],
        }),
      ]);
    });

    describe('that loaded several records', () => {
      const severalLoaded = () =>
        makeRunStore([loadExecution({ relation, records: [customer('12'), customer('13')] })]);
      const links: Links = { 'customers/12/address': ['78'], 'customers/13/address': ['79'] };
      const values: Values = {
        'addresses/78': { city: 'Lyon' },
        'addresses/79': { city: 'Paris' },
      };

      it.each([
        ['any', 'In Lyon'],
        ['every', 'Other'],
        ['none', 'Other'],
      ])('reads one value per record and applies "%s"', async (quantifier, expected) => {
        const runStore = severalLoaded();
        const context = makeContext(makeStep([option('In Lyon', fromLoad({ quantifier }))]), {
          agentPort: makeAgentPort(links, values),
          previousSteps: [loadStep()],
          runStore,
        });

        const outcome = await run(context);

        expect(outcome.selectedOption).toBe(expected);
      });

      it('leaves a record the path leads nowhere from unchecked', async () => {
        const runStore = severalLoaded();
        const context = makeContext(
          makeStep([option('All in Lyon', fromLoad({ quantifier: 'every' }))]),
          {
            agentPort: makeAgentPort(
              { 'customers/12/address': ['78'], 'customers/13/address': null },
              values,
            ),
            previousSteps: [loadStep()],
            runStore,
          },
        );

        const outcome = await run(context);

        expect(outcome.status).toBe('awaiting-input');
        const [, saved] = runStore.saveStepExecution.mock.calls[0];
        expect(
          ((saved as { executionParams: unknown }).executionParams as { unchecked: string[] })
            .unchecked,
        ).toEqual(['13']);
      });

      it('leaves a loaded record that is gone unchecked instead of failing the decision', async () => {
        const runStore = severalLoaded();
        const context = makeContext(
          makeStep([option('All in Lyon', fromLoad({ quantifier: 'every' }))]),
          {
            agentPort: makeAgentPort(
              {
                'customers/12/address': ['78'],
                'customers/13/address': new RecordNotFoundError('customers', ['13']),
              },
              values,
            ),
            previousSteps: [loadStep()],
            runStore,
          },
        );

        const outcome = await run(context);

        expect(outcome.status).toBe('awaiting-input');
        const [, saved] = runStore.saveStepExecution.mock.calls[0];
        expect(
          ((saved as { executionParams: unknown }).executionParams as { unchecked: string[] })
            .unchecked,
        ).toEqual(['13']);
      });

      it('names each record of a Load Related Record running once per record by the record it ran for', async () => {
        const runStore = makeRunStore([
          {
            type: 'load-related-record',
            stepIndex: 1,
            iterations: [
              {
                sourceRecordRef: { collectionName: 'claims', recordId: ['1'], stepIndex: 0 },
                attempt: 1,
                executionResult: { relation, record: customer('12') },
              },
              {
                sourceRecordRef: { collectionName: 'claims', recordId: ['2'], stepIndex: 0 },
                attempt: 1,
                executionResult: { skipped: true },
              },
            ],
          } as unknown as StepExecutionData,
        ]);
        const context = makeContext(
          makeStep([option('All in Lyon', fromLoad({ quantifier: 'every' }))]),
          { agentPort: makeAgentPort(links, values), previousSteps: [loadStep()], runStore },
        );

        const outcome = await run(context);

        expect(outcome.status).toBe('awaiting-input');
        const [, saved] = runStore.saveStepExecution.mock.calls[0];
        expect(
          ((saved as { executionParams: unknown }).executionParams as { unchecked: string[] })
            .unchecked,
        ).toEqual(['2']);
      });

      it('refuses a condition without a quantifier', async () => {
        const context = makeContext(makeStep([option('In Lyon', fromLoad())]), {
          agentPort: makeAgentPort(links, values),
          previousSteps: [loadStep()],
          runStore: severalLoaded(),
        });

        const outcome = await run(context);

        expect(outcome.status).toBe('error');
      });
    });
  });

  describe('step definition', () => {
    const parse = (condition: ConditionInput) =>
      ConditionStepDefinitionSchema.safeParse({
        type: StepType.Condition,
        executionType: StepExecutionMode.Manual,
        options: ['A', 'Other'],
        preRecordedArgs: { optionConditions: [option('A', condition)], fallbackOption: 'Other' },
      });

    it('accepts a record source with or without a relation path', () => {
      expect(parse(recordCondition()).success).toBe(true);
      expect(parse(recordCondition({ relationPath: undefined })).success).toBe(true);
    });

    it.each([
      ['on a Get Data source', { sourceType: 'get-data', sourceStepId: 'read-1' }],
      ['longer than 3 relations', { relationPath: ['a', 'b', 'c', 'd'] }],
      ['empty', { relationPath: [] }],
      ['with a blank relation', { relationPath: ['customer', ''] }],
    ])('refuses a relation path %s', (_, overrides) => {
      expect(parse(recordCondition(overrides)).success).toBe(false);
    });
  });
});
