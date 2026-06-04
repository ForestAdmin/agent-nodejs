import type { AgentPort } from '../ports/agent-port';
import type {
  ExecutionContext,
  IStepExecutor,
  StepExecutionResult,
} from '../types/execution-context';
import type { ConfirmableStepExecutionData, StepExecutionData } from '../types/step-execution-data';
import type { StepDefinition } from '../types/validated/step-definition';
import type { StepStatus } from '../types/validated/step-outcome';
import type {
  BaseMessage,
  DynamicStructuredTool,
  StructuredToolInterface,
} from '@forestadmin/ai-proxy';

import { SystemMessage } from '@forestadmin/ai-proxy';

import {
  AiInvokeTimeoutError,
  InvalidAiRequestError,
  MalformedToolCallError,
  MissingToolCallError,
  StepStateError,
  StepTimeoutError,
  WorkflowExecutorError,
  extractErrorMessage,
} from '../errors';
import patchBodySchemas from '../http/pending-data-validators';
import StepSummaryBuilder from './summary/step-summary-builder';

export default abstract class BaseStepExecutor<TStep extends StepDefinition = StepDefinition>
  implements IStepExecutor
{
  protected readonly context: ExecutionContext<TStep>;

  protected readonly agentPort: AgentPort;

  constructor(context: ExecutionContext<TStep>) {
    this.context = context;
    this.agentPort = context.agentPort;
  }

  async execute(): Promise<StepExecutionResult> {
    const { baseRecordRef } = this.context;

    this.context.logger.info('Step execution started', {
      ...this.logCtx,
      collection: baseRecordRef.collectionName,
    });

    try {
      // Idempotency guard — mutating executors override this. Runs before doExecute so a cache
      // hit or uncertain-state error short-circuits before any side effect, including the
      // activity log emitted inside OperationStepExecutor.logOperation.
      const cached = await this.checkIdempotency();

      if (cached) {
        this.context.logger.info('Step execution completed (replayed from cache)', {
          ...this.logCtx,
          status: cached.stepOutcome.status,
        });

        return cached;
      }

      const result = await this.runWithTimeout();

      this.context.logger.info('Step execution completed', {
        ...this.logCtx,
        status: result.stepOutcome.status,
      });

      return result;
    } catch (error) {
      if (error instanceof StepTimeoutError) {
        this.context.logger.error(error.message, {
          ...this.logCtx,
          timeoutMs: this.context.stepTimeoutMs,
        });

        return this.buildOutcomeResult({ status: 'error', error: error.userMessage });
      }

      if (error instanceof WorkflowExecutorError) {
        this.context.logger.error(error.message, {
          ...this.logCtx,
          cause: extractErrorMessage(error.cause),
          stack: error.cause instanceof Error ? error.cause.stack : undefined,
        });

        return this.buildOutcomeResult({ status: 'error', error: error.userMessage });
      }

      const { cause: errorCause } = error as { cause?: unknown };
      this.context.logger.error('Unexpected error during step execution', {
        ...this.logCtx,
        error: extractErrorMessage(error),
        cause: extractErrorMessage(errorCause),
        stack: error instanceof Error ? error.stack : undefined,
      });

      return this.buildOutcomeResult({
        status: 'error',
        error: 'Unexpected error during step execution',
      });
    }
  }

  protected abstract doExecute(): Promise<StepExecutionResult>;

  protected checkIdempotency(): Promise<StepExecutionResult | null> {
    return Promise.resolve(null);
  }

  // Promise.race doesn't abort the losing branch — it keeps running in the background. The .catch()
  // on execPromise must be attached BEFORE the race so a late rejection doesn't trigger
  // UnhandledPromiseRejection. Late resolutions are silently discarded.
  private async runWithTimeout(): Promise<StepExecutionResult> {
    const timeoutMs = this.context.stepTimeoutMs;
    if (!timeoutMs || timeoutMs <= 0) return this.doExecute();

    let timer: NodeJS.Timeout | undefined;
    let hasTimeoutFired = false;
    const execPromise = this.doExecute();

    execPromise.catch(err => {
      if (!hasTimeoutFired) return;
      this.context.logger.warn('Step work rejected after timeout — result discarded', {
        ...this.logCtx,
        error: extractErrorMessage(err),
      });
    });

    try {
      return await Promise.race([
        execPromise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            hasTimeoutFired = true;
            reject(new StepTimeoutError(timeoutMs));
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  protected abstract buildOutcomeResult(outcome: {
    status: StepStatus;
    error?: string;
  }): StepExecutionResult;

  protected async findPendingExecution<TExec extends ConfirmableStepExecutionData>(
    type: string,
  ): Promise<TExec | undefined> {
    const stepExecutions = await this.context.runStore.getStepExecutions(this.context.runId);

    return stepExecutions.find(
      (e): e is TExec => (e as TExec).type === type && e.stepIndex === this.context.stepIndex,
    );
  }

  protected async patchAndReloadPendingData<TExec extends ConfirmableStepExecutionData>(
    pendingData?: unknown,
  ): Promise<TExec | undefined> {
    const { type } = this.context.stepDefinition;
    const execution = await this.findPendingExecution<TExec>(type);

    if (!execution) return undefined;

    if (pendingData === undefined) return execution;

    const schema = patchBodySchemas[execution.type];

    if (!schema) {
      throw new StepStateError(
        `No pending-data validator registered for step type "${execution.type}"`,
      );
    }

    const parsed = schema.safeParse(pendingData);

    if (!parsed.success) {
      throw new StepStateError(
        `Invalid pending data: ${parsed.error.issues.map(i => i.message).join(', ')}`,
      );
    }

    const userConfirmation = parsed.data as TExec['userConfirmation'];

    const updated: TExec = {
      ...execution,
      userConfirmation,
    };

    await this.context.runStore.saveStepExecution(this.context.runId, updated);

    return updated;
  }

  // userConfirmed branches: undefined → re-emit awaiting-input (POST not yet called);
  // false → save as skipped + success outcome; true → resolveAndExecute.
  protected async handleConfirmationFlow<TExec extends ConfirmableStepExecutionData>(
    execution: TExec,
    resolveAndExecute: (execution: TExec) => Promise<StepExecutionResult>,
  ): Promise<StepExecutionResult> {
    if (!execution.pendingData) {
      throw new StepStateError(`Step at index ${this.context.stepIndex} has no pending data`);
    }

    const { userConfirmed } = execution.userConfirmation ?? {};

    if (userConfirmed === undefined) {
      return this.buildOutcomeResult({ status: 'awaiting-input' });
    }

    if (!userConfirmed) {
      await this.context.runStore.saveStepExecution(this.context.runId, {
        ...execution,
        executionResult: { skipped: true },
      } as StepExecutionData);

      return this.buildOutcomeResult({ status: 'success' });
    }

    return resolveAndExecute(execution);
  }

  protected buildContextMessage(): SystemMessage {
    const { user } = this.context;
    const now = new Date();

    return new SystemMessage(
      [
        `Step executed by: ${user.firstName} ${user.lastName} (${user.email}, id: ${user.id})`,
        `Role: ${user.role} | Team: ${user.team}`,
        `Current date and time: ${now.toISOString()} (UTC)`,
      ].join('\n'),
    );
  }

  protected async buildPreviousStepsMessages(): Promise<SystemMessage[]> {
    if (!this.context.previousSteps.length) return [];

    const allStepExecutions = await this.context.runStore.getStepExecutions(this.context.runId);
    const summary = this.context.previousSteps
      .map(({ stepDefinition, stepOutcome }) => {
        const execution = allStepExecutions.find(e => e.stepIndex === stepOutcome.stepIndex);

        return StepSummaryBuilder.build(stepDefinition, stepOutcome, execution);
      })
      .join('\n\n');

    return [new SystemMessage(summary)];
  }

  private static mergeLeadingSystemMessages(messages: BaseMessage[]): BaseMessage[] {
    let i = 0;
    while (i < messages.length && messages[i] instanceof SystemMessage) i += 1;
    if (i <= 1) return messages;

    const merged = new SystemMessage(
      messages
        .slice(0, i)
        .map(m => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)))
        .filter(Boolean)
        .join('\n\n'),
    );

    return [merged, ...messages.slice(i)];
  }

  private static assertNoMidArraySystemMessages(messages: BaseMessage[]): void {
    let seenNonSystem = false;

    for (let i = 0; i < messages.length; i += 1) {
      if (!(messages[i] instanceof SystemMessage)) {
        seenNonSystem = true;
      } else if (seenNonSystem) {
        throw new InvalidAiRequestError(
          `SystemMessage at position ${i} appears after a non-system message — move all system context to the front of the messages array.`,
        );
      }
    }
  }

  protected async invokeWithTools<T = Record<string, unknown>>(
    messages: BaseMessage[],
    tools: StructuredToolInterface[],
  ): Promise<{ toolName: string; args: T }> {
    BaseStepExecutor.assertNoMidArraySystemMessages(messages);
    const modelWithTools = this.context.model.bindTools(tools, { tool_choice: 'any' });
    const preparedMessages = BaseStepExecutor.mergeLeadingSystemMessages(messages);
    const aiTimeoutMs = this.context.aiInvokeTimeoutMs;
    const timeoutMs = aiTimeoutMs && aiTimeoutMs > 0 ? aiTimeoutMs : undefined;
    const signal = timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined;

    let response;

    try {
      // `signal: undefined` is equivalent to passing no options — LangChain leaves the call un-timed.
      response = await modelWithTools.invoke(preparedMessages, { signal });
    } catch (err) {
      // Detect the timeout via our own signal, not the thrown error's name: providers wrap an
      // aborted request differently (AbortError, TimeoutError, APIUserAbortError, …).
      if (timeoutMs !== undefined && signal?.aborted) throw new AiInvokeTimeoutError(timeoutMs);
      throw err;
    }

    const toolCall = response.tool_calls?.[0];

    if (toolCall !== undefined) {
      if (toolCall.args !== undefined && toolCall.args !== null) {
        return { toolName: toolCall.name, args: toolCall.args as T };
      }

      throw new MalformedToolCallError(toolCall.name ?? 'unknown', 'args field is missing or null');
    }

    const invalidCall = response.invalid_tool_calls?.[0];

    if (invalidCall) {
      throw new MalformedToolCallError(
        invalidCall.name ?? 'unknown',
        invalidCall.error ?? 'no details available',
      );
    }

    throw new MissingToolCallError();
  }

  protected async invokeWithTool<T = Record<string, unknown>>(
    messages: BaseMessage[],
    tool: DynamicStructuredTool,
  ): Promise<T> {
    return (await this.invokeWithTools<T>(messages, [tool])).args;
  }

  // Overridden by executors that carry type-specific log identifiers (e.g. McpStepExecutor).
  protected getExtraLogContext(): Record<string, unknown> {
    return {};
  }

  protected get logCtx() {
    const { runId, stepId, stepIndex, stepDefinition } = this.context;

    return {
      runId,
      stepId,
      stepIndex,
      stepType: stepDefinition.type,
      ...this.getExtraLogContext(),
    };
  }
}
