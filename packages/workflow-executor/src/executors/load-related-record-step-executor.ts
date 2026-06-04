import type { CreateActivityLogArgs } from '../ports/activity-log-port';
import type { StepExecutionResult } from '../types/execution-context';
import type {
  LoadRelatedRecordCandidate,
  LoadRelatedRecordStepExecutionData,
  RelationRef,
} from '../types/step-execution-data';
import type { CollectionSchema, RecordData, RecordRef } from '../types/validated/collection';
import type { LoadRelatedRecordStepDefinition } from '../types/validated/step-definition';

import { DynamicStructuredTool, HumanMessage, SystemMessage } from '@forestadmin/ai-proxy';
import { z } from 'zod';

import {
  InvalidAIResponseError,
  InvalidPreRecordedArgsError,
  NoRelationshipFieldsError,
  RelatedRecordNotFoundError,
  RelationNotFoundError,
  StepStateError,
} from '../errors';
import RecordStepExecutor from './record-step-executor';
import { StepExecutionMode } from '../types/validated/step-definition';

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

// Bound only what is sent to the AI in selectBestRecordIndex — the full candidate list is
// always returned to the front via availableRecordIds. These cap the prompt size, not the data.
const MAX_RELEVANT_FIELDS = 6;
const MAX_FIELD_VALUE_LENGTH = 80; // per-field serialized length before truncation
const MAX_AI_CANDIDATES_CHARS = 16_000; // global budget for the `Candidates:` block (~4k tokens)

function clampFieldValue(value: unknown): unknown {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value) ?? '';
  if (serialized.length <= MAX_FIELD_VALUE_LENGTH) return value;

  return `${serialized.slice(0, MAX_FIELD_VALUE_LENGTH)}… (truncated)`;
}

interface RelationTarget extends RelationRef {
  selectedRecordRef: RecordRef;
  relationType?: 'BelongsTo' | 'HasMany' | 'HasOne' | 'BelongsToMany';
  relatedCollectionName: string;
}

export default class LoadRelatedRecordStepExecutor extends RecordStepExecutor<LoadRelatedRecordStepDefinition> {
  protected override buildActivityLogArgs(): CreateActivityLogArgs | null {
    return {
      renderingId: this.context.user.renderingId,
      action: 'listRelatedData',
      type: 'read',
      collectionId: this.context.collectionId,
      recordId: this.context.baseRecordRef.recordId,
    };
  }

  protected async doExecute(): Promise<StepExecutionResult> {
    // Branch A -- Re-entry after pending execution found in RunStore
    const pending = await this.patchAndReloadPendingData<LoadRelatedRecordStepExecutionData>(
      this.context.incomingPendingData,
    );

    if (pending) {
      const conf = pending.userConfirmation;

      if (conf?.userConfirmed === undefined && conf?.fieldName !== undefined) {
        return this.refreshCandidatesForField(pending, conf.fieldName);
      }

      return this.handleConfirmationFlow<LoadRelatedRecordStepExecutionData>(pending, async exec =>
        this.resolveFromSelection(exec),
      );
    }

    // Branches B & C -- First call
    return this.handleFirstCall();
  }

  private async refreshCandidatesForField(
    execution: LoadRelatedRecordStepExecutionData,
    fieldName: string,
  ): Promise<StepExecutionResult> {
    if (!execution.pendingData) {
      throw new StepStateError(`Step at index ${this.context.stepIndex} has no pending data`);
    }

    const schema = await this.getCollectionSchema(execution.selectedRecordRef.collectionName);
    const target = this.buildTarget(schema, fieldName, execution.selectedRecordRef);
    const { availableRecordIds, suggestedRecord } = await this.collectCandidateIds(target);

    await this.context.runStore.saveStepExecution(this.context.runId, {
      ...execution,
      userConfirmation: undefined,
      pendingData: {
        ...execution.pendingData,
        suggestedField: { name: target.name, displayName: target.displayName },
        availableRecordIds,
        suggestedRecord,
      },
    });

    return this.buildOutcomeResult({ status: 'awaiting-input' });
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
    const recordedRelation = preRecordedArgs?.relationName;
    const relationName =
      recordedRelation ?? (await this.selectRelation(schema, step.prompt)).relationName;
    const target = this.buildTarget(schema, relationName, selectedRecordRef);

    // Branch B -- fully automated execution
    if (step.executionType === StepExecutionMode.FullyAutomated) {
      return this.resolveAndLoadAutomatic(target);
    }

    // Branch C -- pre-fetch candidates, await user confirmation
    return this.saveAndAwaitInput(target, schema);
  }

