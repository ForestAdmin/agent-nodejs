import type { ExecutionContext, StepExecutionResult } from '../types/execution';
import type { StepDefinition } from '../types/step-definition';
import type { StepExecutionData } from '../types/step-execution-data';
import type { StepHistory } from '../types/step-history';
import type { AIMessage } from '@langchain/core/messages';

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
   * Builds a text summary of previously executed steps for AI prompts.
   * Correlates history entries (step + stepHistory pairs) with executionParams
   * from the RunStore (matched by stepHistory.stepIndex).
   * When no executionParams is available, falls back to StepHistory details.
   */
  protected async summarizePreviousSteps(): Promise<string> {
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
   * Extracts the first tool call's args from an AI response.
   * Callers bind a single tool with tool_choice='any', so only the first tool call is extracted.
   * Throws if the AI returned a malformed tool call (invalid_tool_calls) or no tool call at all.
   */
  protected extractToolCallArgs<T = Record<string, unknown>>(response: AIMessage): T {
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
