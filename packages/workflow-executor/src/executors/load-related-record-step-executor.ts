import type { StepExecutionResult } from '../types/execution';
import type { CollectionSchema, RecordData, RecordRef } from '../types/record';
import type { LoadRelatedRecordStepDefinition } from '../types/step-definition';
import type { LoadRelatedRecordStepExecutionData, RelationRef } from '../types/step-execution-data';

import { DynamicStructuredTool, HumanMessage, SystemMessage } from '@forestadmin/ai-proxy';
import { z } from 'zod';

import {
  InvalidAIResponseError,
  InvalidPreRecordedArgsError,
  NoRelationshipFieldsError,
  RelatedRecordNotFoundError,
  RelationNotFoundError,
  StepPersistenceError,
  StepStateError,
} from '../errors';
import RecordStepExecutor from './record-step-executor';

const SELECT_RELATION_SYSTEM_PROMPT = `You are an AI agent loading a related record based on a user request.
Select the relation to follow.

Important rules:
- Be precise: only select the relation directly relevant to the request.
- Final answer is definitive, you won't receive any other input from the user.
- Do not refer to yourself as "I" in the response, use a passive formulation instead.`;

const SELECT_FIELDS_SYSTEM_PROMPT = `You are an AI agent selecting the most relevant fields to identify a related record.
Choose the fields that are most useful for determining which record best matches the user request.`;

const SELECT_RECORD_SYSTEM_PROMPT = `You are an AI agent selecting the most relevant related record from a list of candidates.
Choose the record that best matches the user request based on the provided field values.`;

interface RelationTarget extends RelationRef {
  selectedRecordRef: RecordRef;
  relationType?: 'BelongsTo' | 'HasMany' | 'HasOne';
}

export default class LoadRelatedRecordStepExecutor extends RecordStepExecutor<LoadRelatedRecordStepDefinition> {
  protected async doExecute(): Promise<StepExecutionResult> {
    // Branch A -- Re-entry after pending execution found in RunStore
    const pending = await this.patchAndReloadPendingData<LoadRelatedRecordStepExecutionData>(
      this.context.incomingPendingData,
    );

    if (pending) {
      return this.handleConfirmationFlow<LoadRelatedRecordStepExecutionData>(pending, async exec =>
        this.resolveFromSelection(exec),
      );
    }

    // Branches B & C -- First call
    return this.handleFirstCall();
  }

  private async handleFirstCall(): Promise<StepExecutionResult> {
    const { stepDefinition: step } = this.context;
    const { preRecordedArgs } = step;
    const records = await this.getAvailableRecordRefs();
    const selectedRecordRef = await this.resolveRecordRef(
      records,
      step.prompt,
      preRecordedArgs?.selectedRecordStepIndex,
    );
    const schema = await this.getCollectionSchema(selectedRecordRef.collectionName);
    const args = preRecordedArgs?.relationDisplayName
      ? { relationName: preRecordedArgs.relationDisplayName }
      : await this.selectRelation(schema, step.prompt);
    const target = this.buildTarget(schema, args.relationName, selectedRecordRef);

    // Branch B -- automaticExecution
    if (step.automaticExecution) {
      return this.resolveAndLoadAutomatic(target);
    }

    // Branch C -- pre-fetch candidates, await user confirmation
    return this.saveAndAwaitInput(target);
  }

  private buildTarget(
    schema: CollectionSchema,
    relationName: string,
    selectedRecordRef: RecordRef,
  ): RelationTarget {
    const field = this.findField(schema, relationName);

    if (!field) {
      throw new RelationNotFoundError(relationName, schema.collectionName);
    }

    return {
      selectedRecordRef,
      displayName: field.displayName,
      name: field.fieldName,
      relationType: field.relationType,
    };
  }