  private buildTarget(
    schema: CollectionSchema,
    relationName: string,
    selectedRecordRef: RecordRef,
  ): RelationTarget {
    const field = this.findFieldByTechnicalName(schema, relationName);

    if (!field) {
      throw new RelationNotFoundError(relationName, schema.collectionName);
    }

    if (!field.relatedCollectionName) {
      throw new StepStateError(
        `Step at index ${this.context.stepIndex} could not resolve relatedCollectionName for relation "${relationName}"`,
      );
    }

    return {
      selectedRecordRef,
      displayName: field.displayName,
      name: field.fieldName,
      relationType: field.relationType,
      relatedCollectionName: field.relatedCollectionName,
    };
  }

  // Branch C: AI suggests the best candidate, then awaits user confirmation. Save errors
  // propagate directly — the relation-load hasn't run yet, so the step can be safely retried.
  private async saveAndAwaitInput(
    target: RelationTarget,
    sourceSchema: CollectionSchema,
  ): Promise<StepExecutionResult> {
    const { selectedRecordRef, name, displayName } = target;

    const { availableRecordIds, suggestedRecord } = await this.collectCandidateIds(target);

    const availableFields: RelationRef[] = sourceSchema.fields
      .filter(f => f.isRelationship)
      .map(f => ({ name: f.fieldName, displayName: f.displayName }));

    await this.context.runStore.saveStepExecution(this.context.runId, {
      type: 'load-related-record',
      stepIndex: this.context.stepIndex,
      pendingData: {
        availableFields,
        suggestedField: { name, displayName },
        availableRecordIds,
        suggestedRecord,
      },
      selectedRecordRef,
    });

    return this.buildOutcomeResult({ status: 'awaiting-input' });
  }

  private async collectCandidateIds(target: RelationTarget): Promise<{
    availableRecordIds: LoadRelatedRecordCandidate[];
    suggestedRecord?: LoadRelatedRecordCandidate;
  }> {
    if (target.relationType === 'BelongsTo' || target.relationType === 'HasOne') {
      const candidate = await this.fetchXToOneCandidate(target);

      return candidate
        ? { availableRecordIds: [candidate], suggestedRecord: candidate }
        : { availableRecordIds: [] };
    }

    const { relatedData, bestIndex, relatedSchema } = await this.selectBestFromRelatedData(
      target,
      50,
    );

    if (relatedData.length === 0) {
      return { availableRecordIds: [] };
    }

    const referenceField = relatedSchema.referenceField ?? null;
    const toCandidate = (r: RecordData): LoadRelatedRecordCandidate => ({
      recordId: r.recordId,
      referenceFieldValue: referenceField
        ? this.extractReferenceFieldValue(r.values, referenceField)
        : null,
    });

    return {
      availableRecordIds: relatedData.map(toCandidate),
      suggestedRecord: toCandidate(relatedData[bestIndex]),
    };
  }

  private extractReferenceFieldValue(
    values: Record<string, unknown>,
    referenceField: string,
  ): string | null {
    const v = values[referenceField];

    return v === undefined || v === null ? null : String(v);
  }

  /** Branch B: fully automated. xToOne loads the linked record; HasMany ranks candidates via AI; BelongsToMany takes the first. */
  private async resolveAndLoadAutomatic(target: RelationTarget): Promise<StepExecutionResult> {
    const record = await this.fetchRecordForRelation(target);

    return this.persistAndReturn(record, target, undefined);
  }

  private async fetchRecordForRelation(target: RelationTarget): Promise<RecordRef> {
    if (target.relationType === 'BelongsTo' || target.relationType === 'HasOne') {
      return this.fetchXToOneRecordRef(target);
    }

    if (target.relationType === 'HasMany') {
      return this.selectBestRelatedRecord(target);
    }

    return this.fetchFirstCandidate(target);
  }

  private async fetchXToOneRecordRef(target: RelationTarget): Promise<RecordRef> {
    const candidate = await this.fetchXToOneCandidate(target);

    if (!candidate) {
      throw new RelatedRecordNotFoundError(target.selectedRecordRef.collectionName, target.name);
    }

    return {
      collectionName: target.relatedCollectionName,
      recordId: candidate.recordId,
      stepIndex: this.context.stepIndex,
    };
  }

