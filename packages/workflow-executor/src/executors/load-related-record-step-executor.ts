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
  InvalidAIResponseError,
  InvalidPreRecordedArgsError,
  NoRelationshipFieldsError,
  RelatedRecordNotFoundError,
  RelationNotFoundError,
  SourceRecordMissingError,
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

    // Switching the relation in Manual mode must still not pre-select a record.
    const suggestViaAi = this.context.stepDefinition.executionType !== StepExecutionMode.Manual;
    const schema = await this.getCollectionSchema(execution.selectedRecordRef.collectionName);
    const target = await this.buildTarget(schema, fieldName, execution.selectedRecordRef);
    const { availableRecordIds, suggestedRecord } = await this.collectCandidateIds(
      target,
      suggestViaAi,
    );

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
    // Manual mode never invokes AI — neither to pick the relation nor to suggest a record.
    const useAi = step.executionType !== StepExecutionMode.Manual;

    // Branch B -- Full AI: AI selects and the record is loaded with no user input (may auto-skip).
    if (step.executionType === StepExecutionMode.FullyAutomated) {
      return this.resolveAndLoadAutomatic(useAi);
    }

    // Branches C & D -- pre-fetch candidates, await user confirmation. AI-assisted pre-selects a
    // record (suggestedRecord); Manual presents the narrowed list with no AI pick.
    const target = await this.resolveTarget(useAi);
    const sourceSchema = await this.getCollectionSchema(target.selectedRecordRef.collectionName);

    return this.saveAndAwaitInput(target, sourceSchema, useAi);
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

    // Manual mode never invokes the AI relation chooser: with several eligible relations (legacy
    // steps that pinned no relationName) it defaults to the first; the user can switch it at runtime.
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

  // Branches C & D: pre-fetch candidates and await user confirmation. AI-assisted suggests the best
  // candidate (suggestViaAi); Manual lists them with no suggestion. Save errors propagate directly —
  // the relation-load hasn't run yet, so the step can be safely retried.
  private async saveAndAwaitInput(
    target: RelationTarget,
    sourceSchema: CollectionSchema,
    suggestViaAi: boolean,
  ): Promise<StepExecutionResult> {
    const { selectedRecordRef, name, displayName } = target;

    const { availableRecordIds, suggestedRecord } = await this.collectCandidateIds(
      target,
      suggestViaAi,
    );

    const availableFields: RelationRef[] = sourceSchema.fields
      .filter(isFollowableRelation)
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

  private async collectCandidateIds(
    target: RelationTarget,
    suggestViaAi: boolean,
  ): Promise<{
    availableRecordIds: LoadRelatedRecordCandidate[];
    suggestedRecord?: LoadRelatedRecordCandidate;
  }> {
    if (target.relationType === 'BelongsTo' || target.relationType === 'HasOne') {
      const candidate = await this.fetchXToOneCandidate(target);

      // The lone xToOne record pre-fills in every mode — it's the only option, not an AI pick.
      return candidate
        ? { availableRecordIds: [candidate], suggestedRecord: candidate }
        : { availableRecordIds: [] };
    }

    // Rank (AI-suggest) only when AI-assisted. allowNone is Full-AI-only, never on the await path —
    // here the human is the one who decides "none relevant" via the checkbox.
    const { relatedData, bestIndex, relatedSchema } = await this.selectBestFromRelatedData(
      target,
      50,
      { rank: suggestViaAi, allowNone: false },
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
      // bestIndex is -1 in Manual mode (rank:false) → no suggestion; a single candidate still pre-fills.
      suggestedRecord: bestIndex >= 0 ? toCandidate(relatedData[bestIndex]) : undefined,
    };
  }

  private extractReferenceFieldValue(
    values: Record<string, unknown>,
    referenceField: string,
  ): string | null {
    const v = values[referenceField];

    return v === undefined || v === null ? null : String(v);
  }

  /**
   * Branch B: Full AI. xToOne loads the linked record; HasMany ranks candidates via AI;
   * BelongsToMany takes the first. Auto-skips (persists `skipped` + success) when there is no source
   * record, no candidate, or the AI judges none relevant — the run then advances with nothing loaded.
   */
  private async resolveAndLoadAutomatic(useAi: boolean): Promise<StepExecutionResult> {
    let target: RelationTarget;

    try {
      target = await this.resolveTarget(useAi);
    } catch (error) {
      // No source record to load from → Full AI auto-continues. (Manual/AI-assisted let this error
      // surface so the front can offer "continue without" — PRD-550.)
      if (error instanceof SourceRecordMissingError) return this.persistSkip();
      throw error;
    }

    const record = await this.fetchRecordForRelation(target);

    // Empty candidate list or AI judged none relevant → skip and move on.
    if (record === null) return this.persistSkip(target.selectedRecordRef);

    return this.persistAndReturn(record, target, undefined);
  }

  private async fetchRecordForRelation(target: RelationTarget): Promise<RecordRef | null> {
    if (target.relationType === 'BelongsTo' || target.relationType === 'HasOne') {
      return this.fetchXToOneRecordRef(target);
    }

    if (target.relationType === 'HasMany') {
      return this.selectBestRelatedRecord(target);
    }

    return this.fetchFirstCandidate(target);
  }

  // Returns null (→ Full AI skip) when the relation has no linked record.
  private async fetchXToOneRecordRef(target: RelationTarget): Promise<RecordRef | null> {
    const candidate = await this.fetchXToOneCandidate(target);

    if (!candidate) return null;

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
    opts: { rank: boolean; allowNone: boolean } = { rank: true, allowNone: false },
  ): Promise<{
    relatedData: RecordData[];
    bestIndex: number;
    suggestedFields: string[];
    relatedSchema: CollectionSchema;
  }> {
    const relatedSchema = await this.getCollectionSchema(target.relatedCollectionName);
    const relatedData = await this.fetchRelatedData(target, relatedSchema, limit);

    // Empty (bestIndex unused — callers guard on length) or single → no ranking needed. This
    // short-circuits before opts.allowNone, so a Full AI run with a single candidate always loads it
    // (the AI is never asked to reject a sole option).
    if (relatedData.length <= 1) {
      return { relatedData, bestIndex: 0, suggestedFields: [], relatedSchema };
    }

    // Manual mode (rank:false) lists the candidates with no AI call → bestIndex -1 (no suggestion).
    if (!opts.rank) {
      return { relatedData, bestIndex: -1, suggestedFields: [], relatedSchema };
    }

    // The final record stays AI-suggested + user-confirmed (or AI-decided in Full AI) — only the
    // source + relation are pinned deterministically. Index-based record pinning was removed.
    const suggestedFields = await this.selectRelevantFields(
      relatedSchema,
      this.context.stepDefinition.prompt,
    );
    const bestIndex = await this.selectBestRecordIndex(
      relatedData,
      suggestedFields,
      this.context.stepDefinition.prompt,
      opts.allowNone,
    );

    return { relatedData, bestIndex, suggestedFields, relatedSchema };
  }

  /**
   * HasMany + Full AI: fetch top 50, then AI selects the best record. Returns null (→ skip) when
   * there is no candidate or the AI judges none of them relevant.
   */
  private async selectBestRelatedRecord(target: RelationTarget): Promise<RecordRef | null> {
    const { relatedData, bestIndex } = await this.selectBestFromRelatedData(target, 50, {
      rank: true,
      allowNone: true,
    });

    if (relatedData.length === 0 || bestIndex < 0) return null;

    return this.toRecordRef(relatedData[bestIndex]);
  }

  // BelongsToMany + Full AI: take the first candidate. Returns null (→ skip) when there is none.
  private async fetchFirstCandidate(target: RelationTarget): Promise<RecordRef | null> {
    const relatedSchema = await this.getCollectionSchema(target.relatedCollectionName);
    const relatedData = await this.fetchRelatedData(target, relatedSchema, 1);

    return relatedData.length > 0 ? this.toRecordRef(relatedData[0]) : null;
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

  // Full AI auto-skip: persists the same `{ skipped: true }` marker handleConfirmationFlow writes for
  // the "No X to load" checkbox, so downstream steps and the front treat it as a deliberate skip.
  // selectedRecordRef is absent only when there was no source record to load from.
  private async persistSkip(selectedRecordRef?: RecordRef): Promise<StepExecutionResult> {
    await this.context.runStore.saveStepExecution(this.context.runId, {
      type: 'load-related-record',
      stepIndex: this.context.stepIndex,
      selectedRecordRef,
      executionResult: { skipped: true },
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

  /**
   * AI call 2 for HasMany: selects the best record by index from the candidate list. When
   * `allowNone` (Full AI), the AI may return -1 to signal that none of the candidates is relevant.
   */
  private async selectBestRecordIndex(
    candidates: RecordData[],
    fieldNames: string[],
    prompt: string | undefined,
    allowNone = false,
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
      this.context.logger('Warn', 'load-related-record: candidate list truncated for AI prompt', {
        ...this.logCtx,
        shown,
        total: candidates.length,
      });
    }

    const maxIndex = shown - 1;
    const minIndex = allowNone ? -1 : 0;
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
            allowNone
              ? `0-based index of the most relevant record (0 to ${maxIndex}), or -1 if none of the candidates is relevant`
              : `0-based index of the most relevant record (0 to ${maxIndex})`,
          ),
        reasoning: z.string().describe('Why this record was chosen (or why none is relevant)'),
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

    // NOTE: The Zod schema's .min().max() shapes the tool prompt only — it is NOT validated against
    // the AI response. This guard is the sole runtime enforcement. -1 (none relevant) is accepted
    // only when allowNone.
    if (!Number.isInteger(recordIndex) || recordIndex < minIndex || recordIndex > maxIndex) {
      throw new InvalidAIResponseError(
        `AI selected record index ${recordIndex} which is out of range (${minIndex}-${maxIndex}) or not an integer`,
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
