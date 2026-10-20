import type { RunControl, StepContextConfig } from '../../src/executors/step-executor-factory';
import type { ActivityLogPort } from '../../src/ports/activity-log-port';
import type { AgentPort } from '../../src/ports/agent-port';
import type { WorkflowPort } from '../../src/ports/workflow-port';
import type { AvailableStepExecution } from '../../src/types/execution-context';
import type { StepExecutionData, StepIteration } from '../../src/types/step-execution-data';
import type { CollectionSchema, RecordRef } from '../../src/types/validated/collection';
import type { Step } from '../../src/types/validated/execution';
import type { StepDefinition } from '../../src/types/validated/step-definition';

import StepExecutorFactory from '../../src/executors/step-executor-factory';
import SchemaCache from '../../src/schema-cache';
import InMemoryStore from '../../src/stores/in-memory-store';
import {
  StepExecutionMode,
  StepType,
  WORKFLOW_START_STEP_ID,
} from '../../src/types/validated/step-definition';

const RUN_ID = 'run-1';
const COMPANY: RecordRef = { collectionName: 'companies', recordId: [7], stepIndex: 0 };
const ubo = (id: number): RecordRef => ({ collectionName: 'ubos', recordId: [id], stepIndex: 1 });
const address = (id: number): RecordRef => ({
  collectionName: 'addresses',
  recordId: [id],
  stepIndex: 2,
});

const SCHEMAS: Record<string, CollectionSchema> = {
  companies: {
    collectionName: 'companies',
    collectionId: 'col-companies',
    collectionDisplayName: 'Companies',
    primaryKeyFields: ['id'],
    fields: [
      {
        fieldName: 'ubos',
        displayName: 'UBOs',
        isRelationship: true,
        relationType: 'HasMany',
        relatedCollectionName: 'ubos',
      },
    ],
    actions: [],
  },
  ubos: {
    collectionName: 'ubos',
    collectionId: 'col-ubos',
    collectionDisplayName: 'UBOs',
    primaryKeyFields: ['id'],
    fields: [
      { fieldName: 'pep', displayName: 'PEP', isRelationship: false, type: 'Boolean' },
      { fieldName: 'note', displayName: 'Note', isRelationship: false, type: 'String' },
      {
        fieldName: 'address',
        displayName: 'Address',
        isRelationship: true,
        relationType: 'BelongsTo',
        relatedCollectionName: 'addresses',
      },
      {
        fieldName: 'documents',
        displayName: 'Documents',
        isRelationship: true,
        relationType: 'HasMany',
        relatedCollectionName: 'documents',
      },
    ],
    actions: [],
  },
  addresses: {
    collectionName: 'addresses',
    collectionId: 'col-addresses',
    collectionDisplayName: 'Addresses',
    primaryKeyFields: ['id'],
    fields: [{ fieldName: 'city', displayName: 'City', isRelationship: false, type: 'String' }],
    actions: [],
  },
};

const LOAD_UBOS: Step = {
  stepDefinition: {
    type: StepType.LoadRelatedRecord,
    executionType: StepExecutionMode.Manual,
    title: 'Load UBOs',
    preRecordedArgs: {
      selectedRecordStepId: WORKFLOW_START_STEP_ID,
      relationName: 'ubos',
      multiple: true,
    },
  },
  stepOutcome: { type: 'record', stepId: 'load-ubos', stepIndex: 1, status: 'success' },
};

const LOAD_ADDRESS: Step = {
  stepDefinition: {
    type: StepType.LoadRelatedRecord,
    executionType: StepExecutionMode.FullyAutomated,
    title: 'Load UBO address',
    preRecordedArgs: { selectedRecordStepId: 'load-ubos', relationName: 'address' },
  },
  stepOutcome: { type: 'record', stepId: 'load-address', stepIndex: 2, status: 'success' },
};

function loadedUbos(records: RecordRef[] = [ubo(1), ubo(2), ubo(3)]): StepExecutionData {
  return {
    type: 'load-related-record',
    stepIndex: 1,
    executionParams: { name: 'ubos', displayName: 'UBOs' },
    executionResult: { relation: { name: 'ubos', displayName: 'UBOs' }, records },
    selectedRecordRef: COMPANY,
  };
}