  private async fetchXToOneCandidate(
    target: RelationTarget,
  ): Promise<LoadRelatedRecordCandidate | null> {
    const relatedSchema = await this.getCollectionSchema(target.relatedCollectionName);
    const referenceField = relatedSchema.referenceField ?? null;

    const candidate = await this.agentPort.getSingleRelatedData(
      {
        collection: target.selectedRecordRef.collectionName,
        id: target.selectedRecordRef.recordId,
        relation: target.name,
        relatedSchema,
        ...(referenceField && { fields: [referenceField] }),
      },
      this.context.user,
    );

    if (!candidate) return null;

    return {
      recordId: candidate.recordId,
      referenceFieldValue: referenceField
        ? this.extractReferenceFieldValue(candidate.values, referenceField)
        : null,
    };
  }

  // Branch A: builds RecordRef from the user-confirmed selection without a new getRelatedData call.
  private async resolveFromSelection(
    execution: LoadRelatedRecordStepExecutionData,
  ): Promise<StepExecutionResult> {
    const { selectedRecordRef, pendingData, userConfirmation } = execution;

    if (!pendingData) {
      throw new StepStateError(`Step at index ${this.context.stepIndex} has no pending data`);
    }

    const relationRef = userConfirmation?.fieldName
      ? pendingData.availableFields.find(f => f.name === userConfirmation.fieldName)
      : pendingData.suggestedField;

    if (!relationRef) {
      throw new StepStateError(
        `Step at index ${this.context.stepIndex} could not resolve relation "${userConfirmation?.fieldName}" from available fields`,
      );
    }

    const { name, displayName } = relationRef;
    const selectedRecordId =
      userConfirmation?.selectedRecordId ?? pendingData.suggestedRecord?.recordId;

    if (!selectedRecordId) {
      throw new RelatedRecordNotFoundError(selectedRecordRef.collectionName, name);
    }

    // Re-derive relatedCollectionName from the live schema — frontend never sends it.
    const schema = await this.getCollectionSchema(selectedRecordRef.collectionName);
    const field = schema.fields.find(f => f.fieldName === name);

    if (!field?.relatedCollectionName) {
      throw new StepStateError(
        `Step at index ${this.context.stepIndex} could not resolve relatedCollectionName for relation "${name}"`,
      );
    }

    const record: RecordRef = {
      collectionName: field.relatedCollectionName,
      recordId: selectedRecordId,
      stepIndex: this.context.stepIndex,
    };

    return this.persistAndReturn(record, { selectedRecordRef, name, displayName }, execution);
  }

  private async selectBestFromRelatedData(
    target: Pick<RelationTarget, 'selectedRecordRef' | 'name' | 'relatedCollectionName'>,
    limit: number,
  ): Promise<{
    relatedData: RecordData[];
    bestIndex: number;
    suggestedFields: string[];
    relatedSchema: CollectionSchema;
  }> {
    const relatedSchema = await this.getCollectionSchema(target.relatedCollectionName);
    const relatedData = await this.fetchRelatedData(target, relatedSchema, limit);

    // Empty (bestIndex unused — callers guard on length) or single → no ranking needed.
    if (relatedData.length <= 1) {
      return { relatedData, bestIndex: 0, suggestedFields: [], relatedSchema };
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

      return {
        relatedData,
        bestIndex: preRecordedArgs.selectedRecordIndex,
        suggestedFields: [],
        relatedSchema,
      };
    }

    const suggestedFields = await this.selectRelevantFields(
      relatedSchema,
      this.context.stepDefinition.prompt,
    );
    const bestIndex = await this.selectBestRecordIndex(
      relatedData,
      suggestedFields,
      this.context.stepDefinition.prompt,
    );

    return { relatedData, bestIndex, suggestedFields, relatedSchema };
  }

  /** HasMany + fully automated execution: fetch top 50, then AI calls to select the best record. */
  private async selectBestRelatedRecord(target: RelationTarget): Promise<RecordRef> {
    const { relatedData, bestIndex } = await this.selectBestFromRelatedData(target, 50);

    if (relatedData.length === 0) {
      throw new RelatedRecordNotFoundError(target.selectedRecordRef.collectionName, target.name);
    }

    return this.toRecordRef(relatedData[bestIndex]);
  }

  private async fetchFirstCandidate(target: RelationTarget): Promise<RecordRef> {
    const candidates = await this.fetchCandidates(target, 1);

    return candidates[0];
  }