  /**
   * Branch C: uses AI to select the best candidate, persists pendingData with suggestion, returns awaiting-input.
   * Unlike persistAndReturn (Branches A/B), storage errors propagate directly here:
   * the relation-load has not yet happened so the step can safely be retried.
   */
  private async saveAndAwaitInput(target: RelationTarget): Promise<StepExecutionResult> {
    const { selectedRecordRef, name, displayName } = target;

    const { relatedData, bestIndex, suggestedFields } = await this.selectBestFromRelatedData(
      target,
      50,
    );

    const selectedRecordId = relatedData[bestIndex].recordId;

    await this.context.runStore.saveStepExecution(this.context.runId, {
      type: 'load-related-record',
      stepIndex: this.context.stepIndex,
      pendingData: { displayName, name, suggestedFields, selectedRecordId },
      selectedRecordRef,
    });

    return this.buildOutcomeResult({ status: 'awaiting-input' });
  }

  /** Branch B: automatic execution. HasMany uses 2 AI calls; others take the first result. */
  private async resolveAndLoadAutomatic(target: RelationTarget): Promise<StepExecutionResult> {
    const record =
      target.relationType === 'HasMany'
        ? await this.selectBestRelatedRecord(target)
        : await this.fetchFirstCandidate(target);

    return this.persistAndReturn(record, target, undefined);
  }

  /**
   * Branch A: builds RecordRef from pendingData.selectedRecordId.
   * Re-derives relatedCollectionName from FieldSchema using the (possibly updated) relation name,
   * so a user-overridden relation name is handled correctly.
   * No additional getRelatedData call.
   */
  private async resolveFromSelection(
    execution: LoadRelatedRecordStepExecutionData,
  ): Promise<StepExecutionResult> {
    const { selectedRecordRef, pendingData } = execution;

    if (!pendingData) {
      throw new StepStateError(`Step at index ${this.context.stepIndex} has no pending data`);
    }

    const { name, displayName, selectedRecordId } = pendingData;

    // Re-derive relatedCollectionName from schema using the (possibly updated) relation name.
    // `name` is always a fieldName (set from field.fieldName in buildTarget) — search directly.
    const schema = await this.getCollectionSchema(selectedRecordRef.collectionName);
    const field = schema.fields.find(f => f.fieldName === name);
    const relatedCollectionName = field?.relatedCollectionName;

    if (!relatedCollectionName) {
      throw new StepStateError(
        `Step at index ${this.context.stepIndex} could not resolve relatedCollectionName for relation "${name}"`,
      );
    }

    const record: RecordRef = {
      collectionName: relatedCollectionName,
      recordId: selectedRecordId,
      stepIndex: this.context.stepIndex,
    };

    return this.persistAndReturn(record, { selectedRecordRef, name, displayName }, execution);
  }

  /**
   * Fetches up to `limit` related records and uses AI to select the best one when multiple exist.
   * Returns the full RecordData array, the best index, and the AI-selected fields.
   */
  private async selectBestFromRelatedData(
    target: Pick<RelationTarget, 'selectedRecordRef' | 'name'>,
    limit: number,
  ): Promise<{ relatedData: RecordData[]; bestIndex: number; suggestedFields: string[] }> {
    const { selectedRecordRef, name } = target;

    const relatedData = await this.agentPort.getRelatedData(
      {
        collection: selectedRecordRef.collectionName,
        id: selectedRecordRef.recordId,
        relation: name,
        limit,
      },
      this.context.user,
    );

    if (relatedData.length === 0) {
      throw new RelatedRecordNotFoundError(selectedRecordRef.collectionName, name);
    }

    if (relatedData.length === 1) {
      return { relatedData, bestIndex: 0, suggestedFields: [] };
    }

    const { preRecordedArgs } = this.context.stepDefinition;

    if (preRecordedArgs?.selectedRecordIndex !== undefined) {
      if (
        !Number.isInteger(preRecordedArgs.selectedRecordIndex) ||
        preRecordedArgs.selectedRecordIndex < 0 ||
        preRecordedArgs.selectedRecordIndex >= relatedData.length
      ) {
        throw new InvalidPreRecordedArgsError(
          `Record index ${preRecordedArgs.selectedRecordIndex} is out of range (0-${
            relatedData.length - 1
          })`,
        );
      }

      return { relatedData, bestIndex: preRecordedArgs.selectedRecordIndex, suggestedFields: [] };
    }

    const relatedSchema = await this.getCollectionSchema(relatedData[0].collectionName);
    const suggestedFields = await this.selectRelevantFields(
      relatedSchema,
      this.context.stepDefinition.prompt,
    );
    const bestIndex = await this.selectBestRecordIndex(
      relatedData,
      suggestedFields,
      this.context.stepDefinition.prompt,
    );

    return { relatedData, bestIndex, suggestedFields };
  }

