import type { StepExecutionResult } from '../types/execution-context';
import type {
  LoadRelatedRecordCandidate,
  LoadRelatedRecordStepExecutionData,
  RelationRef,
} from '../types/step-execution-data';
import type {
  CollectionSchema,
  FieldSchema,
  RecordData,
  RecordRef,
} from '../types/validated/collection';
import type { LoadRelatedRecordStepDefinition } from '../types/validated/step-definition';

import { DynamicStructuredTool, HumanMessage, SystemMessage } from '@forestadmin/ai-proxy';
import { z } from 'zod';

import {
  AiAssistUnavailableError,
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
You are given relations to follow, each shown as "<source record> → <relation> (→ <target collection>)".
Choose the relation that LEADS TO the collection the user wants to load — decide from each
relation's target collection, NOT from which source record happens to resemble the request.

Important rules:
- Pick the relation whose target collection matches the requested record.
- Final answer is definitive, you won't receive any other input from the user.
- Do not refer to yourself as "I" in the response, use a passive formulation instead.`;

const SELECT_FIELDS_SYSTEM_PROMPT = `You are an AI agent selecting the most relevant fields to identify a related record.
Choose the fields that are most useful for determining which record best matches the user request.`;

const SELECT_RECORD_SYSTEM_PROMPT = `You are an AI agent selecting the most relevant related record from a list of candidates.
Choose the record that best matches the user request based on the provided field values.`;

// Only appended when -1 is a valid answer. The base prompt tells the AI to always pick, so without
// this it forces a weak match on an impossible request instead of declining.
const SELECT_RECORD_NONE_ALLOWED_PROMPT = `If the request states a specific requirement that NO candidate satisfies, return -1 instead of forcing an arbitrary or loosely-related match. Do NOT return -1 merely because a match is imperfect — only when no candidate genuinely fits the request.`;

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

// A relationship reachable from one available record — the unit the AI chooses among.
// `relatedCollectionName` is guaranteed non-null (buildRelationCandidates resolves it, statically
// or — for polymorphic relations — per record from the discriminator).
interface RelationCandidate {
  record: RecordRef;
  schema: CollectionSchema;
  field: FieldSchema & { relatedCollectionName: string };
}

// Followable = has a static target (relatedCollectionName) or is a polymorphic relation resolvable
// per record (polymorphicTypeField names the discriminator). The concrete target is resolved later.
function isFollowableRelation(field: FieldSchema): boolean {
  return field.isRelationship && Boolean(field.relatedCollectionName || field.polymorphicTypeField);
}

export default class LoadRelatedRecordStepExecutor extends RecordStepExecutor<LoadRelatedRecordStepDefinition> {
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
    if (!execution.pendingData || !execution.selectedRecordRef) {
      throw new StepStateError(`Step at index ${this.context.stepIndex} has no pending data`);
    }

    const useAi = this.context.stepDefinition.executionType !== StepExecutionMode.Manual;
    const schema = await this.getCollectionSchema(execution.selectedRecordRef.collectionName);
    const target = await this.buildTarget(schema, fieldName, execution.selectedRecordRef);

    // AI failure while re-listing → degrade to the no-AI list, not a run error (see AiAssistUnavailableError).
    let aiSuggested = useAi;
    let candidates;

    try {
      candidates = await this.collectCandidateIds(target, useAi);
    } catch (error) {
      if (!(useAi && error instanceof AiAssistUnavailableError)) throw error;
      this.logAiDegrade(error.reason);
      aiSuggested = false;
      candidates = await this.collectCandidateIds(target, false);
    }

    const { availableRecordIds, suggestedRecord } = candidates;

    await this.context.runStore.saveStepExecution(this.context.runId, {
      ...execution,
      userConfirmation: undefined,
      // Rebuild pendingData for the new relation from scratch (retain only the immutable field list)
      // so no stale suggestion state — suggestedRecord or suggestNoRecord — survives the field switch.
      pendingData: {
        availableFields: execution.pendingData.availableFields,
        suggestedField: { name: target.name, displayName: target.displayName },
        availableRecordIds,
        suggestedRecord,
        ...(aiSuggested && !suggestedRecord && { suggestNoRecord: true }),
      },
    });

    return this.buildOutcomeResult({ status: 'awaiting-input' });
  }

  private async handleFirstCall(): Promise<StepExecutionResult> {
    const { stepDefinition: step } = this.context;
    const useAi = step.executionType !== StepExecutionMode.Manual;

    try {
      if (step.executionType === StepExecutionMode.FullyAutomated) {
        return await this.resolveAndLoadAutomatic();
      }

      const target = await this.resolveTarget(useAi);
      const sourceSchema = await this.getCollectionSchema(target.selectedRecordRef.collectionName);

      return await this.saveAndAwaitInput(target, sourceSchema, useAi);
    } catch (error) {
      // AI failure in any AI mode → degrade to Manual (see AiAssistUnavailableError).
      if (useAi && error instanceof AiAssistUnavailableError) {
        this.logAiDegrade(error.reason);

        return this.degradeToManualAwaitInput();
      }

      throw error;
    }
  }

  // The re-run is AI-free (first eligible relation, no-AI list), so it can't re-trigger the failure.
  private async degradeToManualAwaitInput(): Promise<StepExecutionResult> {
    const target = await this.resolveTarget(false);
    const sourceSchema = await this.getCollectionSchema(target.selectedRecordRef.collectionName);

    return this.saveAndAwaitInput(target, sourceSchema, false);
  }

  // Picks the (record, relation) pair to follow. Unlike a separate record-then-relation choice,
  // this lets the AI decide by what each relation LEADS TO — so "load the dvd" follows
  // store→dvds rather than latching onto a previously-loaded dvd whose collection just matches.
  private async resolveTarget(useAi: boolean): Promise<RelationTarget> {
    const { preRecordedArgs } = this.context.stepDefinition;

    const sourceRecords =
      preRecordedArgs?.selectedRecordStepId !== undefined
        ? [await this.resolveSourceRecordRef(preRecordedArgs.selectedRecordStepId)]
        : await this.getAvailableRecordRefs();

    const candidates = await this.buildRelationCandidates(sourceRecords);

    if (candidates.length === 0) {
      throw new NoRelationshipFieldsError(sourceRecords[0]?.collectionName ?? 'unknown');
    }

    // Pre-recorded relations are pinned by their stable technical name, matched exactly.
    const pinned = preRecordedArgs?.relationName;
    const eligible = pinned ? candidates.filter(c => c.field.fieldName === pinned) : candidates;

    if (eligible.length === 0) {
      // Relations exist, but the pre-recorded one doesn't match any of them.
      throw new InvalidPreRecordedArgsError(
        `No relation matching "${pinned}" on the selected record`,
      );
    }

    // No-AI path picks eligible[0] — the base record's first relation (getAvailableRecordRefs lists
    // it first). The user switches relation at runtime; a non-base source needs selectedRecordStepId pinning.
    const chosen =
      eligible.length > 1 && useAi ? await this.selectRelationToFollow(eligible) : eligible[0];

    return this.targetFromCandidate(chosen);
  }

  private targetFromCandidate(candidate: RelationCandidate): RelationTarget {
    const { record, field } = candidate;

    return {
      selectedRecordRef: record,
      displayName: field.displayName,
      name: field.fieldName,
      relationType: field.relationType,
      relatedCollectionName: field.relatedCollectionName,
    };
  }

  private async buildRelationCandidates(records: RecordRef[]): Promise<RelationCandidate[]> {
    const candidates: RelationCandidate[] = [];

    for (const record of records) {
      // eslint-disable-next-line no-await-in-loop
      const schema = await this.getCollectionSchema(record.collectionName);

      for (const field of schema.fields) {
        if (isFollowableRelation(field)) {
          // eslint-disable-next-line no-await-in-loop
          const relatedCollectionName = await this.resolveTargetCollection(field, record);

          // A polymorphic relation with no linked target on this record can't be followed → skip it.
          if (relatedCollectionName) {
            candidates.push({ record, schema, field: { ...field, relatedCollectionName } });
          }
        }
      }
    }

    return candidates;
  }

  // Resolves the concrete target collection of a relation for a given source record, or null when
  // it can't be followed. Static relations expose `relatedCollectionName`; multi-target polymorphic
  // ones expose only `polymorphicTypeField` + candidate models, so the linkage type is read per
  // record and mapped to one of the candidates.
  private async resolveTargetCollection(
    field: FieldSchema,
    record: RecordRef,
  ): Promise<string | null> {
    if (field.relatedCollectionName) return field.relatedCollectionName;
    if (!field.polymorphicTypeField) return null;

    const linkage = await this.context.agent.resolvePolymorphicType({
      collection: record.collectionName,
      id: record.recordId,
      relation: field.fieldName,
    });
    const discriminator = linkage?.type;
    if (!discriminator) return null;

    const models = field.polymorphicReferencedModels ?? [];

    return (
      models.find(m => m === discriminator) ??
      models.find(m => m.toLowerCase() === discriminator.toLowerCase()) ??
      null
    );
  }

  private async buildTarget(
    schema: CollectionSchema,
    relationName: string,
    selectedRecordRef: RecordRef,
  ): Promise<RelationTarget> {
    const field = this.findFieldByTechnicalName(schema, relationName);

    if (!field) {
      throw new RelationNotFoundError(relationName, schema.collectionName);
    }

    const relatedCollectionName = await this.resolveTargetCollection(field, selectedRecordRef);

    if (!relatedCollectionName) {
      throw new StepStateError(
        `Step at index ${this.context.stepIndex} could not resolve relatedCollectionName for relation "${relationName}"`,
      );
    }

    return {
      selectedRecordRef,
      displayName: field.displayName,
      name: field.fieldName,
      relationType: field.relationType,
      relatedCollectionName,
    };
  }

  // Save errors propagate directly — the relation-load hasn't run yet, so the step can be retried.
  private async saveAndAwaitInput(
    target: RelationTarget,
    sourceSchema: CollectionSchema,
    suggestViaAi: boolean,
  ): Promise<StepExecutionResult> {
    const { availableRecordIds, suggestedRecord } = await this.collectCandidateIds(
      target,
      suggestViaAi,
    );

    return this.persistAwaitInput(target, sourceSchema, {
      availableRecordIds,
      suggestedRecord,
      // An AI pass that yields no record is a deliberate "nothing relevant" → pre-check "No X to load".
      // A Manual pass with no suggestion just means the user picks, so no pre-check.
      suggestNoRecord: suggestViaAi && !suggestedRecord,
    });
  }

  private followableRelationFields(sourceSchema: CollectionSchema): RelationRef[] {
    return sourceSchema.fields
      .filter(isFollowableRelation)
      .map(f => ({ name: f.fieldName, displayName: f.displayName }));
  }

  private async persistAwaitInput(
    target: RelationTarget,
    sourceSchema: CollectionSchema,
    pending: {
      availableRecordIds: LoadRelatedRecordCandidate[];
      suggestedRecord?: LoadRelatedRecordCandidate;
      suggestNoRecord: boolean;
    },
  ): Promise<StepExecutionResult> {
    const { selectedRecordRef, name, displayName } = target;

    await this.context.runStore.saveStepExecution(this.context.runId, {
      type: 'load-related-record',
      stepIndex: this.context.stepIndex,
      pendingData: {
        availableFields: this.followableRelationFields(sourceSchema),
        suggestedField: { name, displayName },
        availableRecordIds: pending.availableRecordIds,
        suggestedRecord: pending.suggestedRecord,
        ...(pending.suggestNoRecord && { suggestNoRecord: true }),
      },
      selectedRecordRef,
    });

    return this.buildOutcomeResult({ status: 'awaiting-input' });
  }

  private async collectCandidateIds(
    target: RelationTarget,
    suggestViaAi: boolean,
  ): Promise<{
    availableRecordIds: LoadRelatedRecordCandidate[];
    suggestedRecord?: LoadRelatedRecordCandidate;
    // Full AI only: the AI returned a best guess but could not confidently single one out among
    // several viable candidates. Routes Full AI to a confirmation instead of an auto-load.
    ambiguous: boolean;
  }> {
    if (target.relationType === 'BelongsTo' || target.relationType === 'HasOne') {
      const candidate = await this.fetchXToOneCandidate(target);

      return candidate
        ? { availableRecordIds: [candidate], suggestedRecord: candidate, ambiguous: false }
        : { availableRecordIds: [], ambiguous: false };
    }

    const { relatedData, bestIndex, confident, relatedSchema } =
      await this.selectBestFromRelatedData(
        target,
        50,
        // allowNone: the AI may judge no candidate relevant (→ "No X to load"); only meaningful when
        // ranking (Manual passes rank=false and never calls the AI).
        suggestViaAi ? { rank: true, allowNone: true } : { rank: false },
      );

    if (relatedData.length === 0) {
      return { availableRecordIds: [], ambiguous: false };
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
      suggestedRecord: bestIndex >= 0 ? toCandidate(relatedData[bestIndex]) : undefined,
      // -1 (none relevant) is not ambiguity; only a low-confidence positive pick is.
      ambiguous: bestIndex >= 0 && !confident,
    };
  }

  private extractReferenceFieldValue(
    values: Record<string, unknown>,
    referenceField: string,
  ): string | null {
    const v = values[referenceField];

    return v === undefined || v === null ? null : String(v);
  }

  private async resolveAndLoadAutomatic(): Promise<StepExecutionResult> {
    // No source record throws (like Manual/AI-assisted) → the front offers "continue without".
    const target = await this.resolveTarget(true);
    const { availableRecordIds, suggestedRecord, ambiguous } = await this.collectCandidateIds(
      target,
      true,
    );

    // Full AI with no candidate at all: a human couldn't pick one either, so continue without a
    // record (skip) instead of handing off to AI-assisted (PRD-751 decision).
    if (availableRecordIds.length === 0) {
      return this.persistSkip(target);
    }

    // Otherwise Full AI auto-loads only a confident single pick; a non-empty list with no confident
    // pick (ambiguous, or the AI judged none relevant) degrades to an AI-assisted confirmation
    // ("No X to load" pre-checked when the AI found nothing relevant, else its best guess).
    if (!suggestedRecord || ambiguous) {
      const sourceSchema = await this.getCollectionSchema(target.selectedRecordRef.collectionName);

      return this.persistAwaitInput(target, sourceSchema, {
        availableRecordIds,
        suggestedRecord,
        suggestNoRecord: !suggestedRecord,
      });
    }

    const record: RecordRef = {
      collectionName: target.relatedCollectionName,
      recordId: suggestedRecord.recordId,
      stepIndex: this.context.stepIndex,
    };

    // Persist the candidates as pendingData on the completed step so the front's record dropdown keeps
    // each candidate's referenceFieldValue label; without it Full AI's auto-load falls back to the
    // raw recordId (AI-assisted already carries this through its await-then-confirm execution).
    const sourceSchema = await this.getCollectionSchema(target.selectedRecordRef.collectionName);

    return this.persistAndReturn(record, target, {
      type: 'load-related-record',
      stepIndex: this.context.stepIndex,
      pendingData: {
        availableFields: this.followableRelationFields(sourceSchema),
        suggestedField: { name: target.name, displayName: target.displayName },
        availableRecordIds,
        suggestedRecord,
      },
    });
  }

  private async fetchXToOneCandidate(
    target: RelationTarget,
  ): Promise<LoadRelatedRecordCandidate | null> {
    const relatedSchema = await this.getCollectionSchema(target.relatedCollectionName);
    const referenceField = relatedSchema.referenceField ?? null;

    const candidate = await this.context.agent.getSingleRelatedData({
      collection: target.selectedRecordRef.collectionName,
      id: target.selectedRecordRef.recordId,
      relation: target.name,
      relatedSchema,
      ...(referenceField && { fields: [referenceField] }),
    });

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

    if (!pendingData || !selectedRecordRef) {
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

    // Re-derive the target collection from the live schema — frontend never sends it. Handles both
    // static relations and polymorphic ones (resolved per record from the discriminator).
    const schema = await this.getCollectionSchema(selectedRecordRef.collectionName);
    const field = schema.fields.find(f => f.fieldName === name);
    const relatedCollectionName =
      field && (await this.resolveTargetCollection(field, selectedRecordRef));

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

  private async selectBestFromRelatedData(
    target: Pick<RelationTarget, 'selectedRecordRef' | 'name' | 'relatedCollectionName'>,
    limit: number,
    // allowNone is meaningful only when ranking, so it's absent from the rank:false variant.
    opts: { rank: true; allowNone: boolean } | { rank: false } = { rank: true, allowNone: false },
  ): Promise<{
    relatedData: RecordData[];
    bestIndex: number;
    // Whether the suggested record is a confident pick. Deterministic/short-circuit paths (single
    // candidate, no ranking) are confident by construction; the ranked path reflects the AI's flag.
    confident: boolean;
    suggestedFields: string[];
    relatedSchema: CollectionSchema;
  }> {
    const relatedSchema = await this.getCollectionSchema(target.relatedCollectionName);
    const relatedData = await this.fetchRelatedData(target, relatedSchema, limit);

    // Empty lists have nothing to rank or pre-select.
    if (relatedData.length === 0) {
      return { relatedData, bestIndex: -1, confident: true, suggestedFields: [], relatedSchema };
    }

    // Manual: no AI. A sole candidate is pre-selected (the only possible choice, as for an xToOne
    // relation); with several, the user picks from the list.
    if (!opts.rank) {
      return {
        relatedData,
        bestIndex: relatedData.length === 1 ? 0 : -1,
        confident: true,
        suggestedFields: [],
        relatedSchema,
      };
    }

    // Ranking (AI-assisted / Full AI): even a lone candidate goes through the AI so Full AI can
    // decline it (-1 → "No X to load") rather than auto-loading a possibly-irrelevant sole record.

    // The final record stays AI-suggested + user-confirmed (or AI-decided in Full AI): only the
    // source and relation are pinned deterministically, not the record index (not revise-safe).
    const suggestedFields = await this.withAiAssist(() =>
      this.selectRelevantFields(relatedSchema, this.context.stepDefinition.prompt),
    );
    const { index: bestIndex, confident } = await this.withAiAssist(() =>
      this.selectBestRecordIndex(
        relatedData,
        suggestedFields,
        this.context.stepDefinition.prompt,
        opts.allowNone,
      ),
    );

    return { relatedData, bestIndex, confident, suggestedFields, relatedSchema };
  }

  private async fetchRelatedData(
    target: Pick<RelationTarget, 'selectedRecordRef' | 'name'>,
    relatedSchema: CollectionSchema,
    limit: number,
  ): Promise<RecordData[]> {
    return this.context.agent.getRelatedData({
      collection: target.selectedRecordRef.collectionName,
      id: target.selectedRecordRef.recordId,
      relation: target.name,
      relatedSchema,
      limit,
      filters: this.context.stepDefinition.preRecordedArgs?.filters,
    });
  }

  private async persistSkip(
    target: Pick<RelationTarget, 'selectedRecordRef' | 'name' | 'displayName'>,
  ): Promise<StepExecutionResult> {
    // Full AI made this call on its own — log it so an unexpectedly empty relation is auditable.
    this.context.logger(
      'Info',
      'load-related-record: no candidate to load, continuing without a record',
      { ...this.logCtx, relation: target.name },
    );

    await this.context.runStore.saveStepExecution(this.context.runId, {
      type: 'load-related-record',
      stepIndex: this.context.stepIndex,
      executionParams: { name: target.name, displayName: target.displayName },
      executionResult: { skipped: true },
      selectedRecordRef: target.selectedRecordRef,
    });

    return this.buildOutcomeResult({ status: 'success' });
  }

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

  private relationOptionLabel(candidate: RelationCandidate): string {
    const { record, schema, field } = candidate;

    return `Step ${record.stepIndex} - ${schema.collectionDisplayName} #${record.recordId} → ${field.displayName} (→ ${field.relatedCollectionName})`;
  }

  private async selectRelationToFollow(
    candidates: RelationCandidate[],
  ): Promise<RelationCandidate> {
    const labels = candidates.map(c => this.relationOptionLabel(c));
    const labelTuple = labels as [string, ...string[]];

    const tool = new DynamicStructuredTool({
      name: 'select-relation-to-follow',
      description: 'Select the relation to follow to load the requested related record.',
      schema: z.object({
        relation: z
          .enum(labelTuple)
          .describe('The relation to follow, chosen by the collection it leads to'),
        reasoning: z.string().describe('Why this relation leads to the requested record'),
      }),
      func: undefined,
    });

    const messages = [
      this.buildContextMessage(),
      ...(await this.buildPreviousStepsMessages()),
      new SystemMessage(SELECT_RELATION_SYSTEM_PROMPT),
      new HumanMessage(
        `**Request**: ${this.context.stepDefinition.prompt ?? 'Load the relevant related record.'}`,
      ),
    ];

    // Wrap only the AI call + response validation: buildPreviousStepsMessages above reads the run
    // store, and a store failure must surface, not be mistagged as an AI failure and degraded.
    return this.withAiAssist(async () => {
      const { relation } = await this.invokeWithTool<{ relation: string; reasoning: string }>(
        messages,
        tool,
      );

      const index = labels.indexOf(relation);

      if (index === -1) {
        throw new InvalidAIResponseError(
          `AI selected relation "${relation}" which does not match any available option`,
        );
      }

      return candidates[index];
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

  private async selectBestRecordIndex(
    candidates: RecordData[],
    fieldNames: string[],
    prompt: string | undefined,
    allowNone = false,
  ): Promise<{ index: number; confident: boolean }> {
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

    const truncated = shown < candidates.length;

    if (truncated) {
      this.context.logger('Warn', 'load-related-record: candidate list truncated for AI prompt', {
        ...this.logCtx,
        shown,
        total: candidates.length,
      });
    }

    // "None relevant" (-1) is only trustworthy when the AI saw the whole list. If it was truncated,
    // force a pick from what was shown — otherwise a match in the unseen tail would be silently skipped.
    const noneAllowed = allowNone && !truncated;
    const maxIndex = shown - 1;
    const minIndex = noneAllowed ? -1 : 0;
    const tool = new DynamicStructuredTool({
      name: 'select-record-by-content',
      description: 'Select the most relevant related record by its index.',
      schema: z.object({
        recordIndex: z
          .number()
          .int()
          .min(minIndex)
          .max(maxIndex)
          .describe(
            noneAllowed
              ? `0-based index of the most relevant record (0 to ${maxIndex}), or -1 if none of the candidates is relevant`
              : `0-based index of the most relevant record (0 to ${maxIndex})`,
          ),
        confident: z
          .boolean()
          .describe(
            'true when one candidate clearly best matches the request; false when several ' +
              'candidates fit similarly well and you cannot confidently single one out',
          ),
        reasoning: z.string().describe('Why this record was chosen (or why none is relevant)'),
      }),
      func: undefined,
    });

    const messages = [
      this.buildContextMessage(),
      new SystemMessage(SELECT_RECORD_SYSTEM_PROMPT),
      ...(noneAllowed ? [new SystemMessage(SELECT_RECORD_NONE_ALLOWED_PROMPT)] : []),
      new SystemMessage(`Candidates:\n${lines.join('\n')}`),
      new HumanMessage(`**Request**: ${prompt ?? 'Select the most relevant record.'}`),
    ];

    const { recordIndex, confident: rawConfident } = await this.invokeWithTool<{
      recordIndex: number;
      confident?: boolean;
      reasoning: string;
    }>(messages, tool);

    // The Zod .min().max() shapes the tool prompt only — NOT validated against the AI response; this
    // guard is the sole runtime enforcement. -1 is accepted only when noneAllowed (allowNone && !truncated).
    if (!Number.isInteger(recordIndex) || recordIndex < minIndex || recordIndex > maxIndex) {
      throw new InvalidAIResponseError(
        `AI selected record index ${recordIndex} which is out of range (${minIndex}-${maxIndex}) or not an integer`,
      );
    }

    // A definitive -1 ("none relevant") is not ambiguity. For a positive pick, honour the AI's
    // confidence flag, defaulting to confident when omitted so a missing flag still auto-loads.
    const confident = recordIndex < 0 ? true : rawConfident !== false;

    return { index: recordIndex, confident };
  }
}