  private async fetchCandidates(
    target: Pick<RelationTarget, 'selectedRecordRef' | 'name' | 'relatedCollectionName'>,
    limit: number,
  ): Promise<RecordRef[]> {
    const { selectedRecordRef, name } = target;
    const relatedSchema = await this.getCollectionSchema(target.relatedCollectionName);
    const relatedData = await this.fetchRelatedData(target, relatedSchema, limit);

    if (relatedData.length === 0) {
      throw new RelatedRecordNotFoundError(selectedRecordRef.collectionName, name);
    }

    return relatedData.map(r => this.toRecordRef(r));
  }

  private async fetchRelatedData(
    target: Pick<RelationTarget, 'selectedRecordRef' | 'name'>,
    relatedSchema: CollectionSchema,
    limit: number,
  ): Promise<RecordData[]> {
    return this.agentPort.getRelatedData(
      {
        collection: target.selectedRecordRef.collectionName,
        id: target.selectedRecordRef.recordId,
        relation: target.name,
        relatedSchema,
        limit,
      },
      this.context.user,
    );
  }

  /** Persists the loaded record ref and returns a success outcome. */
  private async persistAndReturn(
    record: RecordRef,
    target: Pick<RelationTarget, 'selectedRecordRef' | 'name' | 'displayName'>,
    existingExecution: LoadRelatedRecordStepExecutionData | undefined,
  ): Promise<StepExecutionResult> {
    const { selectedRecordRef, name, displayName } = target;

    await this.context.runStore.saveStepExecution(this.context.runId, {
      ...existingExecution,
      type: 'load-related-record',
      stepIndex: this.context.stepIndex,
      executionParams: { displayName, name },
      executionResult: { relation: { name, displayName }, record },
      selectedRecordRef,
    });

    return this.buildOutcomeResult({ status: 'success' });
  }

  // The AI selects by displayName; map it back to the technical relation name so the rest of the
  // flow (buildTarget) works in technical-name space, like a pre-recorded reference.
  private async selectRelation(
    schema: CollectionSchema,
    prompt: string | undefined,
  ): Promise<{ relationName: string }> {
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

    const { relationName } = await this.invokeWithTool<{ relationName: string; reasoning: string }>(
      messages,
      tool,
    );

    return { relationName: this.resolveAiFieldName(schema, relationName) };
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
          .max(MAX_RELEVANT_FIELDS)
          .describe(
            `The ${MAX_RELEVANT_FIELDS} fields most useful for identifying the relevant record`,
          ),
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
    // .max() shapes the prompt only (not validated against the response), so cap explicitly.
    return selectedDisplayNames
      .slice(0, MAX_RELEVANT_FIELDS)
      .map(dn => nonRelationFields.find(f => f.displayName === dn)?.fieldName ?? dn);
  }

  /** AI call 2 for HasMany: selects the best record by index from the candidate list. */
  private async selectBestRecordIndex(
    candidates: RecordData[],
    fieldNames: string[],
    prompt: string | undefined,
  ): Promise<number> {
    const filteredCandidates = candidates.map((c, i) => {
      const entries = Object.entries(c.values).filter(
        ([k]) => fieldNames.length === 0 || fieldNames.includes(k),
      );

      return {
        index: i,
        values: Object.fromEntries(entries.map(([k, v]) => [k, clampFieldValue(v)])),
      };
    });

    // Bound the prompt only — the full candidate list is still returned upstream. Accumulate
    // lines until the global budget is reached (always keep at least the first candidate).
    const lines: string[] = [];
    let usedChars = 0;

    for (const c of filteredCandidates) {
      const line = `[${c.index}] ${JSON.stringify(c.values)}`;
      if (lines.length > 0 && usedChars + line.length > MAX_AI_CANDIDATES_CHARS) break;
      lines.push(line);
      usedChars += line.length + 1;
    }

    const shown = lines.length;

    if (shown < candidates.length) {
      this.context.logger.warn('load-related-record: candidate list truncated for AI prompt', {
        ...this.logCtx,
        shown,
        total: candidates.length,
      });
    }

    const maxIndex = shown - 1;
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

    const messages = [
      this.buildContextMessage(),
      new SystemMessage(SELECT_RECORD_SYSTEM_PROMPT),
      new SystemMessage(`Candidates:\n${lines.join('\n')}`),
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