function makeAgentPort(overrides: Partial<AgentPort> = {}): jest.Mocked<AgentPort> {
  return {
    getRecord: jest.fn(async ({ collection, id }: { collection: string; id: unknown[] }) => ({
      collectionName: collection,
      recordId: id,
      values: { pep: id[0] === 2, note: `note-of-${id[0]}`, city: `city-of-${id[0]}` },
    })),
    updateRecord: jest.fn(
      async ({
        collection,
        id,
        values,
      }: {
        collection: string;
        id: unknown[];
        values: Record<string, unknown>;
      }) => ({ collectionName: collection, recordId: id, values }),
    ),
    getRelatedData: jest.fn().mockResolvedValue([]),
    getSingleRelatedData: jest.fn().mockResolvedValue(null),
    resolvePolymorphicType: jest.fn().mockResolvedValue(null),
    executeAction: jest.fn().mockResolvedValue({ result: undefined }),
    getActionFormInfo: jest.fn().mockResolvedValue({ hasForm: false }),
    getActionForm: jest.fn(),
    probe: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as jest.Mocked<AgentPort>;
}

function makeModel(invoke = jest.fn()) {
  return { invoke, bindTools: jest.fn().mockReturnValue({ invoke }) };
}

const activityLogPort: ActivityLogPort = {
  createPending: jest.fn().mockResolvedValue({ id: 'log-1', index: '0' }),
  markSucceeded: jest.fn().mockResolvedValue(undefined),
  markFailed: jest.fn().mockResolvedValue(undefined),
};

function makeRunControl(...answers: Array<'continue' | 'stop' | 'yield'>): jest.Mocked<RunControl> {
  const beforeRecord = jest.fn();
  answers.forEach(answer => beforeRecord.mockResolvedValueOnce(answer));
  beforeRecord.mockResolvedValue('continue');

  return { beforeRecord } as jest.Mocked<RunControl>;
}

function makeStep(
  stepDefinition: StepDefinition,
  overrides: Partial<AvailableStepExecution> = {},
): AvailableStepExecution {
  return {
    runId: RUN_ID,
    stepId: 'current-step',
    stepIndex: 3,
    collectionId: 'col-companies',
    triggerType: 'manual',
    baseRecordRef: COMPANY,
    stepDefinition,
    previousSteps: [LOAD_UBOS],
    user: {
      id: 1,
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      team: 'Operations',
      renderingId: 1,
      role: 'admin',
      permissionLevel: 'admin',
      tags: {},
    },
    timezone: 'UTC',
    ...overrides,
  } as AvailableStepExecution;
}

const readUbos = (overrides: Record<string, unknown> = {}): StepDefinition => ({
  type: StepType.ReadRecord,
  executionType: StepExecutionMode.FullyAutomated,
  title: 'Get UBO data',
  preRecordedArgs: { selectedRecordStepId: 'load-ubos', fieldNames: ['pep'], ...overrides },
});

const updateUbos = (
  executionType: StepExecutionMode.AutomatedWithConfirmation | StepExecutionMode.FullyAutomated,
): StepDefinition => ({
  type: StepType.UpdateRecord,
  executionType,
  title: 'Flag UBOs',
  preRecordedArgs: { selectedRecordStepId: 'load-ubos', fieldName: 'note', value: 'checked' },
});

async function setup({
  stepDefinition,
  stored = [loadedUbos()],
  previousSteps = [LOAD_UBOS],
  agentPort = makeAgentPort(),
  model = makeModel(),
  runControl = makeRunControl(),
  stepTimeoutS,
}: {
  stepDefinition: StepDefinition;
  stored?: StepExecutionData[];
  previousSteps?: Step[];
  agentPort?: jest.Mocked<AgentPort>;
  model?: ReturnType<typeof makeModel>;
  runControl?: jest.Mocked<RunControl>;
  stepTimeoutS?: number;
}) {
  const runStore = new InMemoryStore();
  await Promise.all(stored.map(execution => runStore.saveStepExecution(RUN_ID, execution)));
  const workflowPort = {
    getCollectionSchema: jest.fn(async (name: string) => SCHEMAS[name]),
  } as unknown as WorkflowPort;
  const contextConfig: StepContextConfig = {
    aiModelPort: { getModel: jest.fn().mockReturnValue(model) } as never,
    agentPort,
    workflowPort,
    runStore,
    schemaCache: new SchemaCache(),
    logger: jest.fn(),
    stepTimeoutS,
    runControl,
  };

  const run = async (incomingPendingData?: unknown) => {
    const executor = await StepExecutorFactory.create(
      makeStep(stepDefinition, { previousSteps }),
      contextConfig,
      activityLogPort,
      jest.fn(),
      incomingPendingData,
    );

    return executor.execute();
  };

  const row = async () => {
    const executions = await runStore.getStepExecutions(RUN_ID);

    return executions.find(e => e.stepIndex === 3) as StepExecutionData & {
      iterations?: StepIteration[];
    };
  };

  return { run, row, runStore, agentPort, model, runControl, workflowPort };
}

describe('a step running once per record', () => {
  describe('on a Get Data step sourced from a Multiple step', () => {
    it('reads every record in the order the Multiple step loaded them and succeeds', async () => {
      const { run, row, agentPort } = await setup({ stepDefinition: readUbos() });

      const result = await run();

      expect(result.stepOutcome).toStrictEqual({
        type: 'record',
        stepId: 'current-step',
        stepIndex: 3,
        status: 'success',
      });
      expect(agentPort.getRecord.mock.calls.map(([args]) => args.id)).toStrictEqual([
        [1],
        [2],
        [3],
      ]);
      const stored = await row();
      expect(stored).not.toHaveProperty('executionResult');
      expect(stored.iterations).toStrictEqual(
        [1, 2, 3].map(id => ({
          sourceRecordRef: ubo(id),
          selectedRecordRef: ubo(id),
          attempt: 1,
          executionParams: { fields: [{ name: 'pep', displayName: 'PEP' }] },
          executionResult: { fields: [{ name: 'pep', displayName: 'PEP', value: id === 2 }] },
          finishedAt: expect.any(String),
        })),
      );
    });

    it('lists every record when the step starts, before the first one has run', async () => {
      let rowSeenOnFirstRead: StepIteration[] | undefined;
      const agentPort = makeAgentPort();
      const harness = await setup({ stepDefinition: readUbos(), agentPort });
      agentPort.getRecord.mockImplementationOnce(async ({ id }) => {
        rowSeenOnFirstRead = (await harness.row()).iterations;

        return { collectionName: 'ubos', recordId: id, values: { pep: false } };
      });

      await harness.run();

      expect(rowSeenOnFirstRead?.map(iteration => iteration.sourceRecordRef)).toStrictEqual([
        ubo(1),
        ubo(2),
        ubo(3),
      ]);
    });

    it('stops with the empty-source error naming the Multiple step when it loaded nothing', async () => {
      const { run, agentPort } = await setup({
        stepDefinition: readUbos(),
        stored: [
          {
            type: 'load-related-record',
            stepIndex: 1,
            executionResult: { skipped: true },
            selectedRecordRef: COMPANY,
          },
        ],
      });

      const result = await run();

      expect(result.stepOutcome).toMatchObject({
        status: 'error',
        errorKind: 'empty-source',
        errorSourceStepIndex: 1,
      });
      expect(agentPort.getRecord).not.toHaveBeenCalled();
    });

    it("keeps running the records when a record's name cannot be read for the AI", async () => {
      const harness = await setup({ stepDefinition: readUbos() });
      const getCollectionSchema = harness.workflowPort.getCollectionSchema as jest.Mock;
      let failedOnce = false;
      getCollectionSchema.mockImplementation(async (name: string) => {
        if (name === 'ubos' && !failedOnce) {
          failedOnce = true;
          throw new Error('orchestrator unreachable');
        }

        return SCHEMAS[name];
      });

      const result = await harness.run();

      expect(result.stepOutcome.status).toBe('success');
      expect(harness.agentPort.getRecord).toHaveBeenCalledTimes(3);
    });

    it('attempts every record and ends in error when one of them failed', async () => {
      const agentPort = makeAgentPort();
      agentPort.getRecord.mockImplementation(async ({ id }) => {
        if (id[0] === 2) throw new Error('agent unreachable');

        return { collectionName: 'ubos', recordId: id, values: { pep: true } };
      });
      const { run, row } = await setup({ stepDefinition: readUbos(), agentPort });

      const result = await run();

      expect(result.stepOutcome).toMatchObject({
        status: 'error',
        error: '1 of 3 records failed.',
      });
      expect(agentPort.getRecord).toHaveBeenCalledTimes(3);
      const { iterations } = await row();
      expect(
        iterations?.map(iteration => [
          iteration.error !== undefined,
          iteration.finishedAt !== undefined,
        ]),
      ).toStrictEqual([
        [false, true],
        [true, true],
        [false, true],
      ]);
    });
  });

  describe('lock renewal and hand-back', () => {
    it('renews the run lock once before each record it runs', async () => {
      const { run, runControl } = await setup({ stepDefinition: readUbos() });

      await run();

      expect(runControl.beforeRecord).toHaveBeenCalledTimes(3);
    });

    it('stops before the next record, reporting nothing, when the renewal is refused', async () => {
      const { run, row, agentPort } = await setup({
        stepDefinition: readUbos(),
        runControl: makeRunControl('continue', 'stop'),
      });

      const result = await run();

      expect(result.interrupted).toBe('stopped');
      expect(agentPort.getRecord).toHaveBeenCalledTimes(1);
      const { iterations } = await row();
      expect(iterations?.map(iteration => iteration.finishedAt !== undefined)).toStrictEqual([
        true,
        false,
        false,
      ]);
    });

    it('hands the run back before its next record when the runtime is shutting down', async () => {
      const { run, agentPort } = await setup({
        stepDefinition: readUbos(),
        runControl: makeRunControl('continue', 'yield'),
      });

      const result = await run();

      expect(result.interrupted).toBe('yielded');
      expect(agentPort.getRecord).toHaveBeenCalledTimes(1);
    });

    it('resumes at the next record when the step is dispatched again', async () => {
      const harness = await setup({
        stepDefinition: readUbos(),
        runControl: makeRunControl('continue', 'yield'),
      });
      await harness.run();
      harness.agentPort.getRecord.mockClear();

      const result = await harness.run();

      expect(result.stepOutcome.status).toBe('success');
      expect(harness.agentPort.getRecord.mock.calls.map(([args]) => args.id)).toStrictEqual([
        [2],
        [3],
      ]);
    });
  });

  describe('on a step needing confirmation', () => {
    it('pauses on the first record, with every record listed', async () => {
      const { run, row, agentPort } = await setup({
        stepDefinition: updateUbos(StepExecutionMode.AutomatedWithConfirmation),
      });

      const result = await run();

      expect(result.stepOutcome.status).toBe('awaiting-input');
      expect(agentPort.updateRecord).not.toHaveBeenCalled();
      const { iterations } = await row();
      expect(iterations?.map(iteration => iteration.pendingData)).toStrictEqual([
        { name: 'note', displayName: 'Note', value: 'checked' },
        undefined,
        undefined,
      ]);
    });

    it('runs the paused record when the answer names it, then pauses on the next one', async () => {
      const harness = await setup({
        stepDefinition: updateUbos(StepExecutionMode.AutomatedWithConfirmation),
      });
      await harness.run();

      const result = await harness.run({ userConfirmed: true, sourceRecordId: '1' });

      expect(result.stepOutcome.status).toBe('awaiting-input');
      expect(harness.agentPort.updateRecord).toHaveBeenCalledTimes(1);
      expect(harness.agentPort.updateRecord).toHaveBeenCalledWith(
        { collection: 'ubos', id: [1], values: { note: 'checked' } },
        expect.anything(),
      );
      const { iterations } = await harness.row();
      expect(iterations?.[0].executionResult).toStrictEqual({ updatedValues: { note: 'checked' } });
      expect(iterations?.[1].pendingData).toStrictEqual({
        name: 'note',
        displayName: 'Note',
        value: 'checked',
      });
    });

    it('runs an answered record before handing the run back to a runtime shutting down', async () => {
      const runControl = makeRunControl('continue');
      const harness = await setup({
        stepDefinition: updateUbos(StepExecutionMode.AutomatedWithConfirmation),
        runControl,
      });
      await harness.run();
      runControl.beforeRecord.mockResolvedValue('yield');

      const result = await harness.run({ userConfirmed: true, sourceRecordId: '1' });

      expect(result.interrupted).toBe('yielded');
      expect(harness.agentPort.updateRecord).toHaveBeenCalledTimes(1);
      expect(harness.agentPort.updateRecord).toHaveBeenCalledWith(
        { collection: 'ubos', id: [1], values: { note: 'checked' } },
        expect.anything(),
      );
      const { iterations } = await harness.row();
      expect(iterations?.[0].executionResult).toStrictEqual({ updatedValues: { note: 'checked' } });
    });

    it('drops an answer naming another record and stays paused on its record', async () => {
      const harness = await setup({
        stepDefinition: updateUbos(StepExecutionMode.AutomatedWithConfirmation),
      });
      await harness.run();

      const result = await harness.run({ userConfirmed: true, sourceRecordId: '2' });

      expect(result.stepOutcome.status).toBe('awaiting-input');
      expect(harness.agentPort.updateRecord).not.toHaveBeenCalled();
      const { iterations } = await harness.row();
      expect(iterations?.[0]).not.toHaveProperty('userConfirmation');
      expect(iterations?.[1].pendingData).toBeUndefined();
    });

    it('drops an answer naming no record at all', async () => {
      const harness = await setup({
        stepDefinition: updateUbos(StepExecutionMode.AutomatedWithConfirmation),
      });
      await harness.run();

      const result = await harness.run({ userConfirmed: true });

      expect(result.stepOutcome.status).toBe('awaiting-input');
      expect(harness.agentPort.updateRecord).not.toHaveBeenCalled();
    });

    it('skips a record handed over by hand and pauses on the next one', async () => {
      const harness = await setup({
        stepDefinition: updateUbos(StepExecutionMode.AutomatedWithConfirmation),
      });
      await harness.run();

      const result = await harness.run({ userConfirmed: false, sourceRecordId: '1' });

      expect(result.stepOutcome.status).toBe('awaiting-input');
      const { iterations } = await harness.row();
      expect(iterations?.[0].executionResult).toStrictEqual({ skipped: true });
      expect(iterations?.[1].pendingData).toBeDefined();
    });
  });

  describe('retrying and skipping failed records', () => {
    const failedRow = (failedIds: number[]): StepExecutionData =>
      ({
        type: 'read-record',
        stepIndex: 3,
        iterations: [1, 2, 3].map(id =>
          failedIds.includes(id)
            ? { sourceRecordRef: ubo(id), attempt: 1, error: 'boom', finishedAt: 't' }
            : {
                sourceRecordRef: ubo(id),
                selectedRecordRef: ubo(id),
                attempt: 1,
                executionParams: { fields: [{ name: 'pep', displayName: 'PEP' }] },
                executionResult: { fields: [{ name: 'pep', displayName: 'PEP', value: true }] },
                finishedAt: 't',
              },
        ),
      } as unknown as StepExecutionData);

    it('re-runs only the failed records, at their next attempt, when asked to retry them', async () => {
      const { run, row, agentPort } = await setup({
        stepDefinition: readUbos(),
        stored: [loadedUbos(), failedRow([2])],
      });

      const result = await run({ failedRecords: 'retry' });

      expect(result.stepOutcome.status).toBe('success');
      expect(agentPort.getRecord.mock.calls.map(([args]) => args.id)).toStrictEqual([[2]]);
      const { iterations } = await row();
      expect(iterations?.[1]).toMatchObject({ attempt: 2, executionResult: expect.anything() });
      expect(iterations?.[1]).not.toHaveProperty('error');
    });

    it('re-runs only the record it names, leaving the other failed ones as they are', async () => {
      const { run, row, agentPort } = await setup({
        stepDefinition: readUbos(),
        stored: [loadedUbos(), failedRow([2, 3])],
      });

      const result = await run({ failedRecords: 'retry', sourceRecordId: '3' });

      expect(result.stepOutcome).toMatchObject({
        status: 'error',
        error: '1 of 3 records failed.',
      });
      expect(agentPort.getRecord.mock.calls.map(([args]) => args.id)).toStrictEqual([[3]]);
      const { iterations } = await row();
      expect(iterations?.[1]).toMatchObject({ attempt: 1, error: 'boom' });
    });

    it('turns the failed records into skipped ones and completes the step when asked to skip them', async () => {
      const { run, row, agentPort } = await setup({
        stepDefinition: readUbos(),
        stored: [loadedUbos(), failedRow([2])],
      });

      const result = await run({ failedRecords: 'skip' });

      expect(result.stepOutcome.status).toBe('success');
      expect(agentPort.getRecord).not.toHaveBeenCalled();
      const { iterations } = await row();
      expect(iterations?.[1]).toMatchObject({ executionResult: { skipped: true } });
      expect(iterations?.[1]).not.toHaveProperty('error');
    });
  });

  describe('crash recovery and timeouts', () => {
    it('fails a record whose update was interrupted, without running it again, and runs it on retry', async () => {
      const interrupted = {
        type: 'update-record',
        stepIndex: 3,
        iterations: [
          {
            sourceRecordRef: ubo(1),
            selectedRecordRef: ubo(1),
            attempt: 1,
            executionParams: { name: 'note', displayName: 'Note', value: 'checked' },
            executionResult: { updatedValues: { note: 'checked' } },
            idempotencyPhase: 'done',
            finishedAt: 't',
          },
          {
            sourceRecordRef: ubo(2),
            selectedRecordRef: ubo(2),
            attempt: 1,
            idempotencyPhase: 'executing',
          },
          { sourceRecordRef: ubo(3), attempt: 1 },
        ],
      } as unknown as StepExecutionData;
      const harness = await setup({
        stepDefinition: updateUbos(StepExecutionMode.FullyAutomated),
        stored: [loadedUbos(), interrupted],
      });

      const crashed = await harness.run();

      expect(crashed.stepOutcome).toMatchObject({
        status: 'error',
        error: '1 of 3 records failed.',
      });
      expect(harness.agentPort.updateRecord.mock.calls.map(([args]) => args.id)).toStrictEqual([
        [3],
      ]);

      harness.agentPort.updateRecord.mockClear();
      const retried = await harness.run({ failedRecords: 'retry' });

      expect(retried.stepOutcome.status).toBe('success');
      expect(harness.agentPort.updateRecord.mock.calls.map(([args]) => args.id)).toStrictEqual([
        [2],
      ]);
    });

    it('fails a record that runs past the step timeout and never writes its late result', async () => {
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });

      try {
        const agentPort = makeAgentPort();

        let releaseSlowRead: () => void = () => {};

        agentPort.getRecord.mockImplementationOnce(
          ({ id }) =>
            new Promise(resolve => {
              releaseSlowRead = () =>
                resolve({ collectionName: 'ubos', recordId: id, values: { pep: true } });
            }),
        );
        const { run, row } = await setup({
          stepDefinition: readUbos(),
          agentPort,
          stepTimeoutS: 1,
        });

        const pending = run();
        await jest.advanceTimersByTimeAsync(1_000);
        const result = await pending;
        releaseSlowRead();
        await jest.advanceTimersByTimeAsync(10);

        expect(result.stepOutcome).toMatchObject({
          status: 'error',
          error: '1 of 3 records failed.',
        });
        const { iterations } = await row();
        expect(iterations?.[0]).toMatchObject({
          error:
            'The step took too long to complete. Please try again, or contact your administrator if the problem persists.',
        });
        expect(iterations?.[0]).not.toHaveProperty('executionResult');
        expect(iterations?.[2]).toHaveProperty('executionResult');
      } finally {
        jest.useRealTimers();
      }
    });

    it('never runs the update of a record whose step timeout passed before the update started', async () => {
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });

      try {
        let releaseAuditLog: () => void = () => {};

        (activityLogPort.createPending as jest.Mock).mockImplementationOnce(
          () =>
            new Promise(resolve => {
              releaseAuditLog = () => resolve({ id: 'log-late', index: '0' });
            }),
        );
        const { run, agentPort } = await setup({
          stepDefinition: updateUbos(StepExecutionMode.FullyAutomated),
          stepTimeoutS: 1,
        });

        const pending = run();
        await jest.advanceTimersByTimeAsync(1_000);
        await pending;
        releaseAuditLog();
        await jest.advanceTimersByTimeAsync(10);

        expect(agentPort.updateRecord.mock.calls.map(([args]) => args.id)).toStrictEqual([
          [2],
          [3],
        ]);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('chained steps', () => {
    const addressRow: StepExecutionData = {
      type: 'load-related-record',
      stepIndex: 2,
      iterations: [
        {
          sourceRecordRef: ubo(1),
          selectedRecordRef: ubo(1),
          attempt: 1,
          executionParams: { name: 'address', displayName: 'Address' },
          executionResult: {
            relation: { name: 'address', displayName: 'Address' },
            record: address(11),
          },
          finishedAt: 't',
        },
        {
          sourceRecordRef: ubo(2),
          selectedRecordRef: ubo(2),
          attempt: 1,
          executionParams: { name: 'address', displayName: 'Address' },
          executionResult: { skipped: true },
          finishedAt: 't',
        },
        {
          sourceRecordRef: ubo(3),
          selectedRecordRef: ubo(3),
          attempt: 1,
          executionParams: { name: 'address', displayName: 'Address' },
          executionResult: {
            relation: { name: 'address', displayName: 'Address' },
            record: address(13),
          },
          finishedAt: 't',
        },
      ],
    } as unknown as StepExecutionData;

    it('acts on the record each record led to, and skips a record whose related record was not found', async () => {
      const { run, row, agentPort } = await setup({
        stepDefinition: {
          type: StepType.ReadRecord,
          executionType: StepExecutionMode.FullyAutomated,
          preRecordedArgs: { selectedRecordStepId: 'load-address', fieldNames: ['city'] },
        },
        stored: [loadedUbos(), addressRow],
        previousSteps: [LOAD_UBOS, LOAD_ADDRESS],
      });

      const result = await run();

      expect(result.stepOutcome.status).toBe('success');
      expect(
        agentPort.getRecord.mock.calls.map(([args]) => [args.collection, args.id]),
      ).toStrictEqual([
        ['addresses', [11]],
        ['addresses', [13]],
      ]);
      const { iterations } = await row();
      expect(iterations?.[1]).toMatchObject({
        sourceRecordRef: ubo(2),
        executionResult: { skipped: true },
      });
      expect(iterations?.[1]).not.toHaveProperty('selectedRecordRef');
    });

    it("shows each record's AI call only that record's earlier per-record results, and names the record", async () => {
      const readRow = {
        type: 'read-record',
        stepIndex: 2,
        iterations: [1, 2].map(id => ({
          sourceRecordRef: ubo(id),
          selectedRecordRef: ubo(id),
          attempt: 1,
          executionParams: { fields: [{ name: 'note', displayName: 'Note' }] },
          executionResult: {
            fields: [{ name: 'note', displayName: 'Note', value: `secret-${id}` }],
          },
          finishedAt: 't',
        })),
      } as unknown as StepExecutionData;
      const invoke = jest.fn().mockResolvedValue({
        tool_calls: [{ name: 'set-record-field-value', args: { value: 'x', reasoning: 'r' } }],
      });
      const { run } = await setup({
        stepDefinition: {
          type: StepType.UpdateRecord,
          executionType: StepExecutionMode.FullyAutomated,
          preRecordedArgs: { selectedRecordStepId: 'load-ubos', fieldName: 'note' },
        },
        stored: [loadedUbos([ubo(1), ubo(2)]), readRow],
        previousSteps: [
          LOAD_UBOS,
          {
            stepDefinition: readUbos({ fieldNames: ['note'] }),
            stepOutcome: { type: 'record', stepId: 'read-ubos', stepIndex: 2, status: 'success' },
          },
        ],
        model: makeModel(invoke),
      });

      await run();

      const promptOf = (call: number) =>
        (invoke.mock.calls[call][0] as Array<{ content: unknown }>)
          .map(message => String(message.content))
          .join('\n');
      expect(promptOf(1)).toContain('secret-2');
      expect(promptOf(1)).not.toContain('secret-1');
      expect(promptOf(1)).toContain('This step runs once per record. This run is for UBOs #2.');
    });
  });

  describe('steps that run once', () => {
    it('offer every record a Multiple step loaded as a candidate when the AI picks the record', async () => {
      const invoke = jest
        .fn()
        .mockResolvedValueOnce({
          tool_calls: [
            { name: 'select-record', args: { recordIdentifier: 'Step 1 - UBOs #2' }, id: 'c1' },
          ],
        })
        .mockResolvedValueOnce({
          tool_calls: [
            { name: 'read-selected-record-fields', args: { fieldNames: ['PEP'] }, id: 'c2' },
          ],
        });
      const { run, agentPort, runControl } = await setup({
        stepDefinition: {
          type: StepType.ReadRecord,
          executionType: StepExecutionMode.FullyAutomated,
          prompt: 'Read the PEP flag of the second UBO',
        },
        model: makeModel(invoke),
      });

      const result = await run();

      expect(result.stepOutcome.status).toBe('success');
      expect(agentPort.getRecord).toHaveBeenCalledWith(
        { collection: 'ubos', id: [2], fields: ['pep'] },
        expect.anything(),
      );
      expect(runControl.beforeRecord).not.toHaveBeenCalled();
    });
  });

  describe('configuration', () => {
    it('refuses a Multiple step whose source already runs once per record', async () => {
      const { run } = await setup({
        stepDefinition: {
          type: StepType.LoadRelatedRecord,
          executionType: StepExecutionMode.Manual,
          preRecordedArgs: {
            selectedRecordStepId: 'load-ubos',
            relationName: 'documents',
            multiple: true,
          },
        },
      });

      const result = await run();

      expect(result.stepOutcome).toMatchObject({ status: 'error', errorKind: 'configuration' });
    });

    it('keeps a step on a single-record source as it is today, with no lock renewal', async () => {
      const loadOne: Step = {
        stepDefinition: {
          type: StepType.LoadRelatedRecord,
          executionType: StepExecutionMode.Manual,
          preRecordedArgs: { selectedRecordStepId: WORKFLOW_START_STEP_ID, relationName: 'ubos' },
        },
        stepOutcome: { type: 'record', stepId: 'load-ubos', stepIndex: 1, status: 'success' },
      };
      const { run, row, runControl } = await setup({
        stepDefinition: readUbos(),
        previousSteps: [loadOne],
        stored: [
          {
            type: 'load-related-record',
            stepIndex: 1,
            executionParams: { name: 'ubos', displayName: 'UBOs' },
            executionResult: { relation: { name: 'ubos', displayName: 'UBOs' }, record: ubo(1) },
            selectedRecordRef: COMPANY,
          },
        ],
      });

      const result = await run();

      expect(result.stepOutcome.status).toBe('success');
      expect(runControl.beforeRecord).not.toHaveBeenCalled();
      const stored = await row();
      expect(stored).not.toHaveProperty('iterations');
      expect(stored).toMatchObject({
        selectedRecordRef: ubo(1),
        executionResult: expect.anything(),
      });
    });
  });
});
