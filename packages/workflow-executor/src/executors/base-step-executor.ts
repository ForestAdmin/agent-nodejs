import type { ExecutionContext, StepExecutionResult } from '../types/execution';
import type { StepDefinition } from '../types/step-definition';
import type { StepExecutionData } from '../types/step-execution-data';
import type { StepHistory } from '../types/step-history';
import type { AIMessage, BaseMessage } from '@langchain/core/messages';
import type { DynamicStructuredTool } from '@langchain/core/tools';

import { SystemMessage } from '@langchain/core/messages';

import { MalformedToolCallError, MissingToolCallError } from '../errors';

export default abstract class BaseStepExecutor<
  TStep extends StepDefinition = StepDefinition,
  THistory extends StepHistory = StepHistory,
> {
  protected readonly context: ExecutionContext;

  constructor(context: ExecutionContext) {
    this.context = context;
  }

  abstract execute(step: TStep, stepHistory: THistory): Promise<StepExecutionResult>;

  /**
   * Returns a SystemMessage array summarizing previously executed steps.
   * Empty array when there is no history. Ready to spread into a messages array.
   */
  protected async buildPreviousStepsMessages(): Promise<SystemMessage[]> {
    if (!this.context.history.length) return [];

    const summary = await this.summarizePreviousSteps();

    return [new SystemMessage(summary)];
  }

  /**
   * Builds a text summary of previously executed steps for AI prompts.
   * Correlates history entries (step + stepHistory pairs) with executionParams
   * from the RunStore (matched by stepHistory.stepIndex).
   * When no executionParams is available, falls back to StepHistory details.
   */
  private async summarizePreviousSteps(): Promise<string> {
    const allStepExecutions = await this.context.runStore.getStepExecutions();

    return this.context.history
      .map(({ step, stepHistory }) => {
        const execution = allStepExecutions.find(e => e.stepIndex === stepHistory.stepIndex);

        return this.buildStepSummary(step, stepHistory, execution);
      })
      .join('\n\n');
  }

  private buildStepSummary(
    step: StepDefinition,
    stepHistory: StepHistory,
    execution: StepExecutionData | undefined,
  ): string {
    const prompt = step.prompt ?? '(no prompt)';
    const header = `Step "${step.id}" (index ${stepHistory.stepIndex}):`;
    const lines = [header, `  Prompt: ${prompt}`];

    if (execution?.executionParams) {
      lines.push(`  Result: ${JSON.stringify(execution.executionParams)}`);
    } else {
      const { stepId, stepIndex, type, ...historyDetails } = stepHistory;
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
    if (toolCall?.args) return toolCall.args as T;

    const invalidCall = response.invalid_tool_calls?.[0];

    if (invalidCall) {
      throw new MalformedToolCallError(
        invalidCall.name ?? 'unknown',
        invalidCall.error ?? 'no details available',
      );
    }

    throw new MissingToolCallError();
  }
}
