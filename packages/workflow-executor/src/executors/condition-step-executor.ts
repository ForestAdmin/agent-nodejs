import type { StepExecutionResult } from '../types/execution-context';
import type {
  ConditionEvaluation,
  ConditionNotLoadedReason,
  ConditionResult,
  ConditionStepExecutionData,
  PausedConditionExecutionParams,
  StepExecutionData,
} from '../types/step-execution-data';
import type { RecordRef } from '../types/validated/collection';
import type {
  ConditionStepDefinition,
  DeterministicCondition,
  DeterministicConditionGroup,
  DeterministicConditionStep,
} from '../types/validated/step-definition';
import type { ConditionStepOutcome, ErrorKind } from '../types/validated/step-outcome';

import { DynamicStructuredTool, HumanMessage, SystemMessage } from '@forestadmin/ai-proxy';
import { z } from 'zod';

import {
  CollectionAccessDeniedError,
  InvalidStepDefinitionError,
  MalformedToolCallError,
  MissingConditionQuantifierError,
  PerRecordSubWorkflowEndConditionError,
  StepStateError,
} from '../errors';
import BaseStepExecutor, { findLatestStepInFrame } from './base-step-executor';
import evaluateOperator, { type Clock } from './deterministic-condition-evaluator';
import {
  findPinnedLoadStep,
  loadedRecordsOf,
  resolveWorkflowStartRecordRef,
} from './pinned-record';
import followRelationPath from './relation-path';
import patchBodySchemas from '../http/pending-data-validators';
import { serializeRecordId } from '../record-id';
import { isPerRecordExecution } from '../types/step-execution-data';
import {
  StepExecutionMode,
  StepType,
  WORKFLOW_START_STEP_ID,
  isDeterministicConditionGroup,
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

interface EvaluatedCondition {
  met: boolean | null;
  reason?: ConditionNotLoadedReason;
  records?: { matched: number; evaluated: number; unchecked?: string[] };
  // Serialized source record ids of the records without a value, set only when one of them could
  // still change the answer: the condition is then undecided rather than not met.
  unchecked?: string[];
}

// Three-valued: null is a condition a record without a value could still turn either way.
function combine(aggregator: 'and' | 'or', verdicts: Array<boolean | null>): boolean | null {
  const settling = aggregator === 'or';
  if (verdicts.includes(settling)) return settling;

  return verdicts.includes(null) ? null : !settling;
}

// What a record source holds: null for a record not found, keyed by the record's serialized id when
// its step loaded several.
type RecordSourceRead =
  | { kind: 'not-reached' }
  | { kind: 'single'; values: Record<string, unknown> | null }
  | {
      kind: 'per-record';
      records: Array<{ recordId: string; values: Record<string, unknown> | null }>;
    };

type RecordSourceReader = (condition: DeterministicCondition) => Promise<RecordSourceRead>;

interface EvaluationScope {
  stepExecutions: StepExecutionData[];
  clock: Clock;
  readRecordSource: RecordSourceReader;
}

const recordSourceKey = ({ sourceStepId, relationPath }: DeterministicCondition): string =>
  JSON.stringify([sourceStepId, relationPath ?? []]);

function collectRecordConditions(
  nodes: DeterministicConditionGroup['conditions'],
): DeterministicCondition[] {
  return nodes.flatMap(node => {
    if (isDeterministicConditionGroup(node)) return collectRecordConditions(node.conditions);

    return node.sourceType === 'record' ? [node] : [];
  });
}

type ResolvedConditionValue =
  | { found: true; value: unknown }
  | { found: 'per-record'; values: Array<{ recordId: string; found: boolean; value?: unknown }> }
  | { found: false; reason: ConditionNotLoadedReason };

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
      const operatorChoice = this.findOperatorChoice(stepExecutions);

      if (operatorChoice !== undefined) {
        return this.buildOutcomeResult({ status: 'success', selectedOption: operatorChoice });
      }

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

  // The branch an operator picked stands: a dispatch repeating the step replays it.
  private findOperatorChoice(stepExecutions: StepExecutionData[]): string | undefined {
    const own = stepExecutions.find(e => e.stepIndex === this.context.stepIndex);
    if (own?.type !== 'condition' || own.executionResult === undefined) return undefined;

    const params = own.executionParams as { selectedBy?: string };

    return params.selectedBy === 'operator' ? own.executionResult.answer : undefined;
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
    const scope: EvaluationScope = {
      stepExecutions,
      clock,
      readRecordSource: this.createRecordSourceReader(step, stepExecutions),
    };
    const unchecked = new Set<string>();

    let matchedOption: string | undefined;
    const evaluations: ConditionEvaluation[] = [];

    for (const { option, aggregator, conditions } of optionConditions) {
      // Options are taken first match first, so none is taken past one left undecided.
      if (matchedOption !== undefined || unchecked.size > 0) {
        evaluations.push({ option, outcome: 'not-evaluated' });
        // eslint-disable-next-line no-continue
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      const group = await this.evaluateGroup(option, { aggregator, conditions }, scope);

      // Only a record without a value that could still change a quantified condition leaves the
      // option undecided.
      if (group.verdict === null) group.unchecked.forEach(recordId => unchecked.add(recordId));

      const matched = group.verdict === true;
      if (matched) matchedOption = option;

      evaluations.push({
        option,
        outcome: matched ? 'matched' : 'not-matched',
        conditions: group.conditions,
      });
    }

    // A record without a value that could change the branch: the decision takes none, and the
    // operator picks one, knowing which records went unchecked.
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

  // A value that could not be read counts as not met, as on a single record. A group's verdict is
  // three-valued like its conditions', and its trace `met` is false while undecided.
  private async evaluateGroup(
    option: string,
    { aggregator, conditions }: DeterministicConditionGroup,
    scope: EvaluationScope,
  ): Promise<{
    verdict: boolean | null;
    unchecked: string[];
    met: boolean;
    conditions: ConditionResult[];
  }> {
    const evaluated: Array<{
      verdict: boolean | null;
      unchecked: string[];
      result: ConditionResult;
    }> = [];

    for (const [index, node] of conditions.entries()) {
      // eslint-disable-next-line no-await-in-loop
      evaluated.push(await this.evaluateNode(option, node, index, scope));
    }

    const verdict = combine(
      aggregator,
      evaluated.map(child => child.verdict),
    );

    return {
      verdict,
      unchecked: verdict === null ? evaluated.flatMap(child => child.unchecked) : [],
      met: verdict === true,
      conditions: evaluated.map(child => child.result),
    };
  }

  private async evaluateNode(
    option: string,
    node: DeterministicConditionGroup['conditions'][number],
    index: number,
    scope: EvaluationScope,
  ): Promise<{ verdict: boolean | null; unchecked: string[]; result: ConditionResult }> {
    if (isDeterministicConditionGroup(node)) {
      const { verdict, unchecked, ...result } = await this.evaluateGroup(option, node, scope);

      return { verdict, unchecked, result: { index, ...result } as ConditionResult };
    }

    const result = await this.evaluateCondition(option, node, scope);

    return {
      verdict: result.unchecked ? null : result.met === true,
      unchecked: result.unchecked ?? [],
      result: {
        index,
        met: result.met,
        ...(result.reason && { reason: result.reason }),
        ...(result.records && { records: result.records }),
      } as ConditionResult,
    };
  }

  private async evaluateCondition(
    option: string,
    condition: DeterministicCondition,
    { stepExecutions, clock, readRecordSource }: EvaluationScope,
  ): Promise<EvaluatedCondition> {
    const resolved = await this.resolveConditionValue(
      option,
      condition,
      stepExecutions,
      readRecordSource,
    );

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
        sourceType: condition.sourceType,
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
  ): EvaluatedCondition {
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

    const records = { matched, evaluated, ...(unchecked.length > 0 && { unchecked }) };
    const quantifier = condition.quantifier as NonNullable<DeterministicCondition['quantifier']>;
    // The records read can settle it whatever the others hold: one match answers any and none, one
    // record that does not match answers every.
    const settled = {
      any: matched > 0 ? true : undefined,
      every: matched < evaluated ? false : undefined,
      none: matched > 0 ? false : undefined,
    }[quantifier];

    if (settled !== undefined) return { met: settled, records };
    if (unchecked.length > 0) return { met: null, records, unchecked };
    // Over no record at all, "every" and "none" would hold vacuously: nothing was checked.
    if (evaluated === 0) return { met: false, records };

    return { met: quantifier !== 'any', records };
  }

  // Same live-path + most-recent-occurrence resolution as resolveSourceRecordRef: previousSteps
  // are already restricted to the live path, and in a loop the same step id repeats.
  private async resolveConditionValue(
    option: string,
    condition: DeterministicCondition,
    stepExecutions: StepExecutionData[],
    readRecordSource: RecordSourceReader,
  ): Promise<ResolvedConditionValue> {
    switch (condition.sourceType) {
      case 'get-data':
        return this.resolveGetDataValue(condition, stepExecutions);

      case 'sub-workflow':
        return this.resolveSubWorkflowEndValue(option, condition);

      case 'record':
        return ConditionStepExecutor.toConditionValue(
          await readRecordSource(condition),
          condition.fieldName,
        );

      /* istanbul ignore next — the schema only lets a known source type through */
      default: {
        const unknownSourceType: never = condition.sourceType;
        throw new InvalidStepDefinitionError(
          `unknown condition source type "${String(unknownSourceType)}"`,
        );
      }
    }
  }

  private resolveGetDataValue(
    condition: DeterministicCondition,
    stepExecutions: StepExecutionData[],
  ): ResolvedConditionValue {
    // Inside a call, only this call's own steps: another call of the workflow repeats the id.
    const sourceStep = findLatestStepInFrame(
      this.context.previousSteps,
      StepType.ReadRecord,
      condition.sourceStepId,
      this.context.callScope?.currentFrameStepIndexes,
    );
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

  private resolveSubWorkflowEndValue(
    option: string,
    condition: DeterministicCondition,
  ): ResolvedConditionValue {
    const call = this.context.subWorkflowEnds?.find(end => end.stepId === condition.sourceStepId);
    if (!call) return { found: false, reason: 'source-step-not-reached' };

    if ('perRecord' in call) {
      throw new PerRecordSubWorkflowEndConditionError(option, condition.sourceStepId);
    }

    return { found: true, value: call.endStepId };
  }

  private static toConditionValue(
    read: RecordSourceRead,
    fieldName: string,
  ): ResolvedConditionValue {
    const valueOf = (values: Record<string, unknown> | null) =>
      values && fieldName in values ? { found: true, value: values[fieldName] } : { found: false };

    if (read.kind === 'not-reached') return { found: false, reason: 'source-step-not-reached' };

    if (read.kind === 'per-record') {
      return {
        found: 'per-record',
        values: read.records.map(({ recordId, values }) => ({ recordId, ...valueOf(values) })),
      };
    }

    if (read.values === null) return { found: false, reason: 'record-not-found' };

    const field = valueOf(read.values);

    return field.found
      ? { found: true, value: field.value }
      : { found: false, reason: 'field-not-loaded' };
  }

  // Each record source is read once per evaluation, with every field its conditions compare, and
  // only when an option evaluated needs it: an option never reached costs no agent call.
  private createRecordSourceReader(
    step: DeterministicConditionStep,
    stepExecutions: StepExecutionData[],
  ): RecordSourceReader {
    const fieldsBySource = new Map<string, Set<string>>();

    step.preRecordedArgs.optionConditions.forEach(({ conditions }) =>
      collectRecordConditions(conditions).forEach(condition => {
        const key = recordSourceKey(condition);
        const fields = fieldsBySource.get(key) ?? new Set<string>();
        fields.add(condition.fieldName);
        fieldsBySource.set(key, fields);
      }),
    );

    const reads = new Map<string, Promise<RecordSourceRead>>();

    return condition => {
      const key = recordSourceKey(condition);

      if (!reads.has(key)) {
        const fields = [...(fieldsBySource.get(key) ?? [condition.fieldName])];
        reads.set(key, this.readRecordSource(condition, fields, stepExecutions));
      }

      return reads.get(key) as Promise<RecordSourceRead>;
    };
  }

  // The root is the record a step's "On record" would name: the run's (or the call's) record, or
  // what a Load Related Record step loaded. Several loaded records give one value per record.
  private async readRecordSource(
    { sourceStepId, relationPath }: DeterministicCondition,
    fields: string[],
    stepExecutions: StepExecutionData[],
  ): Promise<RecordSourceRead> {
    if (sourceStepId === WORKFLOW_START_STEP_ID) {
      const root = await resolveWorkflowStartRecordRef(this.context);

      return { kind: 'single', values: await this.readAlongPath(root, relationPath, fields) };
    }

    // Inside a call, only this call's own steps: another call of the workflow repeats the id.
    const sourceStep = findPinnedLoadStep(
      this.context.previousSteps,
      sourceStepId,
      this.context.callScope?.currentFrameStepIndexes,
    );
    if (!sourceStep) return { kind: 'not-reached' };

    const execution = this.resolveStepExecution(sourceStep, stepExecutions);
    const roots = ConditionStepExecutor.recordSourceRoots(execution);

    if (!roots) {
      const [root] = loadedRecordsOf(execution);

      return {
        kind: 'single',
        values: root ? await this.readAlongPath(root, relationPath, fields) : null,
      };
    }

    const records: Array<{ recordId: string; values: Record<string, unknown> | null }> = [];

    for (const { recordId, root } of roots) {
      records.push({
        recordId,
        // eslint-disable-next-line no-await-in-loop
        values: root ? await this.readAlongPath(root, relationPath, fields) : null,
      });
    }

    return { kind: 'per-record', records };
  }

  // Undefined for a step that loaded one record. A record is named as the steps running once per
  // record name it: by the record the Multiple step loaded, which for a Load Related Record running
  // once per record is the record it ran for, whatever it loaded.
  private static recordSourceRoots(
    execution: StepExecutionData | undefined,
  ): Array<{ recordId: string; root?: RecordRef }> | undefined {
    if (isPerRecordExecution(execution)) {
      return execution.iterations.map(({ sourceRecordRef, executionResult }) => ({
        recordId: serializeRecordId(sourceRecordRef.recordId),
        root: executionResult && 'record' in executionResult ? executionResult.record : undefined,
      }));
    }

    const result = execution?.type === 'load-related-record' && execution.executionResult;
    if (!result || !('records' in result)) return undefined;

    return result.records.map(root => ({ recordId: serializeRecordId(root.recordId), root }));
  }

  // A record the path does not lead to, or that the caller cannot see, holds no value; a collection
  // the caller cannot read stops the step, as it does a step acting on that record.
  private async readAlongPath(
    root: RecordRef,
    relationPath: readonly string[] | undefined,
    fields: string[],
  ): Promise<Record<string, unknown> | null> {
    const resolution = await followRelationPath(this.context, root, relationPath ?? [], fields);

    if (resolution.status === 'forbidden') {
      throw new CollectionAccessDeniedError(
        this.context.stepDefinition.title,
        resolution.collectionDisplayName,
      );
    }

    return resolution.status === 'found' ? resolution.values : null;
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
