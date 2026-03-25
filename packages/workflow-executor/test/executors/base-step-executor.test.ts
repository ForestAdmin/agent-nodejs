/* eslint-disable max-classes-per-file */
import type { Logger } from '../../src/ports/logger-port';
import type { RunStore } from '../../src/ports/run-store';
import type { ExecutionContext, StepExecutionResult } from '../../src/types/execution';
import type { RecordRef } from '../../src/types/record';
import type { StepDefinition } from '../../src/types/step-definition';
import type { StepExecutionData } from '../../src/types/step-execution-data';
import type { BaseStepStatus, StepOutcome } from '../../src/types/step-outcome';
import type { BaseMessage, DynamicStructuredTool } from '@forestadmin/ai-proxy';

import { SystemMessage } from '@forestadmin/ai-proxy';

import {
  MalformedToolCallError,
  MissingToolCallError,
  NoRecordsError,
  StepPersistenceError,
} from '../../src/errors';
import BaseStepExecutor from '../../src/executors/base-step-executor';
import { StepType } from '../../src/types/step-definition';

/** Concrete subclass that exposes protected methods for testing. */
class TestableExecutor extends BaseStepExecutor {
  constructor(context: ExecutionContext, private readonly errorToThrow?: unknown) {
    super(context);
  }

  protected async doExecute(): Promise<StepExecutionResult> {
    if (this.errorToThrow !== undefined) throw this.errorToThrow;

    return this.buildOutcomeResult({ status: 'success' });
  }

  protected buildOutcomeResult(outcome: {
    status: BaseStepStatus;
    error?: string;
  }): StepExecutionResult {
    return {
      stepOutcome: {
        type: 'record-task',
        stepId: this.context.stepId,
        stepIndex: this.context.stepIndex,
        status: outcome.status,
        ...(outcome.error !== undefined && { error: outcome.error }),
      },
    };
  }

  override buildPreviousStepsMessages(): Promise<SystemMessage[]> {
    return super.buildPreviousStepsMessages();
  }

  override invokeWithTool<T = Record<string, unknown>>(
    messages: BaseMessage[],
    tool: DynamicStructuredTool,
  ): Promise<T> {
    return super.invokeWithTool<T>(messages, tool);
  }
}

function makeHistoryEntry(
  overrides: { stepId?: string; stepIndex?: number; prompt?: string } = {},
): { stepDefinition: StepDefinition; stepOutcome: StepOutcome } {
  return {
    stepDefinition: {
      type: StepType.Condition,
      options: ['A', 'B'],
      prompt: overrides.prompt ?? 'Pick one',
    },
    stepOutcome: {
      type: 'condition',
      stepId: overrides.stepId ?? 'step-1',
      stepIndex: overrides.stepIndex ?? 0,
      status: 'success',
    },
  };
}

function makeMockRunStore(stepExecutions: StepExecutionData[] = []): RunStore {
  return {
    init: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    getStepExecutions: jest.fn().mockResolvedValue(stepExecutions),
    saveStepExecution: jest.fn().mockResolvedValue(undefined),
  };
}

function makeMockLogger(): Logger {
  return { error: jest.fn() };
}

function makeContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    runId: 'run-1',
    stepId: 'step-0',
    stepIndex: 0,
    baseRecordRef: {
      collectionName: 'customers',
      recordId: [1],
      stepIndex: 0,
    } as RecordRef,
    stepDefinition: {
      type: StepType.Condition,
      options: ['A', 'B'],
      prompt: 'Pick one',
    },
    model: {} as ExecutionContext['model'],
    agentPort: {} as ExecutionContext['agentPort'],
    workflowPort: {} as ExecutionContext['workflowPort'],
    runStore: makeMockRunStore(),
    previousSteps: [],
    logger: makeMockLogger(),
    ...overrides,
  };
}

