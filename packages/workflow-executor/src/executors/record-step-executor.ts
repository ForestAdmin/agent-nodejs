import type { StepExecutionResult } from '../types/execution-context';
import type { CollectionSchema, FieldSchema, RecordRef } from '../types/validated/collection';
import type { StepDefinition } from '../types/validated/step-definition';
import type { RecordStepStatus } from '../types/validated/step-outcome';

import { DynamicStructuredTool, HumanMessage, SystemMessage } from '@forestadmin/ai-proxy';
import { z } from 'zod';

import { InvalidAIResponseError, InvalidPreRecordedArgsError, NoRecordsError } from '../errors';
import BaseStepExecutor from './base-step-executor';

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

  protected async getAvailableRecordRefs(): Promise<RecordRef[]> {
    const stepExecutions = await this.context.runStore.getStepExecutions(this.context.runId);
    const relatedRecords = stepExecutions.flatMap(e => {
      if (
        e.type === 'load-related-record' &&
        e.executionResult !== undefined &&
        'record' in e.executionResult
      ) {
        return [e.executionResult.record];
      }

      return [];
    });

    return [this.context.baseRecordRef, ...relatedRecords];
  }

  protected async getCollectionSchema(collectionName: string): Promise<CollectionSchema> {
    const cached = this.context.schemaCache.get(collectionName);
    if (cached) return cached;

    const schema = await this.context.workflowPort.getCollectionSchema(
      collectionName,
      this.context.runId,
    );
    this.context.schemaCache.set(collectionName, schema);

    return schema;
  }

  protected findFieldByTechnicalName(
    schema: CollectionSchema,
    name: string,
  ): FieldSchema | undefined {
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
