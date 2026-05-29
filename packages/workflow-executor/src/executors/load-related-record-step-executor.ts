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

import { restoreFieldNames } from '../adapters/agent-client-agent-port';
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

interface RelationTarget extends RelationRef {
  selectedRecordRef: RecordRef;
  relationType?: 'BelongsTo' | 'HasMany' | 'HasOne' | 'BelongsToMany';
  relatedCollectionName: string;
  // Primary key field name on the related collection — supplied by the orchestrator's
  // schema. Required for the xToOne projection syntax ('<relation>@@@<pk>').
  relatedPrimaryKey?: string;
}

export default class LoadRelatedRecordStepExecutor extends RecordStepExecutor<LoadRelatedRecordStepDefinition> {
  protected override buildActivityLogArgs(): CreateActivityLogArgs | null {
    return {
      renderingId: this.context.user.renderingId,
      action: 'listRelatedData',
      type: 'read',
      collectionId: this.context.collectionId,
      recordId: this.context.baseRecordRef.recordId[0],
    };
  }

  protected async doExecute(): Promise<StepExecutionResult> {
    // Branch A -- Re-entry after pending execution found in RunStore
    const pending = await this.patchAndReloadPendingData<LoadRelatedRecordStepExecutionData>(
      this.context.incomingPendingData,
    );

    if (pending) {
      // Branch A-preview -- user switched relation without confirming: re-list candidates
      // for the new relation, refresh pendingData, stay awaiting-input. Detected by a
      // patch carrying `fieldDisplayName` but no `userConfirmed`.
      const conf = pending.userConfirmation;

      if (conf?.userConfirmed === undefined && conf?.fieldDisplayName !== undefined) {
        return this.refreshCandidatesForField(pending, conf.fieldDisplayName);
      }

      return this.handleConfirmationFlow<LoadRelatedRecordStepExecutionData>(pending, async exec =>
        this.resolveFromSelection(exec),
      );
    }

    // Branches B & C -- First call
    return this.handleFirstCall();
  }

