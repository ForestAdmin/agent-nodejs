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

  /** Builds a text summary of previous steps for AI prompts. */
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

  /** Extracts the single tool call args from an AI response (ai-proxy guarantees 1 tool call). */
  protected extractToolCallArgs(response: AIMessage): Record<string, unknown> | null {
    const toolCall = response.tool_calls?.[0];

    return toolCall ? (toolCall.args as Record<string, unknown>) : null;
  }
}
