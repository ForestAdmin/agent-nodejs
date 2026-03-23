import type { AgentPort } from '../ports/agent-port';
import type { ExecutionContext, StepExecutionResult } from '../types/execution';
import type { CollectionSchema, FieldSchema, RecordRef } from '../types/record';
import type { StepDefinition } from '../types/step-definition';
import type { StepExecutionData } from '../types/step-execution-data';
import type { BaseStepStatus } from '../types/step-outcome';
import type { BaseMessage, StructuredToolInterface } from '@forestadmin/ai-proxy';

import { DynamicStructuredTool, HumanMessage, SystemMessage } from '@forestadmin/ai-proxy';
import { z } from 'zod';

import {
  InvalidAIResponseError,
  MalformedToolCallError,
  MissingToolCallError,
  NoRecordsError,
  StepStateError,
  WorkflowExecutorError,
} from '../errors';
import SafeAgentPort from './safe-agent-port';
import StepSummaryBuilder from './summary/step-summary-builder';

type WithPendingData = StepExecutionData & { pendingData?: object };

export default abstract class BaseStepExecutor<TStep extends StepDefinition = StepDefinition> {
  protected readonly context: ExecutionContext<TStep>;

  protected readonly agentPort: AgentPort;

  protected readonly schemaCache = new Map<string, CollectionSchema>();

  constructor(context: ExecutionContext<TStep>) {
    this.context = context;
    this.agentPort = new SafeAgentPort(context.agentPort);
  }

  async execute(): Promise<StepExecutionResult> {
    try {
      return await this.doExecute();
    } catch (error) {
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
        error: error instanceof Error ? error.message : String(error),
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

  /** Find a field by displayName first, then fallback to fieldName. */
  protected findField(schema: CollectionSchema, name: string): FieldSchema | undefined {
    return (
      schema.fields.find(f => f.displayName === name) ??
      schema.fields.find(f => f.fieldName === name)
    );
  }

  /** Builds a StepExecutionResult with the step-type-specific outcome shape. */
  protected abstract buildOutcomeResult(outcome: {
    status: BaseStepStatus;
    error?: string;
  }): StepExecutionResult;

  /**
   * Shared confirmation flow for executors that require user approval before acting.
   * Handles the find → guard → skipped → delegate pattern.
   */
  protected async handleConfirmationFlow<TExec extends WithPendingData>(
    typeDiscriminator: string,
    resolveAndExecute: (execution: TExec) => Promise<StepExecutionResult>,
  ): Promise<StepExecutionResult> {
    const stepExecutions = await this.context.runStore.getStepExecutions(this.context.runId);
    const execution = stepExecutions.find(
      (e): e is TExec =>
        (e as TExec).type === typeDiscriminator && e.stepIndex === this.context.stepIndex,
    );

    if (!execution) {
      throw new StepStateError(
        `No execution record found for step at index ${this.context.stepIndex}`,
      );
    }

    if (!execution.pendingData) {
      throw new StepStateError(`Step at index ${this.context.stepIndex} has no pending data`);
    }

    if (!this.context.userConfirmed) {
      await this.context.runStore.saveStepExecution(this.context.runId, {
        ...execution,
        executionResult: { skipped: true },
      } as StepExecutionData);

      return this.buildOutcomeResult({ status: 'success' });
    }

    return resolveAndExecute(execution);
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

  /** Fetches a collection schema from WorkflowPort, with caching. */
  protected async getCollectionSchema(collectionName: string): Promise<CollectionSchema> {
    const cached = this.schemaCache.get(collectionName);
    if (cached) return cached;

    const schema = await this.context.workflowPort.getCollectionSchema(collectionName);
    this.schemaCache.set(collectionName, schema);

    return schema;
  }

  /** Formats a record ref as "Step X - CollectionDisplayName #id". */
  protected async toRecordIdentifier(record: RecordRef): Promise<string> {
    const schema = await this.getCollectionSchema(record.collectionName);

    return `Step ${record.stepIndex} - ${schema.collectionDisplayName} #${record.recordId}`;
  }
}
