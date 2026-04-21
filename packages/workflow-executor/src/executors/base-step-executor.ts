import type { CreateActivityLogArgs } from '../ports/activity-log-port';
import type { AgentPort } from '../ports/agent-port';
import type { ExecutionContext, IStepExecutor, StepExecutionResult } from '../types/execution';
import type { CollectionSchema, FieldSchema, RecordRef } from '../types/record';
import type { StepDefinition } from '../types/step-definition';
import type { StepExecutionData } from '../types/step-execution-data';
import type { StepStatus } from '../types/step-outcome';
import type { BaseMessage, StructuredToolInterface } from '@forestadmin/ai-proxy';

import { DynamicStructuredTool, HumanMessage, SystemMessage } from '@forestadmin/ai-proxy';
import { z } from 'zod';

import {
  InvalidAIResponseError,
  MalformedToolCallError,
  MissingToolCallError,
  NoRecordsError,
  StepStateError,
  StepTimeoutError,
  WorkflowExecutorError,
  extractErrorMessage,
} from '../errors';
import patchBodySchemas from '../pending-data-validators';
import StepSummaryBuilder from './summary/step-summary-builder';

type WithPendingData = StepExecutionData & { pendingData?: object };

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
    const { runId, stepId, stepIndex, stepDefinition, baseRecordRef } = this.context;

    this.context.logger.info('Step execution started', {
      runId,
      stepId,
      stepIndex,
      stepType: stepDefinition.type,
      collection: baseRecordRef.collectionName,
    });

    try {
      const result = await this.runWithActivityLog();

      this.context.logger.info('Step execution completed', {
        runId,
        stepId,
        stepIndex,
        status: result.stepOutcome.status,
      });

      return result;
    } catch (error) {
      if (error instanceof StepTimeoutError) {
        this.context.logger.error(error.message, {
          runId: this.context.runId,
          stepId: this.context.stepId,
          stepIndex: this.context.stepIndex,
          stepType: this.context.stepDefinition.type,
          timeoutMs: this.context.stepTimeoutMs,
        });

        return this.buildOutcomeResult({ status: 'error', error: error.userMessage });
      }

      if (error instanceof WorkflowExecutorError) {
        if (error.cause !== undefined) {
          this.context.logger.error(error.message, {
            runId: this.context.runId,
            stepId: this.context.stepId,
            stepIndex: this.context.stepIndex,
            cause: error.cause instanceof Error ? error.cause.message : String(error.cause),
            stack: error.cause instanceof Error ? error.cause.stack : undefined,
          });
        }

        return this.buildOutcomeResult({ status: 'error', error: error.userMessage });
      }

      const { cause: errorCause } = error as { cause?: unknown };
      this.context.logger.error('Unexpected error during step execution', {
        runId: this.context.runId,
        stepId: this.context.stepId,
        stepIndex: this.context.stepIndex,
        error: extractErrorMessage(error),
        cause: errorCause instanceof Error ? errorCause.message : undefined,
        stack: error instanceof Error ? error.stack : undefined,
      });

      return this.buildOutcomeResult({
        status: 'error',
        error: 'Unexpected error during step execution',
      });
    }
  }

  protected abstract doExecute(): Promise<StepExecutionResult>;

  /**
   * Override in concrete executors to emit a Forest Admin activity log around
   * the step. Return `null` to skip (default): no log is created.
   *
   * Only override when the executor itself performs the action on the agent.
   * If the frontend executes (e.g., TriggerAction with automaticExecution=false),
   * return `null` — the front logs on its side via the standard agent flow.
   */
  protected buildActivityLogArgs(): CreateActivityLogArgs | null {
    return null;
  }

  /**
   * Wrap runWithTimeout() with a Forest Admin activity log.
   *
   * - Creates a Pending log (blocking, with 3 retries in the port adapter).
   *   If creation fails after all retries, ActivityLogCreationError bubbles
   *   up and is caught by execute() → step ends in error.
   * - Transitions the log to completed/failed after the step finishes
   *   (fire-and-forget; retries happen in background).
   */
  private async runWithActivityLog(): Promise<StepExecutionResult> {
    const args = this.buildActivityLogArgs();
    if (!args) return this.runWithTimeout();

    const handle = await this.context.activityLogPort.createPending(args);

    let result: StepExecutionResult;

    try {
      result = await this.runWithTimeout();
    } catch (err) {
      // doExecute threw (domain or unexpected error). Mark the log as failed
      // so the audit trail reflects the failure, then rethrow for execute()
      // to convert into a stepOutcome.
      //
      // Use userMessage (not the technical message) — the errorMessage field
      // is rendered to end-users in the Forest Admin UI, so leaking
      // collection/field/AI internals (CLAUDE.md "Dual error messages") is
      // a privacy/UX issue. Same choice as buildOutcomeResult below.
      const errorMessage =
        err instanceof WorkflowExecutorError ? err.userMessage : 'Unexpected error';
      void this.context.activityLogPort.markFailed(
        handle,
        this.context.forestServerToken,
        errorMessage,
      );
      throw err;
    }

    if (result.stepOutcome.status === 'error') {
      void this.context.activityLogPort.markFailed(
        handle,
        this.context.forestServerToken,
        result.stepOutcome.error ?? 'Step failed',
      );
    } else {
      void this.context.activityLogPort.markSucceeded(handle, this.context.forestServerToken);
    }

    return result;
  }

  /**
   * Wrap doExecute() with a Promise.race against `stepTimeoutMs`. Always applied
   * when a timeout is configured (default 5 min in build-workflow-executor); the
   * `<= 0` guard below is defense-in-depth for programmatic consumers who pass 0
   * or undefined explicitly.
   *
   * The losing promise is NOT aborted (Promise.race limitation) and continues
   * running in the background. A `.catch()` is attached to the work promise so a
   * late rejection becomes a logged info entry instead of UnhandledPromiseRejection;
   * a late resolution is silently discarded.
   */
  private async runWithTimeout(): Promise<StepExecutionResult> {
    const timeoutMs = this.context.stepTimeoutMs;
    if (!timeoutMs || timeoutMs <= 0) return this.doExecute();

    let timer: NodeJS.Timeout | undefined;
    const execPromise = this.doExecute();

    // Must be attached BEFORE Promise.race so a late rejection on the losing
    // branch has a handler and doesn't trigger UnhandledPromiseRejection.
    execPromise.catch(err => {
      this.context.logger.info('Step work rejected after timeout — result discarded', {
        runId: this.context.runId,
        stepId: this.context.stepId,
        stepIndex: this.context.stepIndex,
        error: extractErrorMessage(err),
      });
    });

    try {
      return await Promise.race([
        execPromise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new StepTimeoutError(timeoutMs)), timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** Find a field by displayName first, then fallback to fieldName. */
  protected findField(schema: CollectionSchema, name: string): FieldSchema | undefined {
    return (
      schema.fields.find(f => f.displayName === name) ??
      schema.fields.find(f => f.fieldName === name)
    );
  }

  /** Builds a StepExecutionResult with the step-type-specific outcome shape. */
  protected abstract buildOutcomeResult(outcome: {
    status: StepStatus;
    error?: string;
  }): StepExecutionResult;

  /**
   * Finds a step execution in the RunStore matching the given type and the current stepIndex.
   * Returns undefined if no matching execution exists (first call → Branch B/C).
   */
  protected async findPendingExecution<TExec extends WithPendingData>(
    type: string,
  ): Promise<TExec | undefined> {
    const stepExecutions = await this.context.runStore.getStepExecutions(this.context.runId);

    return stepExecutions.find(
      (e): e is TExec => (e as TExec).type === type && e.stepIndex === this.context.stepIndex,
    );
  }

  /**
   * Finds an existing pending execution and, when pendingData is provided,
   * validates it against the step-type schema and merges it into the execution.
   * Returns the (possibly updated) execution, or undefined if none exists.
   */
  protected async patchAndReloadPendingData<TExec extends WithPendingData>(
    pendingData?: unknown,
  ): Promise<TExec | undefined> {
    const { type } = this.context.stepDefinition;
    const execution = await this.findPendingExecution<TExec>(type);

    if (pendingData !== undefined && execution) {
      const schema = patchBodySchemas[execution.type]!;
      const parsed = schema.safeParse(pendingData);

      if (!parsed.success) {
        throw new StepStateError(
          `Invalid pending data: ${parsed.error.issues.map(i => i.message).join(', ')}`,
        );
      }

      const updated = {
        ...execution,
        pendingData: { ...(execution.pendingData as object), ...(parsed.data as object) },
      } as TExec;

      await this.context.runStore.saveStepExecution(
        this.context.runId,
        updated as StepExecutionData,
      );

      return updated;
    }

    return execution;
  }

  /**
   * Shared confirmation flow for executors that require user approval before acting.
   * Receives a pre-loaded execution (from findPendingExecution) and checks pendingData.userConfirmed:
   * - undefined → PATCH not yet called → re-emit awaiting-input (safe no-op)
   * - false → save execution as skipped and return success outcome
   * - true → execute via resolveAndExecute
   */
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

  /** Returns a SystemMessage with the current user info and date/time context. */
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

  /**
   * Returns a SystemMessage array summarizing previously executed steps.
   * Empty array when there is no history. Ready to spread into a messages array.
   */
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

  /**
   * Binds multiple tools to the model, invokes it, and returns the selected tool name + args.
   * Throws MalformedToolCallError or MissingToolCallError on invalid AI responses.
   */
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

  /**
   * Binds a single tool to the model, invokes it, and extracts the tool call args.
   * Throws MalformedToolCallError or MissingToolCallError on invalid AI responses.
   */
  protected async invokeWithTool<T = Record<string, unknown>>(
    messages: BaseMessage[],
    tool: DynamicStructuredTool,
  ): Promise<T> {
    return (await this.invokeWithTools<T>(messages, [tool])).args;
  }

  /** Returns baseRecordRef + any related records loaded by previous steps. */
  protected async getAvailableRecordRefs(): Promise<RecordRef[]> {
    const stepExecutions = await this.context.runStore.getStepExecutions(this.context.runId);
    const relatedRecords = stepExecutions.flatMap(e => {
      if (
        e.type === 'load-related-record' &&
        e.executionResult !== undefined &&
        'record' in e.executionResult
      ) {
        return [e.executionResult.record];
      }

      return [];
    });

    return [this.context.baseRecordRef, ...relatedRecords];
  }

  /** Selects a record ref via AI when multiple are available, returns directly when only one. */
  protected async selectRecordRef(
    records: RecordRef[],
    prompt: string | undefined,
  ): Promise<RecordRef> {
    if (records.length === 0) throw new NoRecordsError();
    if (records.length === 1) return records[0];

    const identifiers = await Promise.all(records.map(r => this.toRecordIdentifier(r)));
    const identifierTuple = identifiers as [string, ...string[]];

    const tool = new DynamicStructuredTool({
      name: 'select-record',
      description: 'Select the most relevant record for this workflow step.',
      schema: z.object({
        recordIdentifier: z.enum(identifierTuple),
      }),
      func: undefined,
    });

    const messages = [
      this.buildContextMessage(),
      ...(await this.buildPreviousStepsMessages()),
      new SystemMessage(
        'You are an AI agent selecting the most relevant record for a workflow step.\n' +
          'Choose the record whose collection best matches the user request.\n' +
          'Pay attention to the collection name of each record.',
      ),
      new HumanMessage(prompt ?? 'Select the most relevant record.'),
    ];

    const { recordIdentifier } = await this.invokeWithTool<{ recordIdentifier: string }>(
      messages,
      tool,
    );

    const selectedIndex = identifiers.indexOf(recordIdentifier);

    if (selectedIndex === -1) {
      throw new InvalidAIResponseError(
        `AI selected record "${recordIdentifier}" which does not match any available record`,
      );
    }

    return records[selectedIndex];
  }

  /** Fetches a collection schema from WorkflowPort, with TTL-based caching. */
  protected async getCollectionSchema(collectionName: string): Promise<CollectionSchema> {
    const cached = this.context.schemaCache.get(collectionName);
    if (cached) return cached;

    const schema = await this.context.workflowPort.getCollectionSchema(
      collectionName,
      this.context.runId,
    );
    this.context.schemaCache.set(collectionName, schema);

    return schema;
  }

  /** Formats a record ref as "Step X - CollectionDisplayName #id". */
  protected async toRecordIdentifier(record: RecordRef): Promise<string> {
    const schema = await this.getCollectionSchema(record.collectionName);

    return `Step ${record.stepIndex} - ${schema.collectionDisplayName} #${record.recordId}`;
  }
}
