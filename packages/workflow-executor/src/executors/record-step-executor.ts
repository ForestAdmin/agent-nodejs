import type { StepExecutionResult } from '../types/execution-context';
import type { StepExecutionData } from '../types/step-execution-data';
import type { CollectionSchema, FieldSchema, RecordRef } from '../types/validated/collection';
import type { StepDefinition } from '../types/validated/step-definition';
import type { ErrorKind, RecordStepStatus } from '../types/validated/step-outcome';

import { DynamicStructuredTool, HumanMessage, SystemMessage } from '@forestadmin/ai-proxy';
import { z } from 'zod';

import {
  InvalidAIResponseError,
  InvalidPreRecordedArgsError,
  NoRecordsError,
  SourceRecordCollectionMismatchError,
  SourceRecordMissingError,
  SourceRecordStepNotReachedError,
} from '../errors';
import BaseStepExecutor from './base-step-executor';
import { StepType, WORKFLOW_START_STEP_ID } from '../types/validated/step-definition';

// A source step that offered a candidate and was passed over is an operator situation; one that ran
// and found nothing is an empty source, which is the step the operator can go back to. Neither is a
// configuration fault. An execution the guard cannot read stays unclassified.
function classifyMissingSourceRecord(execution?: StepExecutionData): ErrorKind | undefined {
  if (execution?.type !== 'load-related-record') return undefined;

  const { pendingData, executionResult } = execution;

  // A result outside the declared shape signals an executor defect, not a decision the run made.
  if (executionResult !== undefined && !('skipped' in executionResult)) return undefined;

  // Nothing was ever offered: only Full AI continues without pausing, so there was no choice to make.
  if (!pendingData) return executionResult !== undefined ? 'empty-source' : undefined;

  // Whether it paused or recorded a decline, the candidate list says whether there was a choice.
  return pendingData.availableRecordIds.length > 0 ? 'operator' : 'empty-source';
}

export default abstract class RecordStepExecutor<
  TStep extends StepDefinition = StepDefinition,
