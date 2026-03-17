import type { ExecutionContext, StepExecutionResult } from '../types/execution';
import type { ConditionStepDefinition } from '../types/step-definition';
import type { ConditionStepHistory } from '../types/step-history';

import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import buildAdditionalContext from '../utils/build-additional-context';
import extractToolCallArgs from '../utils/extract-tool-call-args';

export const NO_GATEWAY_OPTION_MATCH = 'FOREST_WORKFLOW_NO_GATEWAY_OPTION_MATCH';

const GATEWAY_SYSTEM_PROMPT = `You are an AI agent selecting the correct option for a workflow gateway decision.

**Task**: Analyze the question and available options, then select the option that DIRECTLY answers the question. Options must be literal answers, not interpretations.

**Critical Rule**: Options must semantically match possible answers to the question.
- Question "Does X contain Y?" expects options like "yes"/"no", NOT colors or unrelated values
- Question "What is the status?" expects options like "active"/"inactive", NOT arbitrary words
- If options don't match expected answer types, select ${NO_GATEWAY_OPTION_MATCH}

**NEVER invent mappings** between options and answers (e.g., never assume "purple"="no" or "red"="yes")

**When to select ${NO_GATEWAY_OPTION_MATCH}**:
- Options are semantically unrelated to the question type (colors for yes/no questions)
- None of the options literally match the expected answer
- The question is ambiguous or lacks necessary context
- You are less than 80% confident in any option

**Reasoning format**:
- State which option you selected and why
- If selecting ${NO_GATEWAY_OPTION_MATCH}: explain why options don't match the question
- Do not refer to yourself as "I" in the response, use a passive formulation instead.
- NEVER mention "${NO_GATEWAY_OPTION_MATCH}" in reasoning, say "no matching option" instead.`;

function buildAdditionalContextMessages(additionalContext: string): SystemMessage[] {
  if (!additionalContext) return [];

  return [new SystemMessage(additionalContext)];
}

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
      `Select the option that answers the question. ` +
      `Use ${NO_GATEWAY_OPTION_MATCH} if no option matches or you are uncertain. ` +
      `Explain your reasoning.`,
    schema: z.object({
      reasoning: z.string().describe('The reasoning behind the choice'),
      question: z.string().describe('The question to answer by choosing an option'),
      option: z
        .enum(options)
        .describe(
          `The chosen option. Use ${NO_GATEWAY_OPTION_MATCH} if no option clearly answers the question.`,
        ),
    }),
    func: async input => JSON.stringify(input),
  });

  // Build messages: additional context + system prompt + user question
  const messages = [
    ...buildAdditionalContextMessages(additionalContext),
    new SystemMessage(GATEWAY_SYSTEM_PROMPT),
    new HumanMessage(`**Question**: ${step.prompt ?? 'Choose the most appropriate option.'}`),
  ];

  const modelWithTool = context.model.bindTools([tool], { tool_choice: 'any' });
  const response = await modelWithTool.invoke(messages);

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
