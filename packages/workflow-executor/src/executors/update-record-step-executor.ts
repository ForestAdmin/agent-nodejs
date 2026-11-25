import type { InvalidConfirmedField, WorkflowExecutorError } from '../errors';
import type { StepExecutionResult } from '../types/execution-context';
import type { FieldWithValue, UpdateRecordStepExecutionData } from '../types/step-execution-data';
import type { CollectionSchema, FieldSchema, RecordRef } from '../types/validated/collection';
import type { UpdateRecordStepDefinition } from '../types/validated/step-definition';

import { DynamicStructuredTool, HumanMessage, SystemMessage } from '@forestadmin/ai-proxy';
import { z } from 'zod';

import {
  FieldNotFoundError,
  FieldTypeMissingError,
  InvalidConfirmedValueError,
  InvalidPreRecordedArgsError,
  InvalidPreRecordedValueError,
  MalformedToolCallError,
  MissingPreRecordedValueError,
  NoWritableFieldsError,
  PendingFieldNotFoundError,
  PinnedArgNotFoundError,
  RelationshipFieldNotUpdatableError,
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

const UPDATE_RECORD_FIELDS_SYSTEM_PROMPT = `You are an AI agent updating several fields on a record based on a user request.
Provide a new value for each of the listed fields.

Important rules:
- Be precise: derive each value from the request and the workflow context.
- Use null only when the request asks to clear a field.
- Final answer is definitive, you won't receive any other input from the user.
- Do not refer to yourself as "I" in the response, use a passive formulation instead.`;

// Some providers only accept tool property keys matching ^[a-zA-Z0-9_.-]{1,64}$, which a display
// name like "First name" breaks, so each field gets a positional key.
function toFieldValueKey(index: number): string {
  return `field_${index}`;
}

const MAX_ECHOED_KEY_LENGTH = 100;

function hasOwn(values: Record<string, unknown> | undefined, key: string): boolean {
  return values !== undefined && Object.prototype.hasOwnProperty.call(values, key);
}

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

const jsonValueSchema = z.union([
  jsonStringSchema,
  z.record(z.string(), z.unknown()),
  z.array(z.unknown()),
  z.boolean(),
  z.number(),
]);

const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/;
const INTEGER_PATTERN = /^-?\d+$/;

// The agent takes a bigint column's value as an integer string, which a double would round.
function toExactNumber(decimal: string): number | string {
  const asNumber = Number(decimal);

  return INTEGER_PATTERN.test(decimal) && !Number.isSafeInteger(asNumber) ? decimal : asNumber;
}

const ZERO_FRACTION_PATTERN = /\.0+$/;

function significantDigits(decimal: string): string {
  return decimal
    .replace(/e.*$/i, '')
    .replace(/\D/g, '')
    .replace(/^0+|0+$/g, '');
}

function toStrictNumber(decimal: string): number | string {
  const integral = decimal.replace(ZERO_FRACTION_PATTERN, '');

  if (INTEGER_PATTERN.test(integral)) return toExactNumber(integral);

  const asNumber = Number(decimal);

  return significantDigits(decimal) === significantDigits(String(asNumber)) ? asNumber : NaN;
}

function isPointString(val: string): boolean {
  const coordinates = val.split(',');

  return (
    coordinates.length === 2 &&
    coordinates.every(coordinate => coordinate.trim() !== '' && Number.isFinite(Number(coordinate)))
  );
}

function isPointArray(val: unknown): val is [number, number] {
  return (
    Array.isArray(val) &&
    val.length === 2 &&
    val.every(coordinate => typeof coordinate === 'number' && Number.isFinite(coordinate))
  );
}

// The agent takes a Point only as the string "longitude,latitude".
const pointValueSchema = z.preprocess(
  val => (isPointArray(val) ? val.join(',') : val),
  z.custom<string>(val => typeof val === 'string' && isPointString(val), {
    message: 'expected [longitude, latitude] or "longitude,latitude"',
  }),
);

const NUMBER_FORMAT_MESSAGE = 'expected a number or a decimal string, e.g. 12, -3 or 12.5';

function buildNumberCoercion(strict: boolean): z.ZodTypeAny {
  return z.preprocess(
    val => {
      if (typeof val === 'string' && DECIMAL_PATTERN.test(val.trim())) {
        return strict ? toStrictNumber(val.trim()) : toExactNumber(val.trim());
      }

      return strict || typeof val === 'number' ? val : Number(val);
    },
    z.custom<number | string>(
      val =>
        (typeof val === 'number' && Number.isFinite(val)) ||
        (typeof val === 'string' && INTEGER_PATTERN.test(val)),
      { message: NUMBER_FORMAT_MESSAGE },
    ),
  );
}

// `forAiTool` = the schema is bound into an AI tool (langchain converts it to JSON Schema). The
// Boolean coercion uses `z.preprocess`, which langchain's cross-package transform-stripping misses
// when the workspace resolves two zod copies (root vs nested) → "Transforms cannot be represented
// in JSON Schema". For the AI tool we hand it a plain z.boolean(); coerceFieldValue (which builds
// with forAiTool=false) still normalizes any stray "true"/"false" string afterwards.
function buildZodSchemaForPrimitive(
  type: string,
  enumValues?: string[],
  forAiTool = false,
  strict = false,
): z.ZodTypeAny {
  switch (type) {
    case 'Boolean':
      return forAiTool
        ? z.boolean()
        : z.preprocess(val => {
            if (typeof val !== 'string') return val;
            if (val === 'true') return true;
            if (val === 'false') return false;

            return val;
          }, z.boolean());
    case 'Date':
      return z.iso
        .datetime({ offset: !forAiTool })
        .describe('ISO 8601 datetime, e.g. 2024-06-01T00:00:00Z');
    case 'Dateonly':
      return z.iso.date().describe('ISO 8601 date, e.g. 2024-06-01');
    case 'Number':
      return forAiTool ? z.coerce.number() : buildNumberCoercion(strict);
    case 'Enum':
      if (enumValues && enumValues.length >= 2) {
        return z.enum(enumValues as [string, string, ...string[]]);
      }

      if (enumValues?.length === 1) return z.literal(enumValues[0]);

      return z.string();
    case 'Json':
      return forAiTool ? jsonStringSchema : jsonValueSchema;
    case 'Point':
      return forAiTool
        ? z.array(z.number()).length(2).describe('[longitude, latitude]')
        : pointValueSchema;
    // String, Uuid, Time, Binary, Timeonly, File → plain string
    default:
      return z.string();
  }
}

function buildZodSchemaForField(
  field: FieldSchema,
  collectionName: string,
  forAiTool = false,
  strict = false,
): z.ZodTypeAny {
  const { type, enumValues } = field;

  // A writable (non-relationship) field with no column type is a malformed schema for this update:
  // we'd otherwise fall through to z.string() and silently write the wrong type. Fail visibly.
  if (type == null) {
    throw new FieldTypeMissingError(field.displayName, collectionName);
  }

  const jsonSchema = forAiTool ? jsonStringSchema : jsonValueSchema;

  if (Array.isArray(type)) {
    const [itemType] = type;

    // Nested array or embedded document (e.g. [['String']], [{ street: 'String' }]) → opaque JSON.
    if (typeof itemType === 'object' && itemType !== null) return z.array(jsonSchema);

    return z.array(buildZodSchemaForPrimitive(itemType as string, enumValues, forAiTool, strict));
  }

  if (typeof type === 'object' && type !== null) {
    return jsonSchema;
  }

  return buildZodSchemaForPrimitive(type as string, enumValues, forAiTool, strict);
}

interface CoerceOptions {
  strict?: boolean;
  toError?: (fieldDisplayName: string, reason: string) => WorkflowExecutorError;
}

function coerceFieldValue(
  fieldSchema: FieldSchema,
  value: unknown,
  collectionName: string,
  {
    strict = false,
    toError = (name, reason) => new StepStateError(`Invalid value for field "${name}": ${reason}`),
  }: CoerceOptions = {},
): unknown {
  if (fieldSchema.isRelationship) {
    throw new RelationshipFieldNotUpdatableError(fieldSchema.displayName, collectionName);
  }

  if (value === null) return value;

  const parsed = buildZodSchemaForField(fieldSchema, collectionName, false, strict).safeParse(
    value,
  );

  if (!parsed.success) {
    throw toError(
      fieldSchema.displayName,
      parsed.error.issues.map(issue => issue.message).join(', '),
    );
  }

  return parsed.data;
}

type UpdateRecordExecutionParams = NonNullable<UpdateRecordStepExecutionData['executionParams']>;

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
        const { selectedRecordRef, userConfirmation } = exec;
        const pendingData = exec.pendingData!;

        if ('fields' in pendingData) {
          if (userConfirmation?.value !== undefined) {
            throw new StepStateError(
              'A multi-field update must be confirmed with "values", not "value"',
            );
          }

          return this.resolveAndUpdate(
            selectedRecordRef,
            await this.applyConfirmedValues(
              selectedRecordRef,
              pendingData.fields,
              userConfirmation?.values ?? {},
            ),
            exec,
          );
        }

        if (userConfirmation?.values !== undefined) {
          throw new StepStateError(
            'A single-field update must be confirmed with "value", not "values"',
          );
        }

        // A user override of `null` (clearing the field) must win over the AI suggestion, so
        // distinguish "no override" (undefined) from "override to null".
        const isOverridden = userConfirmation?.value !== undefined;
        const rawValue = isOverridden ? userConfirmation.value : pendingData.value;

        const executionParams: FieldWithValue = {
          ...pendingData,
          // The value comes from an `unknown` HTTP value (may be a boolean or array), so coerce
          // it to the field's native type before updating. Idempotent on already-typed values.
          value: await this.coerceOverride(selectedRecordRef, pendingData, rawValue, isOverridden),
        };

        return this.resolveAndUpdate(selectedRecordRef, executionParams, exec);
      });
    }

    // Branches B & C -- First call
    return this.handleFirstCall();
  }

  private async applyConfirmedValues(
    selectedRecordRef: RecordRef,
    pendingFields: FieldWithValue[],
    values: Record<string, unknown>,
  ): Promise<{ fields: FieldWithValue[] }> {
    const pendingNames = new Set(pendingFields.map(({ name }) => name));
    const unknownName = Object.keys(values).find(name => !pendingNames.has(name));

    if (unknownName !== undefined) {
      throw new StepStateError(
        `Cannot confirm field ${JSON.stringify(
          unknownName.slice(0, MAX_ECHOED_KEY_LENGTH),
        )}: this step does not update it`,
      );
    }

    const schema = await this.getCollectionSchema(selectedRecordRef.collectionName);
    const invalidFields: InvalidConfirmedField[] = [];

    const fields = pendingFields.map(({ displayName, name, value }) => {
      const isOverridden = hasOwn(values, name);

      try {
        return {
          displayName,
          name,
          value: this.coerceConfirmedValue(
            schema,
            { displayName, name },
            isOverridden ? values[name] : value,
            isOverridden,
          ),
        };
      } catch (error) {
        if (!(error instanceof InvalidConfirmedValueError)) throw error;
        invalidFields.push(...error.invalidFields);

        return { displayName, name, value };
      }
    });

    if (invalidFields.length > 0) throw new InvalidConfirmedValueError(invalidFields);

    return { fields };
  }

  private async coerceOverride(
    selectedRecordRef: RecordRef,
    pendingData: FieldWithValue,
    value: unknown,
    isOverridden: boolean,
  ): Promise<unknown> {
    const schema = await this.getCollectionSchema(selectedRecordRef.collectionName);

    return this.coerceConfirmedValue(schema, pendingData, value, isOverridden);
  }

  private coerceConfirmedValue(
    schema: CollectionSchema,
    { displayName, name }: Pick<FieldWithValue, 'displayName' | 'name'>,
    value: unknown,
    isOverridden: boolean,
  ): unknown {
    const fieldSchema = this.findFieldByTechnicalName(schema, name);

    if (!fieldSchema) {
      throw new PendingFieldNotFoundError(displayName, name, schema.collectionName);
    }

    return coerceFieldValue(fieldSchema, value, schema.collectionName, {
      strict: isOverridden,
      ...(isOverridden && {
        toError: (fieldDisplayName, reason) =>
          new InvalidConfirmedValueError([{ displayName: fieldDisplayName, reason }]),
      }),
    });
  }

  private async handleFirstCall(): Promise<StepExecutionResult> {
    const { stepDefinition: step } = this.context;
    const { preRecordedArgs } = step;

    const selectedRecordRef =
      preRecordedArgs?.selectedRecordStepId !== undefined
        ? await this.resolveSourceRecordRef(preRecordedArgs.selectedRecordStepId)
        : await this.resolveRecordRef(step.prompt, {
            preRecordedStepIndex: preRecordedArgs?.selectedRecordStepIndex,
            writes: true,
          });
    const schema = await this.getCollectionSchema(selectedRecordRef.collectionName);

    if (preRecordedArgs?.fieldNames !== undefined) {
      const fieldNames = [...new Set(preRecordedArgs.fieldNames)];

      if (step.executionType === StepExecutionMode.FullyAutomated) {
        return this.updatePinnedFields(
          selectedRecordRef,
          schema,
          fieldNames,
          preRecordedArgs.values ?? {},
        );
      }

      return this.suggestPinnedFields(
        selectedRecordRef,
        schema,
        fieldNames,
        preRecordedArgs.values,
        step.prompt,
      );
    }

    // A value without a field is meaningless (nothing to write it to).
    if (preRecordedArgs?.value !== undefined && preRecordedArgs?.fieldName === undefined) {
      throw new InvalidPreRecordedArgsError('value was provided without a fieldName');
    }

    // Three build-time configurations, in order of determinism:
    // - fieldName + value → fully deterministic, no AI.
    // - fieldName only     → field is pinned; the AI resolves just the value from the prompt.
    // - neither            → the AI picks both field and value.
    const recordedField = preRecordedArgs?.fieldName;
    let field: FieldSchema;
    let value: unknown;

    if (recordedField !== undefined) {
      const pinnedField = this.findFieldByTechnicalName(schema, recordedField);

      if (!pinnedField) {
        throw new PinnedArgNotFoundError('field', recordedField, schema.collectionName);
      }

      if (pinnedField.isRelationship) {
        throw new RelationshipFieldNotUpdatableError(
          pinnedField.displayName,
          schema.collectionName,
        );
      }

      field = pinnedField;
      value =
        preRecordedArgs?.value !== undefined
          ? coerceFieldValue(field, preRecordedArgs.value, schema.collectionName, {
              strict: true,
              toError: (name, reason) => new InvalidPreRecordedValueError(name, reason),
            })
          : await this.selectValueForField(schema, field, step.prompt);
    } else {
      ({ field, value } = await this.selectFieldAndValue(schema, step.prompt));
    }

    const fieldWithValue: FieldWithValue = {
      displayName: field.displayName,
      name: field.fieldName,
      value,
    };

    // Branch B -- fully automated execution
    if (step.executionType === StepExecutionMode.FullyAutomated) {
      return this.resolveAndUpdate(selectedRecordRef, fieldWithValue);
    }

    // Branch C -- Awaiting confirmation
    await this.context.runStore.saveStepExecution(this.context.runId, {
      type: 'update-record',
      stepIndex: this.context.stepIndex,
      pendingData: fieldWithValue,
      selectedRecordRef,
    });

    return this.buildOutcomeResult({ status: 'awaiting-input' });
  }

  private async updatePinnedFields(
    selectedRecordRef: RecordRef,
    schema: CollectionSchema,
    fieldNames: string[],
    values: Record<string, unknown>,
  ): Promise<StepExecutionResult> {
    const fields = fieldNames.map(fieldName => {
      const field = this.findPinnedWritableField(schema, fieldName);

      // `null` clears the field; only an absent key is a missing value.
      if (!hasOwn(values, fieldName)) {
        throw new MissingPreRecordedValueError(field.displayName);
      }

      return this.toPinnedFieldWithValue(schema, field, values[fieldName]);
    });

    return this.resolveAndUpdate(selectedRecordRef, { fields });
  }

  private async suggestPinnedFields(
    selectedRecordRef: RecordRef,
    schema: CollectionSchema,
    fieldNames: string[],
    values: Record<string, unknown> | undefined,
    prompt: string | undefined,
  ): Promise<StepExecutionResult> {
    const pinnedFields = fieldNames.map(fieldName =>
      this.findPinnedWritableField(schema, fieldName),
    );
    const resolvedFields = new Map<string, FieldWithValue>(
      pinnedFields
        .filter(field => hasOwn(values, field.fieldName))
        .map(field => [
          field.fieldName,
          this.toPinnedFieldWithValue(schema, field, values?.[field.fieldName]),
        ]),
    );
    const fieldsToSuggest = pinnedFields.filter(field => !resolvedFields.has(field.fieldName));

    if (fieldsToSuggest.length > 0) {
      const suggestions = await this.suggestValuesForFields(schema, fieldsToSuggest, prompt);
      suggestions.forEach(suggestion => resolvedFields.set(suggestion.name, suggestion));
    }

    const { values: currentValues } = await this.context.agent.getRecord({
      collection: selectedRecordRef.collectionName,
      id: selectedRecordRef.recordId,
      fields: pinnedFields.map(field => field.fieldName),
    });

    await this.context.runStore.saveStepExecution(this.context.runId, {
      type: 'update-record',
      stepIndex: this.context.stepIndex,
      pendingData: {
        fields: pinnedFields.flatMap(field => {
          const resolved = resolvedFields.get(field.fieldName);

          return resolved
            ? [{ ...resolved, previousValue: currentValues[field.fieldName] ?? null }]
            : [];
        }),
      },
      selectedRecordRef,
    });

    return this.buildOutcomeResult({ status: 'awaiting-input' });
  }

  private findPinnedWritableField(schema: CollectionSchema, fieldName: string): FieldSchema {
    const field = this.findFieldByTechnicalName(schema, fieldName);

    if (!field) {
      throw new PinnedArgNotFoundError('field', fieldName, schema.collectionName);
    }

    if (field.isRelationship) {
      throw new RelationshipFieldNotUpdatableError(field.displayName, schema.collectionName);
    }

    return field;
  }

  private toPinnedFieldWithValue(
    schema: CollectionSchema,
    field: FieldSchema,
    value: unknown,
  ): FieldWithValue {
    return {
      displayName: field.displayName,
      name: field.fieldName,
      value: coerceFieldValue(field, value, schema.collectionName, {
        strict: true,
        toError: (name, reason) => new InvalidPreRecordedValueError(name, reason),
      }),
    };
  }

  // existingExecution (confirmation flow) is spread into the saved execution to preserve pendingData.
  private async resolveAndUpdate(
    selectedRecordRef: RecordRef,
    executionParams: UpdateRecordExecutionParams,
    existingExecution?: UpdateRecordStepExecutionData,
  ): Promise<StepExecutionResult> {
    const fields = 'fields' in executionParams ? executionParams.fields : [executionParams];

    const updated = await this.context.agent.updateRecord(
      {
        collection: selectedRecordRef.collectionName,
        id: selectedRecordRef.recordId,
        values: Object.fromEntries(fields.map(({ name, value }) => [name, value])),
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
      executionParams,
      executionResult: { updatedValues: updated.values },
      selectedRecordRef,
      idempotencyPhase: 'done',
    });

    return this.buildOutcomeResult({ status: 'success' });
  }

  private async selectFieldAndValue(
    schema: CollectionSchema,
    prompt: string | undefined,
  ): Promise<{ field: FieldSchema; value: unknown }> {
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

    // Tool-call args are never parsed against the schema: a model can drop the `input` wrapper.
    if (typeof input?.fieldName !== 'string') {
      throw new MalformedToolCallError(tool.name, 'input.fieldName is missing');
    }

    const fieldName = this.resolveAiFieldName(schema, input.fieldName);
    const field = this.findFieldByTechnicalName(schema, fieldName);

    if (!field || field.isRelationship) {
      throw new FieldNotFoundError(fieldName, schema.collectionName);
    }

    // The AI tool schema is JSON-Schema-safe (plain z.boolean() for Boolean), so it does not coerce
    // a stray string — normalize to the field's native type, matching the pinned-field path.
    return { field, value: coerceFieldValue(field, input.value, schema.collectionName) };
  }

  // Field is pinned at build time; only the value is AI-resolved from the prompt/workflow context.
  private async selectValueForField(
    schema: CollectionSchema,
    field: FieldSchema,
    prompt: string | undefined,
  ): Promise<unknown> {
    if (field.type == null) {
      throw new FieldTypeMissingError(field.fieldName, schema.collectionName);
    }

    const tool = new DynamicStructuredTool({
      name: 'set-record-field-value',
      description: `Provide the new value for the "${field.displayName}" field.`,
      schema: z.object({
        reasoning: z.string().describe('Why this value was chosen'),
        value: buildZodSchemaForField(field, schema.collectionName, true).nullable(),
      }),
      func: undefined,
    });

    const messages = [
      this.buildContextMessage(),
      ...(await this.buildPreviousStepsMessages()),
      new SystemMessage(UPDATE_RECORD_SYSTEM_PROMPT),
      new SystemMessage(
        `The selected record belongs to the "${schema.collectionDisplayName}" collection. ` +
          `Set the value of the "${field.displayName}" field.`,
      ),
      new HumanMessage(`**Request**: ${prompt ?? `Set the "${field.displayName}" field.`}`),
    ];

    const { value } = await this.invokeWithTool<{ value: unknown }>(messages, tool);

    // The AI tool schema is JSON-Schema-safe (plain z.boolean() for Boolean), so it does not coerce
    // a stray "true"/"42" string — coerceFieldValue normalizes the value to the field's native type.
    return coerceFieldValue(field, value, schema.collectionName);
  }

  private async suggestValuesForFields(
    schema: CollectionSchema,
    fields: FieldSchema[],
    prompt: string | undefined,
  ): Promise<FieldWithValue[]> {
    const fieldList = fields.map(field => `"${field.displayName}"`).join(', ');
    const tool = new DynamicStructuredTool({
      name: 'set-record-field-values',
      description: `Provide the new value of each of these fields: ${fieldList}.`,
      schema: z.object({
        reasoning: z.string().describe('Why these values were chosen'),
        values: z.object(
          Object.fromEntries(
            fields.map((field, index) => [
              toFieldValueKey(index),
              buildZodSchemaForField(field, schema.collectionName, true)
                .nullable()
                .describe(`New value of the "${field.displayName}" field`),
            ]),
          ),
        ),
      }),
      func: undefined,
    });

    const messages = [
      this.buildContextMessage(),
      ...(await this.buildPreviousStepsMessages()),
      new SystemMessage(UPDATE_RECORD_FIELDS_SYSTEM_PROMPT),
      new SystemMessage(
        `The selected record belongs to the "${schema.collectionDisplayName}" collection. ` +
          `Set the value of each of these fields: ${fieldList}.`,
      ),
      new HumanMessage(`**Request**: ${prompt ?? `Set the value of each of these fields.`}`),
    ];

    const { values } = await this.invokeWithTool<{ values?: Record<string, unknown> }>(
      messages,
      tool,
    );

    return fields.map((field, index) => {
      const key = toFieldValueKey(index);

      if (!hasOwn(values, key)) {
        throw new StepStateError(
          `Invalid value for field "${field.displayName}": missing from the AI response`,
        );
      }

      return {
        displayName: field.displayName,
        name: field.fieldName,
        value: coerceFieldValue(field, values?.[key], schema.collectionName),
      };
    });
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
        value: buildZodSchemaForField(f, schema.collectionName, true).nullable(),
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