describe('BaseStepExecutor', () => {
  describe('buildPreviousStepsMessages', () => {
    it('returns empty array for empty history', async () => {
      const executor = new TestableExecutor(makeContext());

      expect(await executor.buildPreviousStepsMessages()).toEqual([]);
    });

    it('calls getStepExecutions with runId and returns a SystemMessage with step content', async () => {
      const runStore = makeMockRunStore([
        {
          type: 'condition',
          stepIndex: 0,
          executionParams: { answer: 'Yes', reasoning: 'Order is valid' },
          executionResult: { answer: 'Yes' },
        },
      ]);
      const executor = new TestableExecutor(
        makeContext({
          previousSteps: [makeHistoryEntry({ stepId: 'cond-1', stepIndex: 0, prompt: 'Approve?' })],
          runStore,
        }),
      );

      const messages = await executor.buildPreviousStepsMessages();

      expect(runStore.getStepExecutions).toHaveBeenCalledWith('run-1');
      expect(messages).toHaveLength(1);
      expect(messages[0]).toBeInstanceOf(SystemMessage);
      expect(messages[0].content).toContain('Step "cond-1"');
      expect(messages[0].content).toContain('Prompt: Approve?');
    });

    it('separates multiple previous steps with a blank line', async () => {
      const runStore = makeMockRunStore([
        {
          type: 'condition',
          stepIndex: 0,
          executionParams: { answer: 'Yes', reasoning: 'Valid' },
          executionResult: { answer: 'Yes' },
        },
        {
          type: 'condition',
          stepIndex: 1,
          executionParams: { answer: 'No', reasoning: 'Wrong' },
          executionResult: { answer: 'No' },
        },
      ]);
      const executor = new TestableExecutor(
        makeContext({
          previousSteps: [
            makeHistoryEntry({ stepId: 'cond-1', stepIndex: 0, prompt: 'First?' }),
            makeHistoryEntry({ stepId: 'cond-2', stepIndex: 1, prompt: 'Second?' }),
          ],
          runStore,
        }),
      );

      const messages = await executor.buildPreviousStepsMessages();
      const content = messages[0].content as string;

      expect(content).toContain('Step "cond-1"');
      expect(content).toContain('Step "cond-2"');
      expect(content).toContain('\n\nStep "cond-2"');
    });
  });

  describe('execute error handling', () => {
    it('converts NoRecordsError to error outcome', async () => {
      const executor = new TestableExecutor(makeContext(), new NoRecordsError());

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe('No records available');
    });

    describe('unexpected error handling', () => {
      it('returns error outcome instead of rethrowing', async () => {
        const executor = new TestableExecutor(makeContext(), new Error('db connection refused'));
        const result = await executor.execute();
        expect(result.stepOutcome.status).toBe('error');
        expect(result.stepOutcome.error).toBe('Unexpected error during step execution');
      });

      it('logs the full error context when logger is provided', async () => {
        const logger = makeMockLogger();
        const executor = new TestableExecutor(
          makeContext({ logger }),
          new Error('db connection refused'),
        );
        await executor.execute();
        expect(logger.error).toHaveBeenCalledWith(
          'Unexpected error during step execution',
          expect.objectContaining({
            runId: 'run-1',
            stepId: 'step-0',
            stepIndex: 0,
            error: 'db connection refused',
          }),
        );
      });

      it('includes stack trace in log context', async () => {
        const logger = makeMockLogger();
        const err = new Error('db connection refused');
        const executor = new TestableExecutor(makeContext({ logger }), err);
        await executor.execute();
        expect(logger.error).toHaveBeenCalledWith(
          'Unexpected error during step execution',
          expect.objectContaining({ stack: err.stack }),
        );
      });

      it('handles non-Error throwables without crashing', async () => {
        const executor = new TestableExecutor(makeContext(), 'a raw string thrown');
        const result = await executor.execute();
        expect(result.stepOutcome.status).toBe('error');
      });

      it('includes cause in log when non-WorkflowExecutorError has a cause', async () => {
        const logger = makeMockLogger();
        const cause = new Error('root cause');
        const error = Object.assign(new Error('wrapper error'), { cause });
        const executor = new TestableExecutor(makeContext({ logger }), error);
        await executor.execute();
        expect(logger.error).toHaveBeenCalledWith(
          'Unexpected error during step execution',
          expect.objectContaining({ cause: 'root cause' }),
        );
      });
    });

    it('logs cause when WorkflowExecutorError has a cause', async () => {
      const logger = makeMockLogger();
      const cause = new Error('db timeout');
      const error = new StepPersistenceError('write failed', cause);
      const executor = new TestableExecutor(makeContext({ logger }), error);
      await executor.execute();
      expect(logger.error).toHaveBeenCalledWith(
        'write failed',
        expect.objectContaining({
          cause: 'db timeout',
          stack: cause.stack,
        }),
      );
    });

    it('does not log when WorkflowExecutorError has no cause', async () => {
      const logger = makeMockLogger();
      const executor = new TestableExecutor(makeContext({ logger }), new MissingToolCallError());
      await executor.execute();
      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  describe('invokeWithTool', () => {
    function makeMockModel(response: unknown) {
      const invoke = jest.fn().mockResolvedValue(response);

      return {
        model: {
          bindTools: jest.fn().mockReturnValue({ invoke }),
        } as unknown as ExecutionContext['model'],
        invoke,
      };
    }

    const dummyTool = {} as DynamicStructuredTool;
    const dummyMessages = [] as BaseMessage[];

    it('returns args from the first tool call', async () => {
      const { model } = makeMockModel({
        tool_calls: [{ name: 'tool', args: { key: 'value' }, id: 'c1' }],
      });
      const executor = new TestableExecutor(makeContext({ model }));

      const result = await executor.invokeWithTool(dummyMessages, dummyTool);

      expect(result).toEqual({ key: 'value' });
    });

    it('binds tool with tool_choice "any"', async () => {
      const { model } = makeMockModel({
        tool_calls: [{ name: 'tool', args: {}, id: 'c1' }],
      });
      const executor = new TestableExecutor(makeContext({ model }));

      await executor.invokeWithTool(dummyMessages, dummyTool);

      expect(model.bindTools).toHaveBeenCalledWith([dummyTool], { tool_choice: 'any' });
    });

    it('throws MissingToolCallError when tool_calls is undefined', async () => {
      const { model } = makeMockModel({});
      const executor = new TestableExecutor(makeContext({ model }));

      await expect(executor.invokeWithTool(dummyMessages, dummyTool)).rejects.toThrow(
        MissingToolCallError,
      );
    });

    it('throws MissingToolCallError when tool_calls is empty', async () => {
      const { model } = makeMockModel({ tool_calls: [] });
      const executor = new TestableExecutor(makeContext({ model }));

      await expect(executor.invokeWithTool(dummyMessages, dummyTool)).rejects.toThrow(
        MissingToolCallError,
      );
    });

    it('throws MalformedToolCallError when invalid_tool_calls is present', async () => {
      const { model } = makeMockModel({
        tool_calls: [],
        invalid_tool_calls: [{ name: 'my-tool', args: '{bad', error: 'Parse error' }],
      });
      const executor = new TestableExecutor(makeContext({ model }));

      await expect(executor.invokeWithTool(dummyMessages, dummyTool)).rejects.toThrow(
        MalformedToolCallError,
      );
      await expect(executor.invokeWithTool(dummyMessages, dummyTool)).rejects.toThrow(
        'AI returned a malformed tool call for "my-tool": Parse error',
      );
    });

    it('throws MalformedToolCallError with "unknown" when invalid_tool_call has no name', async () => {
      const { model } = makeMockModel({
        tool_calls: [],
        invalid_tool_calls: [{ error: 'Something broke' }],
      });
      const executor = new TestableExecutor(makeContext({ model }));

      await expect(executor.invokeWithTool(dummyMessages, dummyTool)).rejects.toThrow(
        MalformedToolCallError,
      );
      await expect(executor.invokeWithTool(dummyMessages, dummyTool)).rejects.toThrow(
        'AI returned a malformed tool call for "unknown": Something broke',
      );
    });
  });
});
