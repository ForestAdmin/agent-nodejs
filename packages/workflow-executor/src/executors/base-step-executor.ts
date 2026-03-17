import type { ExecutionContext, StepExecutionResult } from '../types/execution';
import type { StepDefinition } from '../types/step-definition';
import type { StepHistory } from '../types/step-history';
import type { AIMessage } from '@langchain/core/messages';

import buildAdditionalContextFn from '../utils/build-additional-context';
import extractToolCallArgsFn from '../utils/extract-tool-call-args';

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

    return buildAdditionalContextFn(this.context.history, allStepExecutions);
  }

  /** Extracts the single tool call args from an AI response (ai-proxy guarantees 1 tool call). */
  protected extractToolCallArgs(response: AIMessage): Record<string, unknown> | null {
    return extractToolCallArgsFn(response);
  }
}
