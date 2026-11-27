import type { StepContextConfig } from '../../src/executors/step-executor-factory';
import type { AvailableStepExecution } from '../../src/types/execution-context';
import type { StepExecutionData } from '../../src/types/step-execution-data';

import { drainActivityLogs } from '@forestadmin/agent-client';

import ReadRecordStepExecutor from '../../src/executors/read-record-step-executor';
import StepExecutorFactory from '../../src/executors/step-executor-factory';
import SchemaCache from '../../src/schema-cache';
import { StepExecutionMode, StepType } from '../../src/types/validated/step-definition';

// PRD-2399: a step whose load came back empty is skipped when that load is set to Skip.

const customer = { collectionName: 'customers', recordId: [1], stepIndex: 0 };
const EMPTY_LOAD_ERROR = '"Load UBOs" loaded no UBOs, so this step has none to run for.';
const EMPTY_SINGLE_ERROR =
  'This step uses "Load UBO" as its source, but that step didn\'t load any record.';

function loadStep(stepId: string, stepIndex: number, args: Record<string, unknown>, title: string) {
  return {
    stepDefinition: {
      type: StepType.LoadRelatedRecord,
      executionType: StepExecutionMode.FullyAutomated,
      title,
      preRecordedArgs: { relationName: 'ubos', ...args },
    },
    stepOutcome: { type: 'record', stepId, stepIndex, status: 'success' },
  };
}

// What a load that found nothing leaves in the run store.
function emptyLoad(stepIndex: number, extra: Record<string, unknown> = {}): StepExecutionData {
  return {
    type: 'load-related-record',
    stepIndex,
    executionParams: { name: 'ubos', displayName: 'UBOs' },
    executionResult: { skipped: true },
    selectedRecordRef: customer,
    ...extra,
  } as StepExecutionData;
}

function makeStep(
  stepDefinition: Record<string, unknown>,
  previousSteps: unknown[],
  stepIndex = 5,
): AvailableStepExecution {
  return {
    runId: 'run-1',
    stepId: 'step-under-test',
    stepIndex,
    collectionId: 'col-1',
    baseRecordRef: customer,
    stepDefinition: { executionType: StepExecutionMode.FullyAutomated, ...stepDefinition },
    previousSteps,
    user: {
      id: 7,
      email: 'a@b.com',
      firstName: 'A',
      lastName: 'B',
      team: 't',
      renderingId: 1,
      role: 'admin',
      permissionLevel: 'admin',
      tags: {},
    },
    timezone: 'UTC',
  } as unknown as AvailableStepExecution;
}

function makeConfig(executions: StepExecutionData[]) {
  const saveStepExecution = jest.fn().mockResolvedValue(undefined);
  const config = {
    aiModelPort: { getModel: jest.fn().mockReturnValue({}) },
    agentPort: {},
    workflowPort: {},
    runStore: {
      getStepExecutions: jest.fn().mockResolvedValue(executions),
      saveStepExecution,
    },
    schemaCache: new SchemaCache(),
    logger: jest.fn(),
    forestServerUrl: 'https://api.forestadmin.com',
  } as unknown as StepContextConfig;

  return { config, saveStepExecution };
}

async function run(step: AvailableStepExecution, executions: StepExecutionData[]) {
  const { config, saveStepExecution } = makeConfig(executions);
  const executor = await StepExecutorFactory.create(step, config, jest.fn());
  const { stepOutcome } = await executor.execute();

  return { stepOutcome, saveStepExecution };
}

const getData = (selectedRecordStepId: string) => ({
  type: StepType.ReadRecord,
  preRecordedArgs: { selectedRecordStepId, fieldNames: ['share'] },
});

