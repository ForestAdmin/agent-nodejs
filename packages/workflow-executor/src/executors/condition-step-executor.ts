import type { StepExecutionResult } from '../types/execution-context';
import type {
  ConditionEvaluation,
  ConditionNotLoadedReason,
  ConditionStepExecutionData,
  PausedConditionExecutionParams,
  StepExecutionData,
} from '../types/step-execution-data';
import type {
  ConditionStepDefinition,
  DeterministicCondition,
  DeterministicConditionStep,
} from '../types/validated/step-definition';
import type { ConditionStepOutcome, ErrorKind } from '../types/validated/step-outcome';

import { DynamicStructuredTool, HumanMessage, SystemMessage } from '@forestadmin/ai-proxy';
import { z } from 'zod';

import {
  InvalidStepDefinitionError,
  MalformedToolCallError,
  MissingConditionQuantifierError,
  StepStateError,
} from '../errors';
import BaseStepExecutor from './base-step-executor';
import evaluateOperator, { type Clock } from './deterministic-condition-evaluator';
import patchBodySchemas from '../http/pending-data-validators';
import { serializeRecordId } from '../record-id';
import { isPerRecordExecution } from '../types/step-execution-data';
import {
  StepExecutionMode,
  StepType,
  isDeterministicConditionStep,
} from '../types/validated/step-definition';

interface GatewayToolArgs {
  option: string | null;
  reasoning: string;
  question: string;
}

interface GatewayDecision {
  selectedOption: string | null;
  reasoning: string;
}

interface ConditionResult {
  met: boolean | null;
  reason?: ConditionNotLoadedReason;
  records?: { matched: number; evaluated: number };
  // Serialized source record ids of the records it could not decide on.
  unchecked?: string[];
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
    status: ConditionStepOutcome['status'];
    error?: string;
    errorKind?: ErrorKind;
    errorSourceStepIndex?: number;
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

    if (isDeterministicConditionStep(step)) {
      const stepExecutions = await this.context.runStore.getStepExecutions(this.context.runId);
      const paused = this.findPausedDecision(stepExecutions);
      if (paused) return this.completePausedDecision(step, paused, incomingPendingData);

      // The config wins over an explicit human action, so say so: a mixed-version fleet can pause
      // the step on an args-blind instance, and the user's click would otherwise vanish untraced.
      if (incomingPendingData !== undefined) {
        this.context.logger(
          'Warn',
          'Ignoring a submitted option: this decision is evaluated from its conditions',
          this.logCtx,
        );
      }

      return this.evaluateDeterministically(step, stepExecutions);
    }

    // Manual mode: the user picks the option from the frontend. Wait for their input
    // without ever calling the AI.
    const isManual = step.executionType === StepExecutionMode.Manual;

    if (isManual && incomingPendingData === undefined) {
      return this.buildOutcomeResult({ status: 'awaiting-input' });
    }

    const { selectedOption, reasoning } =
      incomingPendingData !== undefined
        ? this.readUserChoice(step, incomingPendingData)
        : await this.askAi(step);

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

  // A decision paused on records it could not check, waiting for the operator's branch.
  private findPausedDecision(
    stepExecutions: StepExecutionData[],
  ):
    | (ConditionStepExecutionData & { executionParams: PausedConditionExecutionParams })
    | undefined {
    const own = stepExecutions.find(e => e.stepIndex === this.context.stepIndex);
    if (own?.type !== 'condition' || own.executionResult !== undefined) return undefined;
    if (!('unchecked' in own.executionParams)) return undefined;

    return own as ConditionStepExecutionData & { executionParams: PausedConditionExecutionParams };
  }

