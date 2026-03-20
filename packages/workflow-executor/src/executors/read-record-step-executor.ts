import type { StepExecutionResult } from '../types/execution';
import type { CollectionSchema, RecordRef } from '../types/record';
import type { RecordTaskStepDefinition } from '../types/step-definition';
import type { FieldReadResult } from '../types/step-execution-data';

import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import { NoReadableFieldsError, NoResolvedFieldsError, WorkflowExecutorError } from '../errors';
import BaseStepExecutor from './base-step-executor';

const READ_RECORD_SYSTEM_PROMPT = `You are an AI agent reading fields from a record to answer a user request.
Select the field(s) that best answer the request. You can read one field or multiple fields at once.

Important rules:
- Be precise: only read fields that are directly relevant to the request.
- Final answer is definitive, you won't receive any other input from the user.
- Do not refer to yourself as "I" in the response, use a passive formulation instead.`;

export default class ReadRecordStepExecutor extends BaseStepExecutor<RecordTaskStepDefinition> {
  async execute(): Promise<StepExecutionResult> {
    const { stepDefinition: step } = this.context;
    const records = await this.getAvailableRecordRefs();

    let selectedRecordRef: RecordRef;
    let schema: CollectionSchema;
    let fieldResults: FieldReadResult[];

    try {
      selectedRecordRef = await this.selectRecordRef(records, step.prompt);
      schema = await this.getCollectionSchema(selectedRecordRef.collectionName);
      const selectedDisplayNames = await this.selectFields(schema, step.prompt);
      const resolvedFieldNames = selectedDisplayNames
        .map(name => this.findField(schema, name)?.fieldName)
        .filter((name): name is string => name !== undefined);

      if (resolvedFieldNames.length === 0) {
        throw new NoResolvedFieldsError(selectedDisplayNames);
      }

      const recordData = await this.context.agentPort.getRecord(
        selectedRecordRef.collectionName,
        selectedRecordRef.recordId,
        resolvedFieldNames,
      );
      fieldResults = this.formatFieldResults(recordData.values, schema, selectedDisplayNames);
    } catch (error) {
      if (error instanceof WorkflowExecutorError) {
        return this.buildOutcomeResult('error', error.message);
      }

      throw error;
    }

    await this.context.runStore.saveStepExecution(this.context.runId, {
      type: 'read-record',
      stepIndex: this.context.stepIndex,
      executionParams: { fields: fieldResults.map(({ name, displayName }) => ({ name, displayName })) },
      executionResult: { fields: fieldResults },
      selectedRecordRef,
    });

    return this.buildOutcomeResult('success');
  }

  private async selectFields(
    schema: CollectionSchema,
    prompt: string | undefined,
  ): Promise<string[]> {
    const tool = this.buildReadFieldTool(schema);
    const messages = [
      ...(await this.buildPreviousStepsMessages()),
      new SystemMessage(READ_RECORD_SYSTEM_PROMPT),
      new SystemMessage(
        `The selected record belongs to the "${schema.collectionDisplayName}" collection.`,
      ),
      new HumanMessage(`**Request**: ${prompt ?? 'Read the relevant fields.'}`),
    ];

    const args = await this.invokeWithTool<{ fieldDisplayNames: string[] }>(messages, tool);

    return args.fieldDisplayNames;
  }

  private buildReadFieldTool(schema: CollectionSchema): DynamicStructuredTool {
    const nonRelationFields = schema.fields.filter(f => !f.isRelationship);

    if (nonRelationFields.length === 0) {
      throw new NoReadableFieldsError(schema.collectionName);
    }

    const displayNames = nonRelationFields.map(f => f.displayName) as [string, ...string[]];

    return new DynamicStructuredTool({
      name: 'read-selected-record-fields',
      description: 'Read one or more fields from the selected record.',
      schema: z.object({
        // z.string() (not z.enum) intentionally: an invalid field name in the array
        // does not fail the whole tool call — per-field errors are handled in formatFieldResults.
        // This matches the frontend implementation (ISO frontend).
        fieldDisplayNames: z
          .array(z.string())
          .describe(
            `Names of the fields to read, possible values are: ${displayNames
              .map(n => `"${n}"`)
              .join(', ')}`,
          ),
      }),
      func: undefined,
    });
  }

  private formatFieldResults(
    values: Record<string, unknown>,
    schema: CollectionSchema,
    fieldDisplayNames: string[],
  ): FieldReadResult[] {
    return fieldDisplayNames.map(name => {
      const field = this.findField(schema, name);

      if (!field) return { error: `Field not found: ${name}`, name, displayName: name };

      return {
        value: values[field.fieldName],
        name: field.fieldName,
        displayName: field.displayName,
      };
    });
  }
}