  /** HasMany + automaticExecution: fetch top 50, then AI calls to select the best record. */
  private async selectBestRelatedRecord(target: RelationTarget): Promise<RecordRef> {
    const { relatedData, bestIndex } = await this.selectBestFromRelatedData(target, 50);

    return this.toRecordRef(relatedData[bestIndex]);
  }

  /** BelongsTo / HasOne: fetch 1 record and take it directly. */
  private async fetchFirstCandidate(target: RelationTarget): Promise<RecordRef> {
    const candidates = await this.fetchCandidates(target, 1);

    return candidates[0];
  }

  /**
   * Fetches related records and converts them to RecordRefs.
   * Throws RelatedRecordNotFoundError when the result is empty.
   */
  private async fetchCandidates(
    target: Pick<RelationTarget, 'selectedRecordRef' | 'name'>,
    limit: number,
  ): Promise<RecordRef[]> {
    const { selectedRecordRef, name } = target;
    const relatedData = await this.agentPort.getRelatedData(
      {
        collection: selectedRecordRef.collectionName,
        id: selectedRecordRef.recordId,
        relation: name,
        limit,
      },
      this.context.user,
    );

    if (relatedData.length === 0) {
      throw new RelatedRecordNotFoundError(selectedRecordRef.collectionName, name);
    }

    return relatedData.map(r => this.toRecordRef(r));
  }

  /** Persists the loaded record ref and returns a success outcome. */
  private async persistAndReturn(
    record: RecordRef,
    target: Pick<RelationTarget, 'selectedRecordRef' | 'name' | 'displayName'>,
    existingExecution: LoadRelatedRecordStepExecutionData | undefined,
  ): Promise<StepExecutionResult> {
    const { selectedRecordRef, name, displayName } = target;

    try {
      await this.context.runStore.saveStepExecution(this.context.runId, {
        ...existingExecution,
        type: 'load-related-record',
        stepIndex: this.context.stepIndex,
        executionParams: { displayName, name },
        executionResult: { relation: { name, displayName }, record },
        selectedRecordRef,
      });
    } catch (cause) {
      throw new StepPersistenceError(
        `Related record loaded but step state could not be persisted ` +
          `(run "${this.context.runId}", step ${this.context.stepIndex})`,
        cause,
      );
    }

    return this.buildOutcomeResult({ status: 'success' });
  }

  private async selectRelation(
    schema: CollectionSchema,
    prompt: string | undefined,
  ): Promise<{ relationName: string; reasoning: string }> {
    const tool = this.buildSelectRelationTool(schema);
    const messages = [
      this.buildContextMessage(),
      ...(await this.buildPreviousStepsMessages()),
      new SystemMessage(SELECT_RELATION_SYSTEM_PROMPT),
      new SystemMessage(
        `The selected record belongs to the "${schema.collectionDisplayName}" collection.`,
      ),
      new HumanMessage(`**Request**: ${prompt ?? 'Load the relevant related record.'}`),
    ];

    return this.invokeWithTool<{ relationName: string; reasoning: string }>(messages, tool);
  }

  private buildSelectRelationTool(schema: CollectionSchema): DynamicStructuredTool {
    const relationFields = schema.fields.filter(f => f.isRelationship);

    if (relationFields.length === 0) {
      throw new NoRelationshipFieldsError(schema.collectionName);
    }

    const displayNames = relationFields.map(f => f.displayName) as [string, ...string[]];
    const technicalNames = relationFields
      .map(f => `${f.displayName} (technical name: ${f.fieldName})`)
      .join(', ');

    return new DynamicStructuredTool({
      name: 'select-relation',
      description: 'Select the relation to follow from the record.',
      schema: z.object({
        relationName: z
          .enum(displayNames)
          .describe(`The name of the relation to follow. Available: ${technicalNames}`),
        reasoning: z.string().describe('Why this relation was chosen'),
      }),
      func: undefined,
    });
  }