  private async completePausedDecision(
    step: DeterministicConditionStep,
    paused: ConditionStepExecutionData & { executionParams: PausedConditionExecutionParams },
    incomingPendingData: unknown,
  ): Promise<StepExecutionResult> {
    if (incomingPendingData === undefined) {
      return this.buildOutcomeResult({ status: 'awaiting-input' });
    }

    const { selectedOption } = this.readUserChoice(step, incomingPendingData);

    await this.context.runStore.saveStepExecution(this.context.runId, {
      type: 'condition',
      stepIndex: this.context.stepIndex,
      executionParams: {
        ...paused.executionParams,
        selectedOption: selectedOption as string,
        usedFallback: false,
        selectedBy: 'operator',
      },
      executionResult: { answer: selectedOption as string },
    });

    return this.buildOutcomeResult({ status: 'success', selectedOption: selectedOption as string });
  }

  private async evaluateDeterministically(
    step: DeterministicConditionStep,
    stepExecutions: StepExecutionData[],
  ): Promise<StepExecutionResult> {
    const { optionConditions, fallbackOption } = step.preRecordedArgs;
    // One clock per step, so "today" cannot flip between the first and the last condition.
    const clock: Clock = { now: new Date(), timezone: this.context.timezone };
    const unchecked = new Set<string>();

    let matchedOption: string | undefined;
    const evaluations = optionConditions.map(({ option, aggregator, conditions }) => {
      if (matchedOption !== undefined) {
        return { option, outcome: 'not-evaluated' } satisfies ConditionEvaluation;
      }

      const results = conditions.map((condition, index) => {
        const result = this.evaluateCondition(option, condition, stepExecutions, clock);
        result.unchecked?.forEach(recordId => unchecked.add(recordId));

        return {
          index,
          met: result.met,
          ...(result.reason && { reason: result.reason }),
          ...(result.records && { records: result.records }),
        };
      });
      const matched =
        aggregator === 'or'
          ? results.some(result => result.met === true)
          : results.every(result => result.met === true);
      if (matched) matchedOption = option;

      return {
        option,
        outcome: matched ? 'matched' : 'not-matched',
        conditions: results,
      } satisfies ConditionEvaluation;
    });

    // A record without a value would make any, every and none each say something untrue, so the
    // decision takes no branch: the operator picks one, knowing which records went unchecked.
    if (unchecked.size > 0) {
      await this.context.runStore.saveStepExecution(this.context.runId, {
        type: 'condition',
        stepIndex: this.context.stepIndex,
        executionParams: {
          evaluations,
          evaluatedAt: clock.now.toISOString(),
          timezone: clock.timezone,
          unchecked: [...unchecked],
        },
      });

      return this.buildOutcomeResult({ status: 'awaiting-input' });
    }

    const usedFallback = matchedOption === undefined;
    const selectedOption = matchedOption ?? fallbackOption;

    // optionConditions and options come from two different server-side derivations; an option the
    // orchestrator cannot route must fail here, not silently succeed and break the run downstream.
    if (!step.options.includes(selectedOption)) {
      const allowed = step.options.join(', ');
      throw new InvalidStepDefinitionError(
        `deterministic option "${selectedOption}" is not a valid choice (expected one of: ${allowed})`,
      );
    }

    await this.context.runStore.saveStepExecution(this.context.runId, {
      type: 'condition',
      stepIndex: this.context.stepIndex,
      executionParams: {
        evaluations,
        selectedOption,
        usedFallback,
        evaluatedAt: clock.now.toISOString(),
        timezone: clock.timezone,
      },
      executionResult: { answer: selectedOption },
    });

    return this.buildOutcomeResult({ status: 'success', selectedOption });
  }

  private evaluateCondition(
    option: string,
    condition: DeterministicCondition,
    stepExecutions: StepExecutionData[],
    clock: Clock,
  ): ConditionResult {
    const resolved = this.resolveConditionValue(condition, stepExecutions);

    if (resolved.found === 'per-record') {
      if (!condition.quantifier) {
        throw new MissingConditionQuantifierError(option, condition.fieldName);
      }

      return this.evaluateOverRecords(condition, resolved.values, clock);
    }

    // The reason is what keeps the fallback from passing for a decision the data took: the run view
    // words it instead of showing a bare cross. Returning here also means "never read" is not
    // "read and empty", so present and blank get no answer out of it either.
    if (resolved.found === false) {
      this.context.logger('Warn', 'Condition value could not be resolved, counting it as not met', {
        ...this.logCtx,
        sourceStepId: condition.sourceStepId,
        fieldName: condition.fieldName,
        reason: resolved.reason,
      });

      return { met: null, reason: resolved.reason };
    }

    const met = evaluateOperator(condition.operator, resolved.value, condition.value, clock);
    if (!condition.quantifier) return { met };

    const records = { matched: met === true ? 1 : 0, evaluated: met === null ? 0 : 1 };

    // "none" holds when the one record does not match; an undecided value stays undecided.
    return { met: condition.quantifier === 'none' && met !== null ? !met : met, records };
  }

