import type { CreateActivityLogArgs } from '../ports/activity-log-port';
import type { AgentPort } from '../ports/agent-port';
import type {
  ExecutionContext,
  IStepExecutor,
  StepExecutionResult,
} from '../types/execution-context';
import type { StepExecutionData } from '../types/step-execution-data';
import type { CollectionSchema, FieldSchema, RecordRef } from '../types/validated/collection';
import type { StepDefinition } from '../types/validated/step-definition';
import type { StepStatus } from '../types/validated/step-outcome';
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
import patchBodySchemas from '../http/pending-data-validators';
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

  // Return null when the frontend performs the action (e.g. TriggerAction with automaticExecution=false)
  // — the front logs on its side. Override when the executor itself calls the agent.
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
    const execPromise = this.doExecute();

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

  protected findField(schema: CollectionSchema, name: string): FieldSchema | undefined {
    return (
      schema.fields.find(f => f.displayName === name) ??
      schema.fields.find(f => f.fieldName === name)
    );
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

  protected async toRecordIdentifier(record: RecordRef): Promise<string> {
    const schema = await this.getCollectionSchema(record.collectionName);

    return `Step ${record.stepIndex} - ${schema.collectionDisplayName} #${record.recordId}`;
  }
}
