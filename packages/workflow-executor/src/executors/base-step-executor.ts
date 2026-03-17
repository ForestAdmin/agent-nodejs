import type { ExecutionContext, StepExecutionResult } from '../types/execution';
import type { StepDefinition } from '../types/step-definition';
import type { StepHistory } from '../types/step-history';
import type { AIMessage } from '@langchain/core/messages';

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
   * Correlates step definitions from context.history with execution results
   * from the RunStore (matched by stepIndex). Steps without an executionResult are omitted.
   */
  protected async buildAdditionalContext(): Promise<string> {
    const allStepExecutions = await this.context.runStore.getStepExecutions();

    return this.context.history
      .map(({ step, stepHistory }) => {
        const execution = allStepExecutions.find(e => e.stepIndex === stepHistory.stepIndex);
        if (!execution?.executionResult) return null;

        const prompt = step.prompt ?? '(no prompt)';
        const result = JSON.stringify(execution.executionResult);

        return `Step "${step.id}" (index ${stepHistory.stepIndex}):\n  Prompt: ${prompt}\n  Result: ${result}`;
      })
      .filter(Boolean)
      .join('\n\n');
  }

  /**
   * Extracts the first tool call's args from an AI response.
   * Callers bind a single tool with tool_choice='any', so at most one call is expected.
   * Throws if the AI returned a malformed tool call (invalid_tool_calls).
   * Returns null if no tool call is present at all.
   */
  protected extractToolCallArgs(response: AIMessage): Record<string, unknown> | null {
    const toolCall = response.tool_calls?.[0];
    if (toolCall?.args) return toolCall.args as Record<string, unknown>;

    const invalidCall = response.invalid_tool_calls?.[0];

    if (invalidCall) {
      throw new Error(
        `AI returned a malformed tool call for "${invalidCall.name ?? 'unknown'}": ${
          invalidCall.error ?? 'no details available'
        }`,
      );
    }

    return null;
  }
}
