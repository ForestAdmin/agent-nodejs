import type { ExecutionContext, StepExecutionResult } from '../types/execution';
import type { ConditionStepDefinition } from '../types/step-definition';
import type { ConditionStepHistory } from '../types/step-history';

import { SystemMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import buildAdditionalContext from '../utils/build-additional-context';
import extractToolCallArgs from '../utils/extract-tool-call-args';

export const NO_GATEWAY_OPTION_MATCH = 'FOREST_WORKFLOW_NO_GATEWAY_OPTION_MATCH';

export default async function executeConditionStep(
  step: ConditionStepDefinition,
  stepHistory: ConditionStepHistory,
  context: ExecutionContext,
): Promise<StepExecutionResult> {
  if (!step.options.length) {
    stepHistory.status = 'error';
    stepHistory.error = `Condition step "${step.id}" has no options to choose from`;

    return { stepHistory };
  }

  // Build additional context from previous steps
  const allStepExecutions = await context.runStore.getStepExecutions();
  const additionalContext = buildAdditionalContext(context.history, allStepExecutions);

  // Build tool
  const options: [string, ...string[]] = [
    step.options[0],
    ...step.options.slice(1),
    NO_GATEWAY_OPTION_MATCH,
  ];
  const tool = new DynamicStructuredTool({
    name: 'choose-gateway-option',
    description:
      'Choose the most appropriate option based on the conversation context. ' +
      `Use "${NO_GATEWAY_OPTION_MATCH}" only if none of the other options apply.`,
    schema: z.object({
      option: z.enum(options).describe('The selected option'),
      question: z.string().describe('The question this option answers'),
      reasoning: z.string().describe('Why this option was chosen'),
    }),
    func: async input => JSON.stringify(input),
  });

  // Call AI
  const systemPrompt = [
    step.prompt ?? 'Choose the most appropriate option.',
    additionalContext ? `\nContext from previous steps:\n${additionalContext}` : '',
  ].join('');

  const modelWithTool = context.model.bindTools([tool], { tool_choice: 'any' });
  const response = await modelWithTool.invoke([new SystemMessage(systemPrompt)]);

  // Extract + validate
  const args = extractToolCallArgs(response);

  if (!args) {
    stepHistory.status = 'error';
    stepHistory.error = 'AI did not return a tool call';

    return { stepHistory };
  }

  const selectedOption = args.option as string;
  const reasoning = args.reasoning as string;

  // Always persist the AI's reasoning
  await context.runStore.saveStepExecution({
    type: 'condition',
    stepIndex: stepHistory.stepIndex,
    executionParams: { answer: selectedOption, reasoning },
    executionResult: step.options.includes(selectedOption) ? { answer: selectedOption } : undefined,
  });

  stepHistory.reasoning = reasoning;

  if (selectedOption === NO_GATEWAY_OPTION_MATCH) {
    stepHistory.status = 'manual-decision';

    return { stepHistory };
  }

  if (!step.options.includes(selectedOption)) {
    stepHistory.status = 'error';
    stepHistory.error = `AI selected "${selectedOption}" which is not among valid options: ${JSON.stringify(
      step.options,
    )}`;

    return { stepHistory };
  }

  stepHistory.selectedOption = selectedOption;
  stepHistory.status = 'success';

  return { stepHistory };
}