describe('a step using a load that loaded no record', () => {
  afterEach(async () => {
    await drainActivityLogs();
  });

  describe('on a Single load', () => {
    it('is skipped, and the run carries on, when the load is set to Skip', async () => {
      const previous = [loadStep('load-ubo', 1, { ifNoRecords: 'skip' }, 'Load UBO')];

      const { stepOutcome, saveStepExecution } = await run(
        makeStep(getData('load-ubo'), previous),
        [emptyLoad(1)],
      );

      expect(stepOutcome).toEqual({
        type: 'record',
        stepId: 'step-under-test',
        stepIndex: 5,
        status: 'success',
      });
      expect(saveStepExecution).toHaveBeenCalledWith('run-1', {
        type: 'read-record',
        stepIndex: 5,
        executionResult: { skipped: true, emptySourceStepIndex: 1 },
      });
    });

    // The orchestrator reads a load completed by hand as empty, so both sides skip together.
    it('is skipped when a person completed the Skip load by hand, which saved nothing', async () => {
      const previous = [loadStep('load-ubo', 1, { ifNoRecords: 'skip' }, 'Load UBO')];

      const { saveStepExecution } = await run(makeStep(getData('load-ubo'), previous), []);

      expect(saveStepExecution).toHaveBeenCalledWith('run-1', {
        type: 'read-record',
        stepIndex: 5,
        executionResult: { skipped: true, emptySourceStepIndex: 1 },
      });
    });

    it('is skipped when the operator declined every record the Skip load offered', async () => {
      const previous = [loadStep('load-ubo', 1, { ifNoRecords: 'skip' }, 'Load UBO')];
      const declined = emptyLoad(1, {
        pendingData: {
          availableFields: [{ name: 'ubos', displayName: 'UBOs' }],
          suggestedField: { name: 'ubos', displayName: 'UBOs' },
          availableRecordIds: [{ recordId: [9], referenceFieldValue: null }],
        },
        userConfirmation: { userConfirmed: false },
      });

      const { stepOutcome } = await run(makeStep(getData('load-ubo'), previous), [declined]);

      expect(stepOutcome.status).toBe('success');
    });

    it.each([
      ['set to Stop', { ifNoRecords: 'stop' }],
      ['saved before the setting existed', {}],
      ['new and not set yet', { ifNoRecords: null }],
    ])('stops the run with the empty-load error when the load is %s', async (_, args) => {
      const previous = [loadStep('load-ubo', 1, args, 'Load UBO')];

      const { stepOutcome, saveStepExecution } = await run(
        makeStep(getData('load-ubo'), previous),
        [emptyLoad(1)],
      );

      expect(stepOutcome).toEqual(
        expect.objectContaining({
          status: 'error',
          error: EMPTY_SINGLE_ERROR,
          errorKind: 'empty-source',
          errorSourceStepIndex: 1,
        }),
      );
      expect(saveStepExecution).not.toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({ stepIndex: 5 }),
      );
    });

    it('stops a Trigger Action with Approved and Rejected branches, so the operator picks one', async () => {
      const previous = [loadStep('load-ubo', 1, { ifNoRecords: 'skip' }, 'Load UBO')];
      const step = makeStep(
        {
          type: StepType.TriggerAction,
          approvalOutcomes: true,
          preRecordedArgs: { selectedRecordStepId: 'load-ubo', actionName: 'check' },
        },
        previous,
      );

      const { stepOutcome } = await run(step, [emptyLoad(1)]);

      expect(stepOutcome).toEqual(
        expect.objectContaining({ status: 'error', error: EMPTY_SINGLE_ERROR }),
      );
    });

    it('tells the orchestrator a skipped load loaded no record', async () => {
      const previous = [loadStep('load-ubo', 1, { ifNoRecords: 'skip' }, 'Load UBO')];
      const step = makeStep(
        {
          type: StepType.LoadRelatedRecord,
          preRecordedArgs: { selectedRecordStepId: 'load-ubo', relationName: 'address' },
        },
        previous,
      );

      const { stepOutcome, saveStepExecution } = await run(step, [emptyLoad(1)]);

      expect(stepOutcome).toEqual({
        type: 'record',
        stepId: 'step-under-test',
        stepIndex: 5,
        status: 'success',
        loadedRecordCount: 0,
      });
      expect(saveStepExecution).toHaveBeenCalledWith('run-1', {
        type: 'load-related-record',
        stepIndex: 5,
        executionResult: { skipped: true, emptySourceStepIndex: 1 },
      });
    });

    it('runs the step as usual when the Skip load did load a record', async () => {
      const previous = [loadStep('load-ubo', 1, { ifNoRecords: 'skip' }, 'Load UBO')];
      const loaded = {
        type: 'load-related-record',
        stepIndex: 1,
        executionParams: { name: 'ubos', displayName: 'UBOs' },
        executionResult: {
          relation: { name: 'ubos', displayName: 'UBOs' },
          record: { collectionName: 'ubos', recordId: [9], stepIndex: 1 },
        },
        selectedRecordRef: customer,
      } as StepExecutionData;
      const { config, saveStepExecution } = makeConfig([loaded]);

      const executor = await StepExecutorFactory.create(
        makeStep(getData('load-ubo'), previous),
        config,
        jest.fn(),
      );

      expect(executor).toBeInstanceOf(ReadRecordStepExecutor);
      expect(saveStepExecution).not.toHaveBeenCalled();
    });

    it('fails the step, rather than the run, when saving the skip fails', async () => {
      const previous = [loadStep('load-ubo', 1, { ifNoRecords: 'skip' }, 'Load UBO')];
      const { config, saveStepExecution } = makeConfig([emptyLoad(1)]);
      saveStepExecution.mockRejectedValueOnce(new Error('store unavailable'));

      const executor = await StepExecutorFactory.create(
        makeStep(getData('load-ubo'), previous),
        config,
        jest.fn(),
      );
      const { stepOutcome } = await executor.execute();

      expect(stepOutcome).toEqual({
        type: 'record',
        stepId: 'step-under-test',
        stepIndex: 5,
        status: 'error',
        error: 'Unexpected error during step execution',
      });
    });
  });

  describe('downstream of a load skipped for an earlier empty Skip load', () => {
    it('is skipped too, even when the load in between is set to Stop', async () => {
      const previous = [
        loadStep('load-ubo', 1, { ifNoRecords: 'skip' }, 'Load UBO'),
        loadStep(
          'load-address',
          2,
          { selectedRecordStepId: 'load-ubo', ifNoRecords: 'stop' },
          'Load address',
        ),
      ];
      const skippedLoad = {
        type: 'load-related-record',
        stepIndex: 2,
        executionResult: { skipped: true, emptySourceStepIndex: 1 },
      } as StepExecutionData;

      const { stepOutcome, saveStepExecution } = await run(
        makeStep(getData('load-address'), previous),
        [emptyLoad(1), skippedLoad],
      );

      expect(stepOutcome.status).toBe('success');
      expect(saveStepExecution).toHaveBeenCalledWith('run-1', {
        type: 'read-record',
        stepIndex: 5,
        executionResult: { skipped: true, emptySourceStepIndex: 1 },
      });
    });
  });

  describe('on a Multiple load', () => {
    const multiple = (args: Record<string, unknown>) => [
      loadStep('load-ubos', 1, { multiple: true, ...args }, 'Load UBOs'),
    ];

    it('is skipped as a whole, with no record to run for, when the load is set to Skip', async () => {
      const { stepOutcome, saveStepExecution } = await run(
        makeStep(getData('load-ubos'), multiple({ ifNoRecords: 'skip' })),
        [emptyLoad(1)],
      );

      expect(stepOutcome).toEqual({
        type: 'record',
        stepId: 'step-under-test',
        stepIndex: 5,
        status: 'success',
      });
      expect(saveStepExecution).toHaveBeenCalledWith('run-1', {
        type: 'read-record',
        stepIndex: 5,
        executionResult: { skipped: true, emptySourceStepIndex: 1 },
      });
    });

    it('stops the run with the empty-list error when the load is set to Stop', async () => {
      const { stepOutcome } = await run(
        makeStep(getData('load-ubos'), multiple({ ifNoRecords: 'stop' })),
        [emptyLoad(1)],
      );

      expect(stepOutcome).toEqual(
        expect.objectContaining({ status: 'error', error: EMPTY_LOAD_ERROR }),
      );
    });

    it('skips a step two loads down the chain, through a per-record load', async () => {
      const previous = [
        ...multiple({ ifNoRecords: 'skip' }),
        loadStep('load-address', 2, { selectedRecordStepId: 'load-ubos' }, 'Load address'),
      ];

      const { stepOutcome, saveStepExecution } = await run(
        makeStep(getData('load-address'), previous),
        [emptyLoad(1)],
      );

      expect(stepOutcome.status).toBe('success');
      expect(saveStepExecution).toHaveBeenCalledWith('run-1', {
        type: 'read-record',
        stepIndex: 5,
        executionResult: { skipped: true, emptySourceStepIndex: 1 },
      });
    });
  });
});
