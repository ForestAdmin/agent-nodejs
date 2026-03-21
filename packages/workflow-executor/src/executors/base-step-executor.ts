import type { ExecutionContext, StepExecutionResult } from '../types/execution';
import type { CollectionSchema, FieldSchema, RecordRef } from '../types/record';
import type { StepDefinition } from '../types/step-definition';
import type {
  LoadRelatedRecordStepExecutionData,
  StepExecutionData,
} from '../types/step-execution-data';
import type { BaseStepStatus, StepOutcome } from '../types/step-outcome';
import type { AIMessage, BaseMessage } from '@langchain/core/messages';

import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import {
  InvalidAIResponseError,
  MalformedToolCallError,
  MissingToolCallError,
  NoRecordsError,
  WorkflowExecutorError,
} from '../errors';

export default abstract class BaseStepExecutor<TStep extends StepDefinition = StepDefinition> {
  protected readonly context: ExecutionContext<TStep>;

  protected readonly schemaCache = new Map<string, CollectionSchema>();

  constructor(context: ExecutionContext<TStep>) {
    this.context = context;
  }

  async execute(): Promise<StepExecutionResult> {
    try {
      return await this.doExecute();
    } catch (error) {
      if (error instanceof WorkflowExecutorError) {
        return this.buildOutcomeResult({ status: 'error', error: error.userMessage });
      }

      this.context.logger.error('Unexpected error during step execution', {
        runId: this.context.runId,
        stepId: this.context.stepId,
        stepIndex: this.context.stepIndex,
        error: error instanceof Error ? error.message : String(error),
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
   * Returns a SystemMessage array summarizing previously executed steps.
   * Empty array when there is no history. Ready to spread into a messages array.
   */
  protected async buildPreviousStepsMessages(): Promise<SystemMessage[]> {
    if (!this.context.previousSteps.length) return [];

    const summary = await this.summarizePreviousSteps();

    return [new SystemMessage(summary)];
  }

  /**
   * Builds a text summary of previously executed steps for AI prompts.
   * Correlates history entries (step + stepOutcome pairs) with execution data
   * from the RunStore (matched by stepOutcome.stepIndex).
   * When no execution data is available, falls back to StepOutcome details.
   */
  private async summarizePreviousSteps(): Promise<string> {
    const allStepExecutions = await this.context.runStore.getStepExecutions(this.context.runId);

    return this.context.previousSteps
      .map(({ stepDefinition, stepOutcome }) => {
        const execution = allStepExecutions.find(e => e.stepIndex === stepOutcome.stepIndex);

        return this.buildStepSummary(stepDefinition, stepOutcome, execution);
      })
      .join('\n\n');
  }

  private buildStepSummary(
    step: StepDefinition,
    stepOutcome: StepOutcome,
    execution: StepExecutionData | undefined,
  ): string {
    const prompt = step.prompt ?? '(no prompt)';
    const header = `Step "${stepOutcome.stepId}" (index ${stepOutcome.stepIndex}):`;
    const lines = [header, `  Prompt: ${prompt}`];

    if (execution !== undefined) {
      if (execution.executionParams !== undefined) {
        lines.push(`  Input: ${JSON.stringify(execution.executionParams)}`);
      } else if ('pendingData' in execution && execution.pendingData !== undefined) {
        lines.push(`  Pending: ${JSON.stringify(execution.pendingData)}`);
      }

      if (execution.executionResult) {
        lines.push(`  Output: ${JSON.stringify(execution.executionResult)}`);
      }
    } else {
      const { stepId, stepIndex, type, ...historyDetails } = stepOutcome;
      lines.push(`  History: ${JSON.stringify(historyDetails)}`);
    }

    return lines.join('\n');
  }

  /**
   * Binds a single tool to the model, invokes it, and extracts the tool call args.
   * Throws MalformedToolCallError or MissingToolCallError on invalid AI responses.
   */
  protected async invokeWithTool<T = Record<string, unknown>>(
    messages: BaseMessage[],
    tool: DynamicStructuredTool,
  ): Promise<T> {
    const modelWithTool = this.context.model.bindTools([tool], { tool_choice: 'any' });
    const response = await modelWithTool.invoke(messages);

    return this.extractToolCallArgs<T>(response);
  }

  /**
   * Extracts the first tool call's args from an AI response.
   * Throws if the AI returned a malformed tool call (invalid_tool_calls) or no tool call at all.
   */
  private extractToolCallArgs<T = Record<string, unknown>>(response: AIMessage): T {
    const toolCall = response.tool_calls?.[0];

    if (toolCall !== undefined) {
      if (toolCall.args !== undefined && toolCall.args !== null) {
        return toolCall.args as T;
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

  /** Returns baseRecordRef + any related records loaded by previous steps. */
  protected async getAvailableRecordRefs(): Promise<RecordRef[]> {
    const stepExecutions = await this.context.runStore.getStepExecutions(this.context.runId);
    const relatedRecords = stepExecutions
      .filter(
        (e): e is LoadRelatedRecordStepExecutionData & { record: RecordRef } =>
          e.type === 'load-related-record' && e.record !== undefined,
      )
      .map(e => e.record);

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
