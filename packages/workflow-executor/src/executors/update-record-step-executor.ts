import type { StepExecutionResult } from '../types/execution-context';
import type { FieldWithValue, UpdateRecordStepExecutionData } from '../types/step-execution-data';
import type { CollectionSchema, FieldSchema, RecordRef } from '../types/validated/collection';
import type { UpdateRecordStepDefinition } from '../types/validated/step-definition';

import { DynamicStructuredTool, HumanMessage, SystemMessage } from '@forestadmin/ai-proxy';
import { z } from 'zod';

import {
  FieldNotFoundError,
  FieldTypeMissingError,
  InvalidPreRecordedArgsError,
  NoWritableFieldsError,
  StepStateError,
} from '../errors';
import RecordStepExecutor from './record-step-executor';
import { StepExecutionMode } from '../types/validated/step-definition';

const UPDATE_RECORD_SYSTEM_PROMPT = `You are an AI agent updating a field on a record based on a user request.
Select the field to update and provide the new value.

Important rules:
- Be precise: only update the field that is directly relevant to the request.
- Final answer is definitive, you won't receive any other input from the user.
- Do not refer to yourself as "I" in the response, use a passive formulation instead.`;

const jsonStringSchema = z
  .string()
  .refine(
    val => {
      try {
        JSON.parse(val);

        return true;
      } catch {
        return false;
      }
    },
    { message: 'Must be a valid JSON string' },
  )
  .describe('JSON content as a valid JSON string');

function buildZodSchemaForPrimitive(type: string, enumValues?: string[]): z.ZodTypeAny {
  switch (type) {
    case 'Boolean':
      return z.preprocess(val => {
        if (typeof val !== 'string') return val;
        if (val === 'true') return true;
        if (val === 'false') return false;

        return val;
      }, z.boolean());
    case 'Date':
      return z.iso.datetime().describe('ISO 8601 datetime, e.g. 2024-06-01T00:00:00Z');
    case 'Dateonly':
      return z.iso.date().describe('ISO 8601 date, e.g. 2024-06-01');
    case 'Number':
      return z.coerce.number();
    case 'Enum':
      if (enumValues && enumValues.length >= 2) {
        return z.enum(enumValues as [string, string, ...string[]]);
      }

      if (enumValues?.length === 1) return z.literal(enumValues[0]);

      return z.string();
    case 'Json':
      return jsonStringSchema;
    case 'Point':
      return z.array(z.number()).length(2).describe('[longitude, latitude]');
    // String, Uuid, Time, Binary, Timeonly, File → plain string
    default:
      return z.string();
  }
}

function buildZodSchemaForField(field: FieldSchema, collectionName: string): z.ZodTypeAny {
  const { type, enumValues } = field;

  // A writable (non-relationship) field with no column type is a malformed schema for this update:
  // we'd otherwise fall through to z.string() and silently write the wrong type. Fail visibly.
  if (type == null) {
    throw new FieldTypeMissingError(field.displayName, collectionName);
  }

  if (Array.isArray(type)) {
    // Nested array (e.g. [['String']]) → treat as opaque JSON.
    if (Array.isArray(type[0])) return z.array(jsonStringSchema);

    return z.array(buildZodSchemaForPrimitive(type[0] as string, enumValues));
  }

  if (typeof type === 'object' && type !== null) {
    return jsonStringSchema;
  }

  return buildZodSchemaForPrimitive(type as string, enumValues);
}

// Coerce a user-overridden value to the field's native type before updating the record.
// The HTTP schema accepts `unknown`, so the override may be a boolean or an array; this turns
// it into the type the datasource expects, and throws a StepStateError on mismatch.
function coerceFieldValue(
  fieldSchema: FieldSchema | undefined,
  value: unknown,
  collectionName: string,
): unknown {
  // Field not found, relationship (type intentionally null), or explicit null → nothing to coerce.
  if (!fieldSchema || fieldSchema.isRelationship || value === null) return value;

  const parsed = buildZodSchemaForField(fieldSchema, collectionName).safeParse(value);

  if (!parsed.success) {
    throw new StepStateError(
      `Invalid value for field "${fieldSchema.displayName}": ${parsed.error.issues
        .map(issue => issue.message)
        .join(', ')}`,
    );
  }

  return parsed.data;
}

