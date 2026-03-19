import type { StepExecutionResult } from '../types/execution';
import type { ConditionStepDefinition } from '../types/step-definition';

import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import BaseStepExecutor from './base-step-executor';

interface GatewayToolArgs {
  option: string | null;
  reasoning: string;
  question: string;
}

const GATEWAY_SYSTEM_PROMPT = `You are an AI agent selecting the correct option for a workflow gateway decision.

**Task**: Analyze the question and available options, then select the option that DIRECTLY answers the question. Options must be literal answers, not interpretations.

**Critical Rule**: Options must semantically match possible answers to the question.
- Question "Does X contain Y?" expects options like "yes"/"no", NOT colors or unrelated values
- Question "What is the status?" expects options like "active"/"inactive", NOT arbitrary words
- If options don't match expected answer types, select null

**NEVER invent mappings** between options and answers (e.g., never assume "purple"="no" or "red"="yes")

**When to select null**:
- Options are semantically unrelated to the question type (colors for yes/no questions)
- None of the options literally match the expected answer
- The question is ambiguous or lacks necessary context
- You are less than 80% confident in any option

**Reasoning format**:
- State which option you selected and why
- If selecting null: explain why options don't match the question
- Do not refer to yourself as "I" in the response, use a passive formulation instead.`;

export default class ConditionStepExecutor extends BaseStepExecutor<ConditionStepDefinition> {
  async execute(): Promise<StepExecutionResult> {
    const { stepDefinition: step } = this.context;

    const tool = new DynamicStructuredTool({
      name: 'choose-gateway-option',
      description:
        'Select the option that answers the question. ' +
        'Use null if no option matches or you are uncertain. ' +
        'Explain your reasoning.',
      schema: z.object({
        reasoning: z.string().describe('The reasoning behind the choice'),
        question: z.string().describe('The question to answer by choosing an option'),
        option: z
          .enum(step.options)
          .nullable()
          .describe('The chosen option, or null if no option clearly answers the question.'),
      }),
      func: undefined,
    });

    const messages = [
      ...(await this.buildPreviousStepsMessages()),
      new SystemMessage(GATEWAY_SYSTEM_PROMPT),
      new HumanMessage(`**Question**: ${step.prompt ?? 'Choose the most appropriate option.'}`),
    ];

    let args: GatewayToolArgs;

    try {
      args = await this.invokeWithTool<GatewayToolArgs>(messages, tool);
    } catch (error: unknown) {
      return {
        stepOutcome: {
          type: 'condition',
          stepId: this.context.stepId,
          stepIndex: this.context.stepIndex,
          status: 'error',
          error: (error as Error).message,
        },
      };
    }

    const { option: selectedOption, reasoning } = args;

    await this.context.runStore.saveStepExecution({
      type: 'condition',
      stepIndex: this.context.stepIndex,
      executionParams: { answer: selectedOption, reasoning },
      executionResult: selectedOption ? { answer: selectedOption } : undefined,
    });

    if (!selectedOption) {
      return {
        stepOutcome: {
          type: 'condition',
          stepId: this.context.stepId,
          stepIndex: this.context.stepIndex,
          status: 'manual-decision',
        },
      };
    }

    return {
      stepOutcome: {
        type: 'condition',
        stepId: this.context.stepId,
        stepIndex: this.context.stepIndex,
        status: 'success',
        selectedOption,
      },
    };
  }
}
