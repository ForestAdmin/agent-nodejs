import type { RelationPathHop } from './relation-path';
import type { StepExecutionResult } from '../types/execution-context';
import type { CollectionSchema, FieldSchema, RecordRef } from '../types/validated/collection';
import type { StepDefinition } from '../types/validated/step-definition';
import type { ErrorKind, RecordStepStatus } from '../types/validated/step-outcome';

import { DynamicStructuredTool, HumanMessage, SystemMessage } from '@forestadmin/ai-proxy';
import { z } from 'zod';

import {
  CollectionAccessDeniedError,
  InvalidAIResponseError,
  InvalidPreRecordedArgsError,
  NoRecordsError,
  RelationPathEmptyError,
} from '../errors';
import BaseStepExecutor from './base-step-executor';
import { isSameRecord } from './iteration-run-store';
import {
  findPinnedLoadStep,
  isPinnedCall,
  loadedRecordsOf,
  resolveStepRecordRef,
  resolveWorkflowStartRecordRef,
} from './pinned-record';
import followRelationPath from './relation-path';
import { StepType, WORKFLOW_START_STEP_ID } from '../types/validated/step-definition';

export default abstract class RecordStepExecutor<
  TStep extends StepDefinition = StepDefinition,
> extends BaseStepExecutor<TStep> {
  protected buildOutcomeResult(outcome: {
    status: RecordStepStatus;
    error?: string;
    errorKind?: ErrorKind;
    errorSourceStepIndex?: number;
    loadedRecordCount?: number;
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

  // A step that writes lets the AI pick only among the records it may write to.
  protected async resolveRecordRef(
    prompt: string | undefined,
    {
      preRecordedStepIndex,
      writes = false,
    }: { preRecordedStepIndex?: number; writes?: boolean } = {},
  ): Promise<RecordRef> {
    if (preRecordedStepIndex !== undefined) {
      const records = await this.listRecordRefs();
      const match = records.find(r => r.stepIndex === preRecordedStepIndex);

      if (!match) {
        throw new InvalidPreRecordedArgsError(
          `No record found at step index ${preRecordedStepIndex}`,
        );
      }

      return match;
    }

    const callRecord = await this.getCallRecordRef();

    return this.selectRecordRef(await this.listRecordRefs(callRecord, writes), prompt, callRecord);
  }

  // Revise-safe source resolution shared by deterministic steps (load-related "Related to",
  // trigger-action "On record"). The reference is a stable BPMN step id (or the
  // WORKFLOW_START_STEP_ID sentinel), not a runtime index — so it survives the index shifts a
  // revision causes (clones keep their step id) and is knowable by the editor at build time.
  protected async resolveSourceRecordRef(
    stepId: string,
    relationPath?: readonly string[],
  ): Promise<RecordRef> {
    const root = await this.resolvePinnedRecordRef(stepId);
    if (!relationPath) return root;

    const resolution = await followRelationPath(this.context, root, relationPath);
    const { title } = this.context.stepDefinition;

    if (resolution.status === 'forbidden') {
      throw new CollectionAccessDeniedError(title, resolution.collectionDisplayName);
    }

    if (resolution.status === 'empty') {
      const missing = resolution.hops[resolution.hops.length - 1];

      throw new RelationPathEmptyError(
        title,
        missing.relationDisplayName,
        this.relationPathLabel(stepId, resolution.hops),
      );
    }

    return resolution.record;
  }

  private relationPathLabel(stepId: string, hops: RelationPathHop[]): string {
    const rootLabel =
      stepId === WORKFLOW_START_STEP_ID
        ? 'Starting record'
        : `"${
            findPinnedLoadStep(
              this.context.previousSteps,
              stepId,
              this.context.callScope?.currentFrameStepIndexes,
            )?.stepDefinition.title ?? stepId
          }"`;

    return [rootLabel, ...hops.map(hop => hop.relationDisplayName)].join(' › ');
  }

  private async resolvePinnedRecordRef(stepId: string): Promise<RecordRef> {
    if (stepId === WORKFLOW_START_STEP_ID) return resolveWorkflowStartRecordRef(this.context);

    // Inside a call, only this call's own steps: a closed call repeating the id is not a source.
    const record = await resolveStepRecordRef(
      this.context,
      stepId,
      this.context.callScope?.currentFrameStepIndexes,
    );

    if (!record) {
      throw new InvalidPreRecordedArgsError(`No source record found for step "${stepId}"`);
    }

    return record;
  }

  // Candidate sources for the AI: the base record plus the record each live prior
  // load-related step resolved — own stepIndex first, falling back to a clone's
  // originalStepIndex. Inside a call pinned to a record, that record comes first.
  protected async getAvailableRecordRefs(): Promise<RecordRef[]> {
    return this.listRecordRefs(await this.getCallRecordRef());
  }

  // Undefined outside a call pinned to a record: a call pinning nothing has no record of its own,
  // so its steps keep choosing among everything the run loaded.
  private async getCallRecordRef(): Promise<RecordRef | undefined> {
    if (!isPinnedCall(this.context.callScope)) return undefined;

    return this.resolveSourceRecordRef(WORKFLOW_START_STEP_ID);
  }

  // A write inside a pinned call targets the call's record or a record loaded since the call
  // opened: a wrong pick among the calling workflow's records would write to it once per call.
  private async listRecordRefs(callRecord?: RecordRef, writes = false): Promise<RecordRef[]> {
    const { baseRecordRef, callScope } = this.context;
    if (!callRecord) return [baseRecordRef, ...(await this.getLoadedRecordRefs())];

    const others = writes
      ? await this.getLoadedRecordRefs(callScope?.startStepIndex ?? Number.POSITIVE_INFINITY)
      : [baseRecordRef, ...(await this.getLoadedRecordRefs())];

    return [callRecord, ...others.filter(record => !isSameRecord(record, callRecord))];
  }

  // Judged by the loading step's own index: a clone's record carries the index of its original.
  private async getLoadedRecordRefs(afterStepIndex = -1): Promise<RecordRef[]> {
    const stepExecutions = await this.context.runStore.getStepExecutions(this.context.runId);

    return this.context.previousSteps.flatMap(step =>
      step.stepDefinition.type === StepType.LoadRelatedRecord &&
      step.stepOutcome.stepIndex > afterStepIndex
        ? loadedRecordsOf(this.resolveStepExecution(step, stepExecutions))
        : [],
    );
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
    callRecord?: RecordRef,
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
        [
          'You are an AI agent selecting the most relevant record for a workflow step.',
          'Choose the record whose collection best matches the user request.',
          'Pay attention to the collection name of each record.',
          ...(callRecord
            ? [
                `This step runs inside a Sub-workflow call on "${identifiers[0]}", listed first: prefer it unless the request names another record.`,
              ]
            : []),
        ].join('\n'),
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