interface UpdateTarget extends FieldWithValue {
  selectedRecordRef: RecordRef;
}

export default class UpdateRecordStepExecutor extends RecordStepExecutor<UpdateRecordStepDefinition> {
  protected override async checkIdempotency(): Promise<StepExecutionResult | null> {
    const existing = await this.findPendingExecution<UpdateRecordStepExecutionData>(
      'update-record',
    );

    if (existing?.idempotencyPhase === 'done') {
      return this.buildOutcomeResult({ status: 'success' });
    }

    if (existing?.idempotencyPhase === 'executing') {
      throw new StepStateError('Step execution was interrupted. Please retry the step manually.');
    }

    return null;
  }

  protected async doExecute(): Promise<StepExecutionResult> {
    // Branch A -- Re-entry after pending execution found in RunStore
    const pending = await this.patchAndReloadPendingData<UpdateRecordStepExecutionData>(
      this.context.incomingPendingData,
    );

    if (pending) {
      return this.handleConfirmationFlow<UpdateRecordStepExecutionData>(pending, async exec => {
        const { selectedRecordRef, pendingData, userConfirmation } = exec;
        // A user override of `null` (clearing the field) must win over the AI suggestion, so
        // distinguish "no override" (undefined) from "override to null".
        const rawValue =
          userConfirmation?.value !== undefined ? userConfirmation.value : pendingData!.value;

        const target: UpdateTarget = {
          selectedRecordRef,
          ...pendingData!,
          // The value comes from an `unknown` HTTP value (may be a boolean or array), so coerce
          // it to the field's native type before updating. Idempotent on already-typed values.
          value: await this.coerceOverride(selectedRecordRef, pendingData, rawValue),
        };

        return this.resolveAndUpdate(target, exec);
      });
    }

    // Branches B & C -- First call
    return this.handleFirstCall();
  }

  private async coerceOverride(
    selectedRecordRef: RecordRef,
    pendingData: FieldWithValue | undefined,
    value: unknown,
  ): Promise<unknown> {
    const schema = await this.getCollectionSchema(selectedRecordRef.collectionName);
    const fieldSchema = this.findFieldByTechnicalName(schema, pendingData?.name);

    return coerceFieldValue(fieldSchema, value, selectedRecordRef.collectionName);
  }

  private async handleFirstCall(): Promise<StepExecutionResult> {
    const { stepDefinition: step } = this.context;
    const { preRecordedArgs } = step;

    const selectedRecordRef = preRecordedArgs?.selectedRecordStepId
      ? await this.resolveSourceRecordRef(preRecordedArgs.selectedRecordStepId)
      : await this.resolveRecordRef(
          await this.getAvailableRecordRefs(),
          step.prompt,
          preRecordedArgs?.selectedRecordStepIndex,
        );
    const schema = await this.getCollectionSchema(selectedRecordRef.collectionName);

    if (preRecordedArgs?.fieldName !== undefined && preRecordedArgs?.value === undefined) {
      throw new InvalidPreRecordedArgsError(
        'fieldName and value must both be provided or both omitted',
      );
    }

    if (preRecordedArgs?.value !== undefined && preRecordedArgs?.fieldName === undefined) {
      throw new InvalidPreRecordedArgsError(
        'fieldName and value must both be provided or both omitted',
      );
    }

    const recordedField = preRecordedArgs?.fieldName;
    const { fieldName, value } =
      recordedField !== undefined
        ? { fieldName: recordedField, value: preRecordedArgs?.value }
        : await this.selectFieldAndValue(schema, step.prompt);
    const field = this.findFieldByTechnicalName(schema, fieldName);

    if (!field) {
      throw new FieldNotFoundError(fieldName, schema.collectionName);
    }

    const target: UpdateTarget = {
      selectedRecordRef,
      displayName: field.displayName,
      name: field.fieldName,
      value,
    };

    // Branch B -- fully automated execution
    if (step.executionType === StepExecutionMode.FullyAutomated) {
      return this.resolveAndUpdate(target);
    }

    // Branch C -- Awaiting confirmation
    await this.context.runStore.saveStepExecution(this.context.runId, {
      type: 'update-record',
      stepIndex: this.context.stepIndex,
      pendingData: {
        displayName: target.displayName,
        name: target.name,
        value: target.value,
      },
      selectedRecordRef: target.selectedRecordRef,
    });

    return this.buildOutcomeResult({ status: 'awaiting-input' });
  }

