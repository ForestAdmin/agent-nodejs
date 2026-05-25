import type { CreateActivityLogArgs } from '../ports/activity-log-port';
import type { AgentPort } from '../ports/agent-port';
import type {
  ExecutionContext,
  IStepExecutor,
  StepExecutionResult,
} from '../types/execution-context';
import type { StepExecutionData, WithUserConfirmation } from '../types/step-execution-data';
import type { StepDefinition } from '../types/validated/step-definition';
import type { StepStatus } from '../types/validated/step-outcome';
import type {
  BaseMessage,
  DynamicStructuredTool,
  StructuredToolInterface,
} from '@forestadmin/ai-proxy';

import { SystemMessage } from '@forestadmin/ai-proxy';

import {
  MalformedToolCallError,
  MissingToolCallError,
  StepStateError,
  StepTimeoutError,
  WorkflowExecutorError,
  extractErrorMessage,
} from '../errors';
import patchBodySchemas from '../http/pending-data-validators';
import StepSummaryBuilder from './summary/step-summary-builder';

type WithPendingData = StepExecutionData & { pendingData?: object } & WithUserConfirmation;

type PatchBody = Record<string, unknown> & { userConfirmed?: boolean };

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
      // Idempotency guard — mutating executors override this. Called before runWithActivityLog
      // so that cache hits and uncertain-state errors never emit an activity log entry.
      const cached = await this.checkIdempotency();

      if (cached) {
        this.context.logger.info('Step execution completed (replayed from cache)', {
          ...this.logCtx,
          status: cached.stepOutcome.status,
        });

        return cached;
      }

      const result = await this.runWithActivityLog();

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
        if (error.cause !== undefined) {
          this.context.logger.error(error.message, {
            ...this.logCtx,
            cause: extractErrorMessage(error.cause),
            stack: error.cause instanceof Error ? error.cause.stack : undefined,
          });
        }

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

  // Return null when the frontend performs the action (e.g. TriggerAction without
  // executionType=FullyAutomated) — the front logs on its side. Override when the
  // executor itself calls the agent.
  protected buildActivityLogArgs(): CreateActivityLogArgs | null {
    return null;
  }

  private async runWithActivityLog(): Promise<StepExecutionResult> {
    const args = this.buildActivityLogArgs();
    if (!args) return this.runWithTimeout();

    const handle = await this.context.activityLogPort.createPending(args);

    let result: StepExecutionResult;

    try {
      result = await this.runWithTimeout();
    } catch (err) {
      // Use userMessage (not the technical message) — errorMessage is rendered to end-users
      // in the Forest Admin UI. Privacy: no collection/field/AI internals in the audit trail.
      const errorMessage =
        err instanceof WorkflowExecutorError ? err.userMessage : 'Unexpected error';
      void this.context.activityLogPort.markFailed(handle, errorMessage);
      throw err;
    }

    if (result.stepOutcome.status === 'error') {
      void this.context.activityLogPort.markFailed(
        handle,
        result.stepOutcome.error ?? 'Step failed',
      );
    } else {
      void this.context.activityLogPort.markSucceeded(handle);
    }

    return result;
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

  protected async findPendingExecution<TExec extends WithPendingData>(
    type: string,
  ): Promise<TExec | undefined> {
    const stepExecutions = await this.context.runStore.getStepExecutions(this.context.runId);

    return stepExecutions.find(
      (e): e is TExec => (e as TExec).type === type && e.stepIndex === this.context.stepIndex,
    );
  }

  // Preserves the AI suggestion in pendingData: only userConfirmed is mirrored there because
  // handleConfirmationFlow gates on it. The full parsed PATCH body is stored in userConfirmation.
  protected async patchAndReloadPendingData<TExec extends WithPendingData>(
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

    const patchBody = parsed.data as PatchBody;

    // Last-write-wins: spread-merging would leak stale keys from prior PATCHes.
    const updated: TExec = {
      ...execution,
      pendingData: {
        ...execution.pendingData,
        ...(patchBody.userConfirmed !== undefined
          ? { userConfirmed: patchBody.userConfirmed }
          : {}),
      },
      userConfirmation: patchBody as TExec['userConfirmation'],
    };

    await this.context.runStore.saveStepExecution(this.context.runId, updated);

    return updated;
  }

  // userConfirmed branches: undefined → re-emit awaiting-input (PATCH not yet called);
  // false → save as skipped + success outcome; true → resolveAndExecute.
  protected async handleConfirmationFlow<TExec extends WithPendingData>(
    execution: TExec,
    resolveAndExecute: (execution: TExec) => Promise<StepExecutionResult>,
  ): Promise<StepExecutionResult> {
    if (!execution.pendingData) {
      throw new StepStateError(`Step at index ${this.context.stepIndex} has no pending data`);
    }

    const { userConfirmed } = execution.pendingData as { userConfirmed?: boolean };

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

  protected async invokeWithTools<T = Record<string, unknown>>(
    messages: BaseMessage[],
    tools: StructuredToolInterface[],
  ): Promise<{ toolName: string; args: T }> {
    const modelWithTools = this.context.model.bindTools(tools, { tool_choice: 'any' });
    const response = await modelWithTools.invoke(messages);
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

  private get logCtx() {
    const { runId, stepId, stepIndex, stepDefinition } = this.context;

    return { runId, stepId, stepIndex, stepType: stepDefinition.type };
  }
}
