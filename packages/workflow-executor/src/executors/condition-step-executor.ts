import type { StepExecutionResult } from '../types/execution-context';
import type { ConditionStepDefinition } from '../types/validated/step-definition';
import type { BaseStepStatus } from '../types/validated/step-outcome';

import { DynamicStructuredTool, HumanMessage, SystemMessage } from '@forestadmin/ai-proxy';
import { z } from 'zod';

import { StepStateError } from '../errors';
import BaseStepExecutor from './base-step-executor';
import patchBodySchemas from '../http/pending-data-validators';

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
  protected buildOutcomeResult(outcome: {
    status: BaseStepStatus;
    error?: string;
    selectedOption?: string;
  }): StepExecutionResult {
    return {
      stepOutcome: {
        type: 'condition',
        stepId: this.context.stepId,
        stepIndex: this.context.stepIndex,
        ...outcome,
      },
    };
  }

  protected async doExecute(): Promise<StepExecutionResult> {
    const { stepDefinition: step, incomingPendingData } = this.context;

    if (incomingPendingData !== undefined) {
      return this.applyUserOverride(step, incomingPendingData);
    }

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
      this.buildContextMessage(),
      ...(await this.buildPreviousStepsMessages()),
      new SystemMessage(GATEWAY_SYSTEM_PROMPT),
      new HumanMessage(`**Question**: ${step.prompt ?? 'Choose the most appropriate option.'}`),
    ];

    const args = await this.invokeWithTool<GatewayToolArgs>(messages, tool);
    const { option: selectedOption, reasoning } = args;

    await this.context.runStore.saveStepExecution(this.context.runId, {
      type: 'condition',
      stepIndex: this.context.stepIndex,
      executionParams: { answer: selectedOption, reasoning },
      executionResult: selectedOption ? { answer: selectedOption } : undefined,
    });

    if (!selectedOption) {
      return this.buildOutcomeResult({
        status: 'error',
        error: "The AI couldn't decide. Try rephrasing the step's prompt.",
      });
    }

    return this.buildOutcomeResult({ status: 'success', selectedOption });
  }

  private async applyUserOverride(
    step: ConditionStepDefinition,
    incomingPendingData: unknown,
  ): Promise<StepExecutionResult> {
    const parsed = patchBodySchemas.condition!.safeParse(incomingPendingData);

    if (!parsed.success) {
      throw new StepStateError(
        `Invalid condition input: ${parsed.error.issues.map(i => i.message).join(', ')}`,
      );
    }

    const { selectedOption } = parsed.data as { selectedOption: string };

    if (!step.options.includes(selectedOption)) {
      const allowed = step.options.join(', ');
      throw new StepStateError(
        `Option "${selectedOption}" is not a valid choice (expected one of: ${allowed})`,
      );
    }

    await this.context.runStore.saveStepExecution(this.context.runId, {
      type: 'condition',
      stepIndex: this.context.stepIndex,
      executionParams: { answer: selectedOption, reasoning: 'User override via trigger' },
      executionResult: { answer: selectedOption },
    });

    return this.buildOutcomeResult({ status: 'success', selectedOption });
  }
}
