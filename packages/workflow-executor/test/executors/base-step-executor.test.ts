/* eslint-disable max-classes-per-file */
import type { Logger } from '../../src/ports/logger-port';
import type { RunStore } from '../../src/ports/run-store';
import type { ExecutionContext, StepExecutionResult } from '../../src/types/execution-context';
import type { StepExecutionData } from '../../src/types/step-execution-data';
import type { RecordRef } from '../../src/types/validated/collection';
import type { StepDefinition } from '../../src/types/validated/step-definition';
import type { BaseStepStatus, StepOutcome } from '../../src/types/validated/step-outcome';
import type { BaseMessage, DynamicStructuredTool } from '@forestadmin/ai-proxy';

import { HumanMessage, SystemMessage } from '@forestadmin/ai-proxy';

import {
  AiInvokeTimeoutError,
  InvalidAiRequestError,
  MalformedToolCallError,
  MissingToolCallError,
  NoRecordsError,
  RunStorePortError,
  StepStateError,
  WorkflowExecutorError,
} from '../../src/errors';
import BaseStepExecutor from '../../src/executors/base-step-executor';
import SchemaCache from '../../src/schema-cache';
import { StepExecutionMode, StepType } from '../../src/types/validated/step-definition';

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
        type: 'record',
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
      executionType: StepExecutionMode.Manual,
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
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

function makeMockActivityLogPort(): ExecutionContext['activityLogPort'] {
  return {
    createPending: jest.fn().mockResolvedValue({ id: 'log-1', index: '0' }),
    markSucceeded: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
  };
}

function makeContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    runId: 'run-1',
    stepId: 'step-0',
    stepIndex: 0,
    collectionId: 'col-1',
    baseRecordRef: {
      collectionName: 'customers',
      recordId: [1],
      stepIndex: 0,
    } as RecordRef,
    stepDefinition: {
      type: StepType.Condition,
      executionType: StepExecutionMode.Manual,
      options: ['A', 'B'],
      prompt: 'Pick one',
    },
    model: {} as ExecutionContext['model'],
    agentPort: {} as ExecutionContext['agentPort'],
    workflowPort: {} as ExecutionContext['workflowPort'],
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
    logger: makeMockLogger(),

    activityLogPort: makeMockActivityLogPort(),
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

      it('includes stepType in info logs for started and completed steps', async () => {
        const logger = makeMockLogger();
        const executor = new TestableExecutor(makeContext({ logger }));
        await executor.execute();
        expect(logger.info).toHaveBeenCalledWith(
          'Step execution started',
          expect.objectContaining({ stepType: StepType.Condition }),
        );
        expect(logger.info).toHaveBeenCalledWith(
          'Step execution completed',
          expect.objectContaining({ stepType: StepType.Condition }),
        );
      });

      it('includes stepType in cache-replay log', async () => {
        class CachedExecutor extends TestableExecutor {
          override checkIdempotency() {
            return Promise.resolve(this.buildOutcomeResult({ status: 'success' }));
          }
        }
        const logger = makeMockLogger();
        const executor = new CachedExecutor(makeContext({ logger }));
        await executor.execute();
        expect(logger.info).toHaveBeenCalledWith(
          'Step execution completed (replayed from cache)',
          expect.objectContaining({ stepType: StepType.Condition }),
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

      it('sets cause to undefined in log when error has no cause', async () => {
        const logger = makeMockLogger();
        const executor = new TestableExecutor(makeContext({ logger }), new Error('no cause'));
        await executor.execute();
        expect(logger.error).toHaveBeenCalledWith(
          'Unexpected error during step execution',
          expect.objectContaining({ cause: undefined }),
        );
      });

      it('includes stepType in log context', async () => {
        const logger = makeMockLogger();
        const executor = new TestableExecutor(makeContext({ logger }), new Error('boom'));
        await executor.execute();
        expect(logger.error).toHaveBeenCalledWith(
          'Unexpected error during step execution',
          expect.objectContaining({ stepType: StepType.Condition }),
        );
      });
    });

    it('logs cause when WorkflowExecutorError has a cause', async () => {
      const logger = makeMockLogger();
      const cause = new Error('db timeout');
      const error = new RunStorePortError('saveStepExecution', cause);
      const executor = new TestableExecutor(makeContext({ logger }), error);
      await executor.execute();
      expect(logger.error).toHaveBeenCalledWith(
        'Run store "saveStepExecution" failed: db timeout',
        expect.objectContaining({
          cause: 'db timeout',
          stack: cause.stack,
          stepType: StepType.Condition,
        }),
      );
    });

    it('logs error.message even when WorkflowExecutorError has no cause', async () => {
      const logger = makeMockLogger();
      const err = new MissingToolCallError();
      const executor = new TestableExecutor(makeContext({ logger }), err);
      await executor.execute();
      expect(logger.error).toHaveBeenCalledWith(
        err.message,
        expect.not.objectContaining({ cause: expect.anything() }),
      );
    });
  });

  describe('step execution timeout', () => {
    class SlowExecutor extends BaseStepExecutor {
      constructor(context: ExecutionContext, private readonly delayMs: number) {
        super(context);
      }

      protected async doExecute(): Promise<StepExecutionResult> {
        await new Promise(resolve => {
          setTimeout(resolve, this.delayMs);
        });

        return this.buildOutcomeResult({ status: 'success' });
      }

      protected buildOutcomeResult(outcome: {
        status: BaseStepStatus;
        error?: string;
      }): StepExecutionResult {
        return {
          stepOutcome: {
            type: 'record',
            stepId: this.context.stepId,
            stepIndex: this.context.stepIndex,
            status: outcome.status,
            ...(outcome.error !== undefined && { error: outcome.error }),
          },
        };
      }
    }

    it('returns error outcome with timeout userMessage when step exceeds stepTimeoutMs', async () => {
      jest.useFakeTimers();

      try {
        const executor = new SlowExecutor(makeContext({ stepTimeoutMs: 50 }), 10_000);
        const resultPromise = executor.execute();
        await Promise.resolve(); // flush checkIdempotency microtask so timers are registered
        jest.advanceTimersByTime(60);
        const result = await resultPromise;

        expect(result.stepOutcome.status).toBe('error');
        expect((result.stepOutcome as { error?: string }).error).toBe(
          'The step took too long to complete. Please try again, or contact your administrator if the problem persists.',
        );
      } finally {
        jest.useRealTimers();
      }
    });

    it('returns success when step finishes before stepTimeoutMs', async () => {
      const executor = new SlowExecutor(makeContext({ stepTimeoutMs: 5_000 }), 5);
      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
    });

    it('does not apply a timeout when stepTimeoutMs is unset', async () => {
      jest.useFakeTimers();

      try {
        const executor = new SlowExecutor(makeContext({ stepTimeoutMs: undefined }), 1_000);
        const resultPromise = executor.execute();
        // Advance past a hypothetical default; no timeout should fire
        jest.advanceTimersByTime(10_000);
        jest.useRealTimers();
        const result = await resultPromise;
        expect(result.stepOutcome.status).toBe('success');
      } finally {
        jest.useRealTimers();
      }
    });

    it('ignores stepTimeoutMs <= 0 (treated as disabled)', async () => {
      const executor = new SlowExecutor(makeContext({ stepTimeoutMs: 0 }), 5);
      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
    });

    it('logs structured context (runId/stepId/timeoutMs/stepType) when a step times out', async () => {
      jest.useFakeTimers();

      try {
        const logger = makeMockLogger();
        const executor = new SlowExecutor(makeContext({ stepTimeoutMs: 50, logger }), 10_000);
        const resultPromise = executor.execute();
        await Promise.resolve(); // flush checkIdempotency microtask so timers are registered
        jest.advanceTimersByTime(60);
        await resultPromise;

        expect(logger.error).toHaveBeenCalledWith(
          'Step execution exceeded timeout of 50ms',
          expect.objectContaining({
            runId: 'run-1',
            stepId: 'step-0',
            stepIndex: 0,
            stepType: StepType.Condition,
            timeoutMs: 50,
          }),
        );
      } finally {
        jest.useRealTimers();
      }
    });

    it('logs a late rejection of the losing promise as info (no UnhandledPromiseRejection)', async () => {
      class FailingAfterTimeoutExecutor extends BaseStepExecutor {
        protected async doExecute(): Promise<StepExecutionResult> {
          await new Promise(resolve => {
            setTimeout(resolve, 1_000);
          });
          throw new Error('late agent failure');
        }

        protected buildOutcomeResult(outcome: {
          status: BaseStepStatus;
          error?: string;
        }): StepExecutionResult {
          return {
            stepOutcome: {
              type: 'record',
              stepId: this.context.stepId,
              stepIndex: this.context.stepIndex,
              status: outcome.status,
              ...(outcome.error !== undefined && { error: outcome.error }),
            },
          };
        }
      }

      const unhandled = jest.fn();
      process.on('unhandledRejection', unhandled);

      try {
        const logger = makeMockLogger();
        const executor = new FailingAfterTimeoutExecutor(
          makeContext({ stepTimeoutMs: 10, logger }),
        );

        await executor.execute();
        // Let the underlying doExecute() reject after the timeout
        await new Promise(resolve => {
          setTimeout(resolve, 1_100);
        });

        expect(logger.warn).toHaveBeenCalledWith(
          'Step work rejected after timeout — result discarded',
          expect.objectContaining({
            runId: 'run-1',
            stepId: 'step-0',
            stepType: StepType.Condition,
            error: 'late agent failure',
          }),
        );
        expect(unhandled).not.toHaveBeenCalled();
      } finally {
        process.off('unhandledRejection', unhandled);
      }
    }, 5_000);

    it('does not log discard message when step rejects before timeout', async () => {
      const logger = makeMockLogger();
      const executor = new TestableExecutor(
        makeContext({ stepTimeoutMs: 5_000, logger }),
        new Error('normal step error'),
      );

      await executor.execute();

      expect(logger.warn).not.toHaveBeenCalledWith(
        'Step work rejected after timeout — result discarded',
        expect.anything(),
      );
    });
  });

  describe('activity log lifecycle', () => {
    class LoggedExecutor extends BaseStepExecutor {
      constructor(context: ExecutionContext, private readonly errorToThrow?: unknown) {
        super(context);
      }

      protected override buildActivityLogArgs() {
        return {
          renderingId: 1,
          action: 'update',
          type: 'write' as const,
          collectionId: 'col-1',
          recordId: 42,
        };
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
            type: 'record',
            stepId: this.context.stepId,
            stepIndex: this.context.stepIndex,
            status: outcome.status,
            ...(outcome.error !== undefined && { error: outcome.error }),
          },
        };
      }
    }

    it('creates pending log, runs doExecute, then marks succeeded on success', async () => {
      const context = makeContext();
      const executor = new LoggedExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(context.activityLogPort.createPending).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          type: 'write',
          collectionId: 'col-1',
        }),
      );
      expect(context.activityLogPort.markSucceeded).toHaveBeenCalledWith({
        id: 'log-1',
        index: '0',
      });
      expect(context.activityLogPort.markFailed).not.toHaveBeenCalled();
    });

    it('marks failed when doExecute throws a WorkflowExecutorError', async () => {
      const context = makeContext();
      const executor = new LoggedExecutor(context, new NoRecordsError());

      await executor.execute();

      expect(context.activityLogPort.markFailed).toHaveBeenCalledWith(
        { id: 'log-1', index: '0' },
        'No records available',
      );
      expect(context.activityLogPort.markSucceeded).not.toHaveBeenCalled();
    });

    it('fails the step and does NOT run doExecute when createPending throws ActivityLogCreationError', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
      const { ActivityLogCreationError } = require('../../src/errors');
      const context = makeContext();
      (context.activityLogPort.createPending as jest.Mock).mockRejectedValue(
        new ActivityLogCreationError(new Error('net')),
      );
      const doExecuteSpy = jest.fn().mockResolvedValue({
        stepOutcome: { type: 'record', stepId: 'x', stepIndex: 0, status: 'success' },
      });

      class NeverRunExecutor extends LoggedExecutor {
        protected override async doExecute(): Promise<StepExecutionResult> {
          return doExecuteSpy();
        }
      }

      const executor = new NeverRunExecutor(context);
      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'Could not record this step in the audit log. Please try again, or contact your administrator if the problem persists.',
      );
      expect(doExecuteSpy).not.toHaveBeenCalled();
    });

    it('does NOT create pending log when buildActivityLogArgs returns null (default)', async () => {
      const context = makeContext();
      const executor = new TestableExecutor(context);

      await executor.execute();

      expect(context.activityLogPort.createPending).not.toHaveBeenCalled();
      expect(context.activityLogPort.markSucceeded).not.toHaveBeenCalled();
    });

    it('calls markFailed with userMessage (not the technical message) on WorkflowExecutorError', async () => {
      class DualMessageError extends WorkflowExecutorError {
        constructor() {
          super(
            'Internal: datasource "customers" returned no record for pk=42',
            'The record no longer exists.',
          );
        }
      }
      const context = makeContext();
      const executor = new LoggedExecutor(context, new DualMessageError());

      await executor.execute();

      expect(context.activityLogPort.markFailed).toHaveBeenCalledWith(
        { id: 'log-1', index: '0' },
        'The record no longer exists.',
      );
    });

    it('marks failed when doExecute returns an error outcome without throwing', async () => {
      class ErrorOutcomeExecutor extends BaseStepExecutor {
        protected override buildActivityLogArgs() {
          return {
            renderingId: 1,
            action: 'update',
            type: 'write' as const,
            collectionName: 'customers',
            recordId: 42,
          };
        }

        protected async doExecute(): Promise<StepExecutionResult> {
          return this.buildOutcomeResult({ status: 'error', error: 'soft failure' });
        }

        protected buildOutcomeResult(outcome: {
          status: BaseStepStatus;
          error?: string;
        }): StepExecutionResult {
          return {
            stepOutcome: {
              type: 'record',
              stepId: this.context.stepId,
              stepIndex: this.context.stepIndex,
              status: outcome.status,
              ...(outcome.error !== undefined && { error: outcome.error }),
            },
          };
        }
      }

      const context = makeContext();
      const executor = new ErrorOutcomeExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(context.activityLogPort.markFailed).toHaveBeenCalledWith(
        { id: 'log-1', index: '0' },
        'soft failure',
      );
      expect(context.activityLogPort.markSucceeded).not.toHaveBeenCalled();
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

    describe('SystemMessage handling for Anthropic compat', () => {
      it('merges multiple leading SystemMessages into a single one', async () => {
        const { model, invoke } = makeMockModel({
          tool_calls: [{ name: 'tool', args: {}, id: 'c1' }],
        });
        const executor = new TestableExecutor(makeContext({ model }));
        const messages = [
          new SystemMessage('context'),
          new SystemMessage('previous steps'),
          new SystemMessage('step prompt'),
          new HumanMessage('request'),
        ];

        await executor.invokeWithTool(messages, dummyTool);

        const passedMessages = invoke.mock.calls[0][0] as BaseMessage[];
        expect(passedMessages).toHaveLength(2);
        expect(passedMessages[0]).toBeInstanceOf(SystemMessage);
        expect(passedMessages[0].content).toBe('context\n\nprevious steps\n\nstep prompt');
        expect(passedMessages[1]).toBeInstanceOf(HumanMessage);
      });

      it('leaves messages unchanged when only one leading SystemMessage', async () => {
        const { model, invoke } = makeMockModel({
          tool_calls: [{ name: 'tool', args: {}, id: 'c1' }],
        });
        const executor = new TestableExecutor(makeContext({ model }));
        const messages = [new SystemMessage('only system'), new HumanMessage('request')];

        await executor.invokeWithTool(messages, dummyTool);

        expect(invoke).toHaveBeenCalledWith(messages);
      });

      it('leaves messages unchanged when there is no SystemMessage', async () => {
        const { model, invoke } = makeMockModel({
          tool_calls: [{ name: 'tool', args: {}, id: 'c1' }],
        });
        const executor = new TestableExecutor(makeContext({ model }));
        const messages = [new HumanMessage('only human')];

        await executor.invokeWithTool(messages, dummyTool);

        expect(invoke).toHaveBeenCalledWith(messages);
      });

      it('throws when a SystemMessage appears after a non-system message', async () => {
        const { model } = makeMockModel({
          tool_calls: [{ name: 'tool', args: {}, id: 'c1' }],
        });
        const executor = new TestableExecutor(makeContext({ model }));
        const messages = [
          new SystemMessage('leading'),
          new HumanMessage('request'),
          new SystemMessage('mid-array (invalid for Anthropic)'),
        ];

        await expect(executor.invokeWithTool(messages, dummyTool)).rejects.toThrow(
          InvalidAiRequestError,
        );
        await expect(executor.invokeWithTool(messages, dummyTool)).rejects.toThrow(
          /SystemMessage at position 2 appears after a non-system message/,
        );
      });
    });

    describe('AI invoke timeout', () => {
      // Mocks a model.invoke that never resolves on its own but rejects with AbortError
      // when its received AbortSignal fires — mimics LangChain's behavior on signal.abort().
      function makeHangingModel() {
        const invoke = jest.fn().mockImplementation(
          (_messages, opts) =>
            new Promise((_resolve, reject) => {
              opts?.signal?.addEventListener('abort', () => {
                const err = new Error('Aborted');
                err.name = 'AbortError';
                reject(err);
              });
            }),
        );

        return {
          model: {
            bindTools: jest.fn().mockReturnValue({ invoke }),
          } as unknown as ExecutionContext['model'],
          invoke,
        };
      }

      it('throws AiInvokeTimeoutError when model.invoke hangs beyond aiInvokeTimeoutMs', async () => {
        jest.useFakeTimers();

        try {
          const { model } = makeHangingModel();
          const executor = new TestableExecutor(makeContext({ model, aiInvokeTimeoutMs: 100 }));
          const promise = executor.invokeWithTool(dummyMessages, dummyTool);
          // Attach catch synchronously so a late rejection (after advanceTimersByTime) doesn't
          // produce an unhandled rejection warning.
          const caught = promise.catch(err => err);
          jest.advanceTimersByTime(150);
          const err = await caught;

          expect(err).toBeInstanceOf(AiInvokeTimeoutError);
          expect((err as Error).message).toContain('100ms');
        } finally {
          jest.useRealTimers();
        }
      });

      it('passes the AbortSignal as the second arg to model.invoke', async () => {
        const { model, invoke } = makeMockModel({
          tool_calls: [{ name: 'tool', args: {}, id: 'c1' }],
        });
        const executor = new TestableExecutor(makeContext({ model, aiInvokeTimeoutMs: 5_000 }));

        await executor.invokeWithTool(dummyMessages, dummyTool);

        expect(invoke).toHaveBeenCalledWith(
          expect.any(Array),
          expect.objectContaining({ signal: expect.any(AbortSignal) }),
        );
      });

      it('does not pass any options to model.invoke when aiInvokeTimeoutMs is unset', async () => {
        const { model, invoke } = makeMockModel({
          tool_calls: [{ name: 'tool', args: {}, id: 'c1' }],
        });
        const executor = new TestableExecutor(makeContext({ model, aiInvokeTimeoutMs: undefined }));

        await executor.invokeWithTool(dummyMessages, dummyTool);

        expect(invoke).toHaveBeenCalledTimes(1);
        expect(invoke.mock.calls[0]).toHaveLength(1);
      });

      it('treats aiInvokeTimeoutMs <= 0 as disabled', async () => {
        const { model, invoke } = makeMockModel({
          tool_calls: [{ name: 'tool', args: {}, id: 'c1' }],
        });
        const executor = new TestableExecutor(makeContext({ model, aiInvokeTimeoutMs: 0 }));

        await executor.invokeWithTool(dummyMessages, dummyTool);

        expect(invoke.mock.calls[0]).toHaveLength(1);
      });

      it('rethrows non-abort errors without wrapping them', async () => {
        const apiError = Object.assign(new Error('OpenAI 503'), { status: 503, name: 'APIError' });
        const invoke = jest.fn().mockRejectedValue(apiError);
        const model = {
          bindTools: jest.fn().mockReturnValue({ invoke }),
        } as unknown as ExecutionContext['model'];
        const executor = new TestableExecutor(makeContext({ model, aiInvokeTimeoutMs: 5_000 }));

        await expect(executor.invokeWithTool(dummyMessages, dummyTool)).rejects.toBe(apiError);
      });

      it('clears the timer after a successful invoke (no unref leak)', async () => {
        const { model } = makeMockModel({
          tool_calls: [{ name: 'tool', args: {}, id: 'c1' }],
        });
        const clearSpy = jest.spyOn(global, 'clearTimeout');
        const executor = new TestableExecutor(makeContext({ model, aiInvokeTimeoutMs: 5_000 }));

        try {
          await executor.invokeWithTool(dummyMessages, dummyTool);
          expect(clearSpy).toHaveBeenCalled();
        } finally {
          clearSpy.mockRestore();
        }
      });
    });
  });

  describe('patchAndReloadPendingData', () => {
    class PatchingExecutor extends BaseStepExecutor {
      async callPatchAndReload(pendingData?: unknown) {
        return (
          this as unknown as { patchAndReloadPendingData(d?: unknown): Promise<unknown> }
        ).patchAndReloadPendingData(pendingData);
      }

      protected async doExecute(): Promise<StepExecutionResult> {
        return this.buildOutcomeResult({ status: 'success' });
      }

      protected buildOutcomeResult(outcome: {
        status: BaseStepStatus;
        error?: string;
      }): StepExecutionResult {
        return {
          stepOutcome: {
            type: 'record',
            stepId: this.context.stepId,
            stepIndex: this.context.stepIndex,
            status: outcome.status,
          },
        };
      }
    }

    it('throws StepStateError when no schema is registered for the step type', async () => {
      const runStore = makeMockRunStore([
        { type: 'read-record', stepIndex: 0 } as unknown as StepExecutionData,
      ]);
      const executor = new PatchingExecutor(
        makeContext({
          runStore,
          stepDefinition: {
            type: StepType.ReadRecord,
            executionType: StepExecutionMode.FullyAutomated,
          },
        }),
      );

      await expect(executor.callPatchAndReload({ someField: 'x' })).rejects.toThrow(StepStateError);
      await expect(executor.callPatchAndReload({ someField: 'x' })).rejects.toThrow(
        'No pending-data validator registered for step type "read-record"',
      );
    });
  });
});