  // Branch A-preview: refresh pendingData for a different relation. Reuses the same
  // candidate collection used on the first call so xToOne / HasMany / BelongsToMany
  // all stay consistent. The userConfirmation is cleared so a subsequent trigger
  // without a body re-emits awaiting-input cleanly via handleConfirmationFlow.
  private async refreshCandidatesForField(
    execution: LoadRelatedRecordStepExecutionData,
    fieldDisplayName: string,
  ): Promise<StepExecutionResult> {
    if (!execution.pendingData) {
      throw new StepStateError(`Step at index ${this.context.stepIndex} has no pending data`);
    }

    const schema = await this.getCollectionSchema(execution.selectedRecordRef.collectionName);
    const target = this.buildTarget(schema, fieldDisplayName, execution.selectedRecordRef);
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
    const args = preRecordedArgs?.relationDisplayName
      ? { relationName: preRecordedArgs.relationDisplayName }
      : await this.selectRelation(schema, step.prompt);
    const target = this.buildTarget(schema, args.relationName, selectedRecordRef);

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
    const field = this.findField(schema, relationName);

    if (!field) {
      throw new RelationNotFoundError(relationName, schema.collectionName);
    }

    return {
      selectedRecordRef,
      displayName: field.displayName,
      name: field.fieldName,
      relationType: field.relationType,
      relatedCollectionName: field.relatedCollectionName ?? field.fieldName,
      relatedPrimaryKey: field.relatedPrimaryKey,
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

  // Branch C: collects the recordIds the frontend can present to the user, plus the
  // AI's suggested pick. xToOne has exactly one candidate (no AI ranking needed);
  // to-many goes through getRelatedData + the existing field/record AI selection.
  // When the related collection has a layout-level `referenceField` configured, the
  // candidates also carry its value so the frontend can display human-readable labels
  // (e.g. "John Doe") instead of raw record ids.
  private async collectCandidateIds(target: RelationTarget): Promise<{
    availableRecordIds: LoadRelatedRecordCandidate[];
    suggestedRecord: LoadRelatedRecordCandidate;
  }> {
    if (target.relationType === 'BelongsTo' || target.relationType === 'HasOne') {
      const candidate = await this.fetchXToOneCandidate(target);

      return { availableRecordIds: [candidate], suggestedRecord: candidate };
    }

    const { relatedData, bestIndex, relatedSchema } = await this.selectBestFromRelatedData(
      target,
      50,
    );
    const referenceField = relatedSchema.referenceField ?? null;
    const toCandidate = (r: RecordData): LoadRelatedRecordCandidate => ({
      recordId: r.recordId,
      // `referenceField` is a fieldName on the related collection. fetchRelatedData
      // has already restored field names from camelCase, so reading r.values[field]
      // works for both `name` and `full_name` style identifiers. Coerce to string —
      // the agent may return numbers/dates/etc. for display fields.
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

  /** Branch B: automatic execution. HasMany uses 2 AI calls; others take the first result. */
  private async resolveAndLoadAutomatic(target: RelationTarget): Promise<StepExecutionResult> {
    const record = await this.fetchRecordForRelation(target);

    return this.persistAndReturn(record, target, undefined);
  }

  // Dispatches by relation type: xToOne reads the FK from the parent (no /relationships
  // route exists on the agent for ManyToOne/OneToOne); HasMany uses AI selection; the
  // remaining to-many shapes take the first /relationships result.
  private async fetchRecordForRelation(target: RelationTarget): Promise<RecordRef> {
    if (target.relationType === 'BelongsTo' || target.relationType === 'HasOne') {
      return this.fetchXToOneRecordRef(target);
    }

    if (target.relationType === 'HasMany') {
      return this.selectBestRelatedRecord(target);
    }

    return this.fetchFirstCandidate(target);
  }

  // For ManyToOne/OneToOne: project the relation on the parent record. Forest projection
  // syntax requires at least one related field per relation, so we project the related
  // collection's primary key (`<relation>@@@<pk>`) and, when configured, also the
  // reference field for display. The orchestrator supplies both names alongside the
  // schema — no extra getCollectionSchema fetch needed here. The agent's JSON:API
  // serializer fills the relationship's `data.id` with the *full* related primary key
  // (packed with "|" for composite keys) regardless of which fields we project, so
  // split('|') gives back the complete recordId.
  private async fetchXToOneRecordRef(target: RelationTarget): Promise<RecordRef> {
    const candidate = await this.fetchXToOneCandidate(target);

    return {
      collectionName: target.relatedCollectionName,
      recordId: candidate.recordId,
      stepIndex: this.context.stepIndex,
    };
  }

  // Same projection logic as fetchXToOneRecordRef, but also extracts the related
  // collection's reference-field value (when configured) so the frontend can render
  // a human-readable label in the awaiting-input dropdown.
  private async fetchXToOneCandidate(target: RelationTarget): Promise<LoadRelatedRecordCandidate> {
    if (!target.relatedPrimaryKey) {
      throw new StepStateError(
        `Cannot load xToOne relation "${target.name}" on collection ` +
          `"${target.selectedRecordRef.collectionName}": missing relatedPrimaryKey in schema.`,
      );
    }

    // Resolve the related schema for the optional referenceField. Cached after the first
    // lookup, so the extra fetch only pays once per related collection per run.
    const relatedSchema = await this.getCollectionSchema(target.relatedCollectionName);
    const referenceField = relatedSchema.referenceField ?? null;
    const fields = [`${target.name}@@@${target.relatedPrimaryKey}`];

    if (referenceField && referenceField !== target.relatedPrimaryKey) {
      fields.push(`${target.name}@@@${referenceField}`);
    }

    const parent = await this.agentPort.getRecord(
      {
        collection: target.selectedRecordRef.collectionName,
        id: target.selectedRecordRef.recordId,
        fields,
      },
      this.context.user,
    );

    // Restore field names from camelCase to original format (e.g., snake_case) so that
    // relations with underscores in their names (e.g., `customer_order`) are correctly accessed.
    const sourceSchema = await this.getCollectionSchema(target.selectedRecordRef.collectionName);
    const restoredValues = restoreFieldNames(
      parent.values,
      sourceSchema.fields.map(f => f.fieldName),
    );

    const relation = restoredValues[target.name] as Record<string, unknown> | null | undefined;
    const packedId = relation?.id as string | undefined;

    if (!packedId) {
      throw new RelatedRecordNotFoundError(target.selectedRecordRef.collectionName, target.name);
    }

    return {
      recordId: packedId.split('|'),
      referenceFieldValue: referenceField
        ? this.extractReferenceFieldValue(relation as Record<string, unknown>, referenceField)
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

    // If the user switched relations, look up the chosen displayName in availableFields to
    // recover its frozen technical name. Otherwise fall back to the AI's suggestion.
    const relationRef = userConfirmation?.fieldDisplayName
      ? pendingData.availableFields.find(f => f.displayName === userConfirmation.fieldDisplayName)
      : pendingData.suggestedField;

    if (!relationRef) {
      throw new StepStateError(
        `Step at index ${this.context.stepIndex} could not resolve relation "${userConfirmation?.fieldDisplayName}" from available fields`,
      );
    }

    const { name, displayName } = relationRef;
    // suggestedRecord is a LoadRelatedRecordCandidate; only the recordId is needed here.
    // The reference-field value is purely for display in awaiting-input and never persisted
    // on the final RecordRef.
    const selectedRecordId =
      userConfirmation?.selectedRecordId ?? pendingData.suggestedRecord.recordId;

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
    const { selectedRecordRef, name } = target;
    const relatedSchema = await this.getCollectionSchema(target.relatedCollectionName);
    const relatedData = await this.fetchRelatedData(target, relatedSchema, limit);

    if (relatedData.length === 0) {
      throw new RelatedRecordNotFoundError(selectedRecordRef.collectionName, name);
    }

    if (relatedData.length === 1) {
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

    return this.toRecordRef(relatedData[bestIndex]);
  }

  /** BelongsTo / HasOne: fetch 1 record and take it directly. */
  private async fetchFirstCandidate(target: RelationTarget): Promise<RecordRef> {
    const candidates = await this.fetchCandidates(target, 1);

    return candidates[0];
  }

  // Throws RelatedRecordNotFoundError when the result is empty.
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

  // Calls the agent port and maps raw rows → RecordData using the related collection's schema.
  // Schema is resolved by the caller so the cache is warmed via getCollectionSchema (which
  // falls back to workflowPort), avoiding the silent ["id"] PK fallback the port used to do.
  private async fetchRelatedData(
    target: Pick<RelationTarget, 'selectedRecordRef' | 'name'>,
    relatedSchema: CollectionSchema,
    limit: number,
  ): Promise<RecordData[]> {
    const rows = await this.agentPort.getRelatedData(
      {
        collection: target.selectedRecordRef.collectionName,
        id: target.selectedRecordRef.recordId,
        relation: target.name,
        limit,
      },
      this.context.user,
    );

    return rows.map(row => {
      const restored = restoreFieldNames(
        row,
        relatedSchema.fields.map(f => f.fieldName),
      );

      return {
        collectionName: relatedSchema.collectionName,
        recordId: relatedSchema.primaryKeyFields.map(f => restored[f] as string | number),
        values: restored,
      };
    });
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
