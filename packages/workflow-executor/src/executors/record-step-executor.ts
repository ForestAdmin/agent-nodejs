import type { StepExecutionResult } from '../types/execution-context';
import type { CollectionSchema, FieldSchema, RecordRef } from '../types/validated/collection';
import type { StepDefinition } from '../types/validated/step-definition';
import type { RecordStepStatus } from '../types/validated/step-outcome';

import { DynamicStructuredTool, HumanMessage, SystemMessage } from '@forestadmin/ai-proxy';
import { z } from 'zod';

import {
  InvalidAIResponseError,
  InvalidPreRecordedArgsError,
  NoRecordsError,
  SourceRecordMissingError,
} from '../errors';
import BaseStepExecutor from './base-step-executor';
import { StepType, WORKFLOW_START_STEP_ID } from '../types/validated/step-definition';

export default abstract class RecordStepExecutor<
  TStep extends StepDefinition = StepDefinition,
> extends BaseStepExecutor<TStep> {
  protected buildOutcomeResult(outcome: {
    status: RecordStepStatus;
    error?: string;
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
  // previousSteps are already restricted to the live path; in a loop the same id can appear more
  // than once, so we take the most recent occurrence.
  protected async resolveSourceRecordRef(stepId: string): Promise<RecordRef> {
    if (stepId === WORKFLOW_START_STEP_ID) {
      return this.context.baseRecordRef;
    }

    const matches = this.context.previousSteps.filter(
      step =>
        step.stepDefinition.type === StepType.LoadRelatedRecord &&
        step.stepOutcome.stepId === stepId,
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

      // The source step exists but loaded nothing → clear "no source record" message (PRD-550),
      // distinct from a config pointing at a non-existent step.
      throw new SourceRecordMissingError(sourceStep.stepDefinition.title);
    }

    throw new InvalidPreRecordedArgsError(`No source record found for step "${stepId}"`);
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