> extends BaseStepExecutor<TStep> {
  protected buildOutcomeResult(outcome: {
    status: RecordStepStatus;
    error?: string;
    errorKind?: ErrorKind;
    errorSourceStepIndex?: number;
  }): StepExecutionResult {
    return {
      stepOutcome: {
        type: 'record',
        stepId: this.context.stepId,
        stepIndex: this.context.stepIndex,
        ...outcome,
      },
    };
  }

  protected async resolveRecordRef(
    records: RecordRef[],
    prompt: string | undefined,
    preRecordedStepIndex?: number,
  ): Promise<RecordRef> {
    if (preRecordedStepIndex !== undefined) {
      const match = records.find(r => r.stepIndex === preRecordedStepIndex);

      if (!match) {
        throw new InvalidPreRecordedArgsError(
          `No record found at step index ${preRecordedStepIndex}`,
        );
      }

      return match;
    }

    return this.selectRecordRef(records, prompt);
  }

  // Revise-safe source resolution shared by deterministic steps (load-related "Related to",
  // trigger-action "On record"). The reference is a stable BPMN step id (or the
  // WORKFLOW_START_STEP_ID sentinel), not a runtime index — so it survives the index shifts a
  // revision causes (clones keep their step id) and is knowable by the editor at build time.
  protected async resolveSourceRecordRef(stepId: string): Promise<RecordRef> {
    if (stepId !== WORKFLOW_START_STEP_ID) {
      const record = await this.resolveStepRecordRef(stepId);

      if (!record) {
        throw new InvalidPreRecordedArgsError(`No source record found for step "${stepId}"`);
      }

      return record;
    }

    const { callScope, baseRecordRef } = this.context;
    if (!callScope) return baseRecordRef;

    // Inside a Sub-workflow call, "workflow start" means the record the calling step pinned. A call
    // pinning none behaves exactly as before the pin existed: it starts from the record the run was
    // launched on, whatever collection the called workflow is on, until the Editor sets one.
    if (!callScope.selectedRecordStepId && !callScope.isPinned) return baseRecordRef;

    // A call pinning "workflow start" all the way out pins the run's record, and is still checked.
    let record = baseRecordRef;

    if (callScope.selectedRecordStepId) {
      const pinned = await this.resolveStepRecordRef(
        callScope.selectedRecordStepId,
        callScope.pinnedFrameStepIndexes,
      );
      // The pin names a step of the calling workflow, so a miss is that Sub-workflow step's to fix.
      if (!pinned) throw new SourceRecordStepNotReachedError(callScope.selectedRecordStepId);
      record = pinned;
    }

    // A pinned record of another collection than the called workflow is not what its steps were
    // built against, so the step refuses it rather than acting on it, naming both collections.
    if (
      callScope.calledWorkflowCollectionName !== undefined &&
      record.collectionName !== callScope.calledWorkflowCollectionName
    ) {
      throw new SourceRecordCollectionMismatchError(
        record.collectionName,
        callScope.calledWorkflowCollectionName,
      );
    }

    return record;
  }

  // The record a Load Related Record step loaded, or undefined when no step with that id ran, so each
  // caller names its own miss.
  // previousSteps are already restricted to the live path; in a loop the same id can appear more
  // than once, so we take the most recent occurrence. `frameStepIndexes` narrows that to the steps
  // of the frame that wrote a Sub-workflow call's pin: previousSteps flattens every frame, and a
  // step id is unique only inside its own workflow, so any other workflow repeating one — a copy of
  // the caller, a call on itself, a sibling call that already closed — would otherwise shadow the
  // step its caller pinned. A step resolving an id it declared itself passes no frame.
  private async resolveStepRecordRef(
    stepId: string,
    frameStepIndexes?: number[],
  ): Promise<RecordRef | undefined> {
    const matches = this.context.previousSteps.filter(
      step =>
        step.stepDefinition.type === StepType.LoadRelatedRecord &&
        step.stepOutcome.stepId === stepId &&
        (frameStepIndexes === undefined || frameStepIndexes.includes(step.stepOutcome.stepIndex)),
    );
    const sourceStep = matches[matches.length - 1];

    if (sourceStep) {
      const stepExecutions = await this.context.runStore.getStepExecutions(this.context.runId);
      const execution = this.resolveStepExecution(sourceStep, stepExecutions);

      if (
        execution?.type === 'load-related-record' &&
        execution.executionResult !== undefined &&
        'record' in execution.executionResult
      ) {
        return execution.executionResult.record;
      }

      // The source step exists but loaded nothing → clear "no source record" message,
      // distinct from a config pointing at a non-existent step.
      throw new SourceRecordMissingError(sourceStep.stepDefinition.title, {
        errorKind: classifyMissingSourceRecord(execution),
        errorSourceStepIndex: sourceStep.stepOutcome.stepIndex,
      });
    }

    return undefined;
  }

  // Candidate sources for the AI: the base record plus the record each live prior
  // load-related step resolved — own stepIndex first, falling back to a clone's
  // originalStepIndex.
  protected async getAvailableRecordRefs(): Promise<RecordRef[]> {
    const stepExecutions = await this.context.runStore.getStepExecutions(this.context.runId);
    const relatedRecords = this.context.previousSteps.flatMap(step => {
      if (step.stepDefinition.type !== StepType.LoadRelatedRecord) return [];

      const execution = this.resolveStepExecution(step, stepExecutions);

      if (
        execution?.type === 'load-related-record' &&
        execution.executionResult !== undefined &&
        'record' in execution.executionResult
      ) {
        return [execution.executionResult.record];
      }

      return [];
    });

    return [this.context.baseRecordRef, ...relatedRecords];
  }

  protected getCollectionSchema(collectionName: string): Promise<CollectionSchema> {
    return this.context.schemaResolver.resolve(collectionName);
  }

  protected findFieldByTechnicalName(
    schema: CollectionSchema,
    name: string | undefined,
  ): FieldSchema | undefined {
    if (name === undefined) return undefined;

    return schema.fields.find(f => f.fieldName === name);
  }

  // Map an AI-returned displayName back to its technical fieldName. LLMs occasionally return
  // formatting variants (e.g. "first_name" for "firstname", "full-name" for "Full Name"), so fall
  // back to a normalized comparison. On a miss, returns the raw name — the exact lookup downstream
  // turns it into a loud error.
  protected resolveAiFieldName(schema: CollectionSchema, name: string): string {
    const exact =
      schema.fields.find(f => f.displayName === name) ??
      schema.fields.find(f => f.fieldName === name);
    if (exact) return exact.fieldName;

    const normalize = (s: string) => s.toLowerCase().replace(/[\s_-]/g, '');
    const normalized = normalize(name);
    const fuzzy = schema.fields.filter(
      f => normalize(f.displayName) === normalized || normalize(f.fieldName) === normalized,
    );

    return fuzzy.length === 1 ? fuzzy[0].fieldName : name;
  }

  private async toRecordIdentifier(record: RecordRef): Promise<string> {
    const schema = await this.getCollectionSchema(record.collectionName);

    return `Step ${record.stepIndex} - ${schema.collectionDisplayName} #${record.recordId}`;
  }

  private async selectRecordRef(
    records: RecordRef[],
    prompt: string | undefined,
  ): Promise<RecordRef> {
    if (records.length === 0) throw new NoRecordsError();
    if (records.length === 1) return records[0];

    const identifiers = await Promise.all(records.map(r => this.toRecordIdentifier(r)));
    const identifierTuple = identifiers as [string, ...string[]];

    const tool = new DynamicStructuredTool({
      name: 'select-record',
      description: 'Select the most relevant record for this workflow step.',
      schema: z.object({
        recordIdentifier: z.enum(identifierTuple),
      }),
      func: undefined,
    });

    const messages = [
      this.buildContextMessage(),
      ...(await this.buildPreviousStepsMessages()),
      new SystemMessage(
        'You are an AI agent selecting the most relevant record for a workflow step.\n' +
          'Choose the record whose collection best matches the user request.\n' +
          'Pay attention to the collection name of each record.',
      ),
      new HumanMessage(prompt ?? 'Select the most relevant record.'),
    ];

    const { recordIdentifier } = await this.invokeWithTool<{ recordIdentifier: string }>(
      messages,
      tool,
    );

    const selectedIndex = identifiers.indexOf(recordIdentifier);

    if (selectedIndex === -1) {
      throw new InvalidAIResponseError(
        `AI selected record "${recordIdentifier}" which does not match any available record`,
      );
    }

    return records[selectedIndex];
  }
}