  // existingExecution (confirmation flow) is spread into the saved execution to preserve pendingData.
  private async resolveAndUpdate(
    target: UpdateTarget,
    existingExecution?: UpdateRecordStepExecutionData,
  ): Promise<StepExecutionResult> {
    const { selectedRecordRef, displayName, name, value } = target;

    const updated = await this.context.agent.updateRecord(
      {
        collection: selectedRecordRef.collectionName,
        id: selectedRecordRef.recordId,
        values: { [name]: value },
      },
      {
        beforeCall: () =>
          this.context.runStore.saveStepExecution(this.context.runId, {
            ...existingExecution,
            type: 'update-record',
            stepIndex: this.context.stepIndex,
            selectedRecordRef,
            idempotencyPhase: 'executing',
          }),
      },
    );

    await this.context.runStore.saveStepExecution(this.context.runId, {
      ...existingExecution,
      type: 'update-record',
      stepIndex: this.context.stepIndex,
      executionParams: { displayName, name, value },
      executionResult: { updatedValues: updated.values },
      selectedRecordRef,
      idempotencyPhase: 'done',
    });

    return this.buildOutcomeResult({ status: 'success' });
  }

  private async selectFieldAndValue(
    schema: CollectionSchema,
    prompt: string | undefined,
  ): Promise<{ fieldName: string; value: unknown }> {
    const tool = this.buildUpdateFieldTool(schema);
    const messages = [
      this.buildContextMessage(),
      ...(await this.buildPreviousStepsMessages()),
      new SystemMessage(UPDATE_RECORD_SYSTEM_PROMPT),
      new SystemMessage(
        `The selected record belongs to the "${schema.collectionDisplayName}" collection.`,
      ),
      new HumanMessage(`**Request**: ${prompt ?? 'Update the relevant field.'}`),
    ];

    const { input } = await this.invokeWithTool<{
      input: { fieldName: string; value: unknown; reasoning: string };
    }>(messages, tool);

    return {
      fieldName: this.resolveAiFieldName(schema, input.fieldName),
      value: input.value,
    };
  }

  private buildUpdateFieldTool(schema: CollectionSchema): DynamicStructuredTool {
    // Exclude type-less fields: they can't be coerced/written, so offering them to the AI would
    // let a single drifted field fail the whole step. The override path still rejects an explicit
    // type-less target via FieldTypeMissingError.
    const nonRelationFields = schema.fields.filter(f => !f.isRelationship && f.type != null);

    if (nonRelationFields.length === 0) {
      throw new NoWritableFieldsError(schema.collectionName);
    }

    type FieldObject = z.ZodObject<{
      fieldName: z.ZodLiteral<string>;
      value: z.ZodNullable<z.ZodTypeAny>;
      reasoning: z.ZodString;
    }>;

    const fieldObjects = nonRelationFields.map(f =>
      z.object({
        fieldName: z.literal(f.displayName),
        value: buildZodSchemaForField(f, schema.collectionName).nullable(),
        reasoning: z.string().describe('Why this field and value were chosen'),
      }),
    ) as FieldObject[];

    const inputSchema =
      fieldObjects.length === 1
        ? fieldObjects[0]
        : z.union(fieldObjects as [FieldObject, FieldObject, ...FieldObject[]]);

    return new DynamicStructuredTool({
      name: 'update-record-field',
      description: 'Update a field on the selected record.',
      schema: z.object({ input: inputSchema }),
      func: undefined,
    });
  }
}