  /** AI call 1 for HasMany: selects the most relevant fields to compare candidates. */
  private async selectRelevantFields(
    schema: CollectionSchema,
    prompt: string | undefined,
  ): Promise<string[]> {
    const nonRelationFields = schema.fields.filter(f => !f.isRelationship);

    if (nonRelationFields.length === 0) return [];

    // Use displayName in both the enum and the prompt for consistency — the AI sees human-readable
    // names throughout. Results are mapped back to technical fieldNames before returning.
    const displayNames = nonRelationFields.map(f => f.displayName) as [string, ...string[]];

    const tool = new DynamicStructuredTool({
      name: 'select-fields',
      description: 'Select the most relevant fields to identify the right record.',
      schema: z.object({
        fieldNames: z
          .array(z.enum(displayNames))
          .min(1)
          .describe('Field names most useful for identifying the relevant record'),
      }),
      func: undefined,
    });

    const messages = [
      this.buildContextMessage(),
      new SystemMessage(SELECT_FIELDS_SYSTEM_PROMPT),
      new SystemMessage(
        `The related records are from the "${schema.collectionDisplayName}" collection. ` +
          `Available fields: ${nonRelationFields.map(f => f.displayName).join(', ')}.`,
      ),
      new HumanMessage(`**Request**: ${prompt ?? 'Select the most relevant record.'}`),
    ];

    const { fieldNames: selectedDisplayNames } = await this.invokeWithTool<{
      fieldNames: string[];
    }>(messages, tool);

    // Zod's .min(1) shapes the prompt but is NOT validated against the AI response.
    // Guard explicitly to avoid silently passing all fields to selectBestRecordIndex.
    if (selectedDisplayNames.length === 0) {
      throw new InvalidAIResponseError(
        `AI returned no field names for field selection in collection "${schema.collectionName}"`,
      );
    }

    // Map display names back to technical field names — values in RecordData are keyed by fieldName.
    return selectedDisplayNames.map(
      dn => nonRelationFields.find(f => f.displayName === dn)?.fieldName ?? dn,
    );
  }

  /** AI call 2 for HasMany: selects the best record by index from the candidate list. */
  private async selectBestRecordIndex(
    candidates: RecordData[],
    fieldNames: string[],
    prompt: string | undefined,
  ): Promise<number> {
    const maxIndex = candidates.length - 1;
    const filteredCandidates = candidates.map((c, i) => ({
      index: i,
      values:
        fieldNames.length > 0
          ? Object.fromEntries(Object.entries(c.values).filter(([k]) => fieldNames.includes(k)))
          : c.values,
    }));

    const tool = new DynamicStructuredTool({
      name: 'select-record-by-content',
      description: 'Select the most relevant related record by its index.',
      schema: z.object({
        recordIndex: z
          .number()
          .int()
          .min(0)
          .max(maxIndex)
          .describe(`0-based index of the most relevant record (0 to ${maxIndex})`),
        reasoning: z.string().describe('Why this record was chosen'),
      }),
      func: undefined,
    });

    const recordList = filteredCandidates
      .map(c => `[${c.index}] ${JSON.stringify(c.values)}`)
      .join('\n');

    const messages = [
      this.buildContextMessage(),
      new SystemMessage(SELECT_RECORD_SYSTEM_PROMPT),
      new SystemMessage(`Candidates:\n${recordList}`),
      new HumanMessage(`**Request**: ${prompt ?? 'Select the most relevant record.'}`),
    ];

    const { recordIndex } = await this.invokeWithTool<{ recordIndex: number; reasoning: string }>(
      messages,
      tool,
    );

    // NOTE: The Zod schema's .min(0).max(maxIndex) shapes the tool prompt only — it is NOT
    // validated against the AI response. This guard is the sole runtime enforcement.
    if (!Number.isInteger(recordIndex) || recordIndex < 0 || recordIndex > maxIndex) {
      throw new InvalidAIResponseError(
        `AI selected record index ${recordIndex} which is out of range (0-${maxIndex}) or not an integer`,
      );
    }

    return recordIndex;
  }

  private toRecordRef(data: RecordData): RecordRef {
    return {
      collectionName: data.collectionName,
      recordId: data.recordId,
      stepIndex: this.context.stepIndex,
    };
  }
}
