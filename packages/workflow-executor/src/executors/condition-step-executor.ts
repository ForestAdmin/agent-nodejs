import type { StepExecutionResult } from '../types/execution';
import type { ConditionStepDefinition } from '../types/step-definition';
import type { ConditionStepHistory } from '../types/step-history';

import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import BaseStepExecutor from './base-step-executor';

export const NO_GATEWAY_OPTION_MATCH = 'FOREST_WORKFLOW_NO_GATEWAY_OPTION_MATCH';

interface GatewayToolArgs {
  option: string;
  reasoning: string;
  question: string;
}

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

function buildPreviousStepsMessages(previousStepsSummary: string): SystemMessage[] {
  if (!previousStepsSummary) return [];

  return [new SystemMessage(previousStepsSummary)];
}

export default class ConditionStepExecutor extends BaseStepExecutor<
  ConditionStepDefinition,
  ConditionStepHistory
> {
  async execute(
    step: ConditionStepDefinition,
    stepHistory: ConditionStepHistory,
  ): Promise<StepExecutionResult> {
    if (!step.options.length) {
      return {
        stepHistory: {
          ...stepHistory,
          status: 'error',
          error: `Condition step "${step.id}" has no options to choose from`,
        },
      };
    }

    const previousStepsSummary = await this.summarizePreviousSteps();

    // Define a structured tool so the LLM is forced to return a valid option.
    // NO_GATEWAY_OPTION_MATCH is appended as an escape hatch when no option fits.
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

    const messages = [
      ...buildPreviousStepsMessages(previousStepsSummary),
      new SystemMessage(GATEWAY_SYSTEM_PROMPT),
      new HumanMessage(`**Question**: ${step.prompt ?? 'Choose the most appropriate option.'}`),
    ];

    let args: GatewayToolArgs;

    try {
      args = await this.invokeWithTool<GatewayToolArgs>(messages, tool);
    } catch (error: unknown) {
      return {
        stepHistory: {
          ...stepHistory,
          status: 'error',
          error: (error as Error).message,
        },
      };
    }

    const { option: selectedOption, reasoning } = args;

    // Persist reasoning even for no-match selections, for debugging and audit
    await this.context.runStore.saveStepExecution({
      type: 'condition',
      stepIndex: stepHistory.stepIndex,
      executionParams: { answer: selectedOption, reasoning },
      executionResult:
        selectedOption !== NO_GATEWAY_OPTION_MATCH ? { answer: selectedOption } : undefined,
    });

    if (selectedOption === NO_GATEWAY_OPTION_MATCH) {
      return { stepHistory: { ...stepHistory, status: 'manual-decision' } };
    }

    return {
      stepHistory: { ...stepHistory, status: 'success', selectedOption },
    };
  }
}