  // A record whose value decides nothing (not read, or read empty for a comparison) is unchecked.
  private evaluateOverRecords(
    condition: DeterministicCondition,
    values: Array<{ recordId: string; found: boolean; value?: unknown }>,
    clock: Clock,
  ): ConditionResult {
    const unchecked: string[] = [];
    let matched = 0;
    let evaluated = 0;

    values.forEach(({ recordId, found, value }) => {
      const met = found
        ? evaluateOperator(condition.operator, value, condition.value, clock)
        : null;

      if (met === null) {
        unchecked.push(recordId);
      } else {
        evaluated += 1;
        if (met) matched += 1;
      }
    });

    const records = { matched, evaluated };
    if (unchecked.length > 0) return { met: null, records, unchecked };
    // Over no record at all, "every" and "none" would hold vacuously: nothing was checked.
    if (evaluated === 0) return { met: false, records };

    const met = {
      any: matched > 0,
      every: matched === evaluated,
      none: matched === 0,
    }[condition.quantifier as NonNullable<DeterministicCondition['quantifier']>];

    return { met, records };
  }

  // Same live-path + most-recent-occurrence resolution as resolveSourceRecordRef: previousSteps
  // are already restricted to the live path, and in a loop the same step id repeats.
  private resolveConditionValue(
    condition: DeterministicCondition,
    stepExecutions: StepExecutionData[],
  ):
    | { found: true; value: unknown }
    | { found: 'per-record'; values: Array<{ recordId: string; found: boolean; value?: unknown }> }
    | { found: false; reason: ConditionNotLoadedReason } {
    const matches = this.context.previousSteps.filter(
      step =>
        step.stepDefinition.type === StepType.ReadRecord &&
        step.stepOutcome.stepId === condition.sourceStepId,
    );
    const sourceStep = matches[matches.length - 1];
    if (!sourceStep) return { found: false, reason: 'source-step-not-reached' };

    const execution = this.resolveStepExecution(sourceStep, stepExecutions);

    if (isPerRecordExecution(execution)) {
      return {
        found: 'per-record',
        values: execution.iterations.map(iteration => {
          const result = iteration.executionResult as {
            fields?: Array<{ name: string; value?: unknown }>;
          };
          const field = result?.fields?.find(f => f.name === condition.fieldName);
          const recordId = serializeRecordId(iteration.sourceRecordRef.recordId);

          return field && 'value' in field
            ? { recordId, found: true, value: field.value }
            : { recordId, found: false };
        }),
      };
    }

    if (execution?.type !== 'read-record') return { found: false, reason: 'field-not-loaded' };

    const field = execution.executionResult.fields.find(f => f.name === condition.fieldName);
    if (!field || !('value' in field)) return { found: false, reason: 'field-not-loaded' };

    return { found: true, value: field.value };
  }

  private readUserChoice(
    step: ConditionStepDefinition,
    incomingPendingData: unknown,
  ): GatewayDecision {
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

    return { selectedOption, reasoning: 'Selected by user' };
  }

  private async askAi(step: ConditionStepDefinition): Promise<GatewayDecision> {
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

    // The enum only steers the model: tool-call args are never parsed against the schema.
    if (args.option !== null && !step.options.includes(args.option)) {
      throw new MalformedToolCallError(
        tool.name,
        `option ${JSON.stringify(args.option)} is not one of the step's options`,
      );
    }

    return { selectedOption: args.option, reasoning: args.reasoning };
  }
}
