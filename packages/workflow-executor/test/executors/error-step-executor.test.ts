import type { Logger } from '../../src/ports/logger-port';
import type { PendingStepExecution } from '../../src/types/execution';

import ErrorStepExecutor from '../../src/executors/error-step-executor';
import { StepType } from '../../src/types/step-definition';
import { stepTypeToOutcomeType } from '../../src/types/step-outcome';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStep(
  overrides: Partial<PendingStepExecution> & { stepType?: StepType } = {},
): PendingStepExecution {
  const { stepType = StepType.ReadRecord, ...rest } = overrides;

  let stepDefinition: PendingStepExecution['stepDefinition'];

  if (stepType === StepType.Condition) {
    stepDefinition = { type: StepType.Condition, options: ['opt1', 'opt2'] };
  } else if (stepType === StepType.McpTask) {
    stepDefinition = { type: StepType.McpTask };
  } else {
    stepDefinition = { type: stepType as Exclude<StepType, StepType.Condition | StepType.McpTask> };
  }

  return {
    runId: 'run-1',
    stepId: 'step-1',
    stepIndex: 0,
    baseRecordRef: { collectionName: 'customers', recordId: ['1'], stepIndex: 0 },
    stepDefinition,
    previousSteps: [],
    ...rest,
  };
}

function makeLogger(): jest.Mocked<Logger> {
  return { error: jest.fn() };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('stepTypeToOutcomeType', () => {
  it('maps Condition to condition', () => {
    expect(stepTypeToOutcomeType(StepType.Condition)).toBe('condition');
  });

  it('maps McpTask to mcp-task', () => {
    expect(stepTypeToOutcomeType(StepType.McpTask)).toBe('mcp-task');
  });

  it('maps ReadRecord to record-task', () => {
    expect(stepTypeToOutcomeType(StepType.ReadRecord)).toBe('record-task');
  });

  it('maps UpdateRecord to record-task', () => {
    expect(stepTypeToOutcomeType(StepType.UpdateRecord)).toBe('record-task');
  });

  it('maps TriggerAction to record-task', () => {
    expect(stepTypeToOutcomeType(StepType.TriggerAction)).toBe('record-task');
  });

  it('maps LoadRelatedRecord to record-task', () => {
    expect(stepTypeToOutcomeType(StepType.LoadRelatedRecord)).toBe('record-task');
  });

  it('falls through to record-task for an unknown future step type', () => {
    expect(stepTypeToOutcomeType('future-step-type' as StepType)).toBe('record-task');
  });
});

describe('ErrorStepExecutor', () => {
  describe('contract', () => {
    it('execute() always resolves and never rejects', async () => {
      const executor = new ErrorStepExecutor(makeStep(), new Error('boom'), makeLogger());

      await expect(executor.execute()).resolves.toBeDefined();
    });
  });

  describe('logging', () => {
    it('logs with runId, stepId, stepIndex, error message and stack', async () => {
      const error = new Error('something went wrong');
      const step = makeStep({ runId: 'run-42', stepId: 'step-99', stepIndex: 3 });
      const logger = makeLogger();
      const executor = new ErrorStepExecutor(step, error, logger);

      await executor.execute();

      expect(logger.error).toHaveBeenCalledWith(
        'Step execution failed unexpectedly',
        expect.objectContaining({
          runId: 'run-42',
          stepId: 'step-99',
          stepIndex: 3,
          error: 'something went wrong',
          stack: expect.any(String),
        }),
      );
    });

    it('handles a non-Error throwable (string)', async () => {
      const step = makeStep();
      const logger = makeLogger();
      const executor = new ErrorStepExecutor(step, 'string error', logger);

      await executor.execute();

      expect(logger.error).toHaveBeenCalledWith(
        'Step execution failed unexpectedly',
        expect.objectContaining({
          error: 'string error',
          stack: undefined,
        }),
      );
    });

    it('logs cause message when error has an Error cause', async () => {
      const rootCause = new Error('root cause message');
      const error = new Error('wrapper');
      (error as Error & { cause: Error }).cause = rootCause;
      const logger = makeLogger();
      const executor = new ErrorStepExecutor(makeStep(), error, logger);

      await executor.execute();

      expect(logger.error).toHaveBeenCalledWith(
        'Step execution failed unexpectedly',
        expect.objectContaining({ cause: 'root cause message' }),
      );
    });

    it('logs cause as undefined when error cause is not an Error instance', async () => {
      const error = new Error('wrapper');
      (error as Error & { cause: string }).cause = 'plain string cause';
      const logger = makeLogger();
      const executor = new ErrorStepExecutor(makeStep(), error, logger);

      await executor.execute();

      expect(logger.error).toHaveBeenCalledWith(
        'Step execution failed unexpectedly',
        expect.objectContaining({ cause: undefined }),
      );
    });
  });

  describe('outcome type mapping', () => {
    it('returns type condition for Condition steps', async () => {
      const executor = new ErrorStepExecutor(
        makeStep({ stepType: StepType.Condition }),
        new Error(),
        makeLogger(),
      );
      const { stepOutcome } = await executor.execute();

      expect(stepOutcome.type).toBe('condition');
    });

    it('returns type mcp-task for McpTask steps', async () => {
      const executor = new ErrorStepExecutor(
        makeStep({ stepType: StepType.McpTask }),
        new Error(),
        makeLogger(),
      );
      const { stepOutcome } = await executor.execute();

      expect(stepOutcome.type).toBe('mcp-task');
    });

    it('returns type record-task for ReadRecord steps', async () => {
      const executor = new ErrorStepExecutor(
        makeStep({ stepType: StepType.ReadRecord }),
        new Error(),
        makeLogger(),
      );
      const { stepOutcome } = await executor.execute();

      expect(stepOutcome.type).toBe('record-task');
    });

    it('returns type record-task for UpdateRecord steps', async () => {
      const executor = new ErrorStepExecutor(
        makeStep({ stepType: StepType.UpdateRecord }),
        new Error(),
        makeLogger(),
      );
      const { stepOutcome } = await executor.execute();

      expect(stepOutcome.type).toBe('record-task');
    });

    it('returns type record-task for TriggerAction steps', async () => {
      const executor = new ErrorStepExecutor(
        makeStep({ stepType: StepType.TriggerAction }),
        new Error(),
        makeLogger(),
      );
      const { stepOutcome } = await executor.execute();

      expect(stepOutcome.type).toBe('record-task');
    });

    it('returns type record-task for LoadRelatedRecord steps', async () => {
      const executor = new ErrorStepExecutor(
        makeStep({ stepType: StepType.LoadRelatedRecord }),
        new Error(),
        makeLogger(),
      );
      const { stepOutcome } = await executor.execute();

      expect(stepOutcome.type).toBe('record-task');
    });
  });

  describe('outcome content', () => {
    it('returns status error with generic user-facing message', async () => {
      const executor = new ErrorStepExecutor(
        makeStep(),
        new Error('internal detail'),
        makeLogger(),
      );
      const { stepOutcome } = await executor.execute();

      expect(stepOutcome.status).toBe('error');
      expect(stepOutcome.error).toBe('An unexpected error occurred.');
    });

    it('returns correct stepId and stepIndex', async () => {
      const executor = new ErrorStepExecutor(
        makeStep({ stepId: 'my-step', stepIndex: 5 }),
        new Error(),
        makeLogger(),
      );
      const { stepOutcome } = await executor.execute();

      expect(stepOutcome.stepId).toBe('my-step');
      expect(stepOutcome.stepIndex).toBe(5);
    });
  });
});
