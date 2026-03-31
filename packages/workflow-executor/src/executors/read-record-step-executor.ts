import type { StepExecutionResult } from '../types/execution';
import type { CollectionSchema } from '../types/record';
import type { ReadRecordStepDefinition } from '../types/step-definition';
import type { FieldReadResult } from '../types/step-execution-data';

import { DynamicStructuredTool, HumanMessage, SystemMessage } from '@forestadmin/ai-proxy';
import { z } from 'zod';

import { NoReadableFieldsError, NoResolvedFieldsError } from '../errors';
import RecordTaskStepExecutor from './record-task-step-executor';

const READ_RECORD_SYSTEM_PROMPT = `You are an AI agent reading fields from a record to answer a user request.
Select the field(s) that best answer the request. You can read one field or multiple fields at once.

Important rules:
- Be precise: only read fields that are directly relevant to the request.
- Final answer is definitive, you won't receive any other input from the user.
- Do not refer to yourself as "I" in the response, use a passive formulation instead.`;

export default class ReadRecordStepExecutor extends RecordTaskStepExecutor<ReadRecordStepDefinition> {
  protected async doExecute(): Promise<StepExecutionResult> {
    const { stepDefinition: step } = this.context;
    const { preRecordedArgs } = step;
    const records = await this.getAvailableRecordRefs();

    const selectedRecordRef = await this.resolveRecordRef(
      records,
      step.prompt,
      preRecordedArgs?.selectedRecordStepIndex,
    );
    const schema = await this.getCollectionSchema(selectedRecordRef.collectionName);
    const selectedDisplayNames =
      preRecordedArgs?.fieldDisplayNames ?? (await this.selectFields(schema, step.prompt));
    const resolvedFieldNames = selectedDisplayNames
      .map(name => this.findField(schema, name)?.fieldName)
      .filter((name): name is string => name !== undefined);

    if (resolvedFieldNames.length === 0) {
      throw new NoResolvedFieldsError(selectedDisplayNames);
    }

    const recordData = await this.agentPort.getRecord(
      {
        collection: selectedRecordRef.collectionName,
        id: selectedRecordRef.recordId,
        fields: resolvedFieldNames,
      },
      this.context.user,
    );
    const fieldResults = this.formatFieldResults(recordData.values, schema, selectedDisplayNames);

    await this.context.runStore.saveStepExecution(this.context.runId, {
      type: 'read-record',
      stepIndex: this.context.stepIndex,
      executionParams: {
        fields: fieldResults.map(({ name, displayName }) => ({ name, displayName })),
      },
      executionResult: { fields: fieldResults },
      selectedRecordRef,
    });

    return this.buildOutcomeResult({ status: 'success' });
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

    const args = await this.invokeWithTool<{ fieldNames: string[] }>(messages, tool);

    return args.fieldNames;
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
        fieldNames: z
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
