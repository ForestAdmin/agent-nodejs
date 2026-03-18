import type { StepExecutionResult } from '../types/execution';
import type { CollectionSchema, RecordRef } from '../types/record';
import type { AiTaskStepDefinition } from '../types/step-definition';
import type {
  FieldReadResult,
  LoadRelatedRecordStepExecutionData,
} from '../types/step-execution-data';
import type { AiTaskStepHistory } from '../types/step-history';

import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import { NoReadableFieldsError, NoRecordsError, WorkflowExecutorError } from '../errors';
import BaseStepExecutor from './base-step-executor';

const READ_RECORD_SYSTEM_PROMPT = `You are an AI agent reading fields from a record to answer a user request.
Select the field(s) that best answer the request. You can read one field or multiple fields at once.

Important rules:
- Be precise: only read fields that are directly relevant to the request.
- Final answer is definitive, you won't receive any other input from the user.
- Do not refer to yourself as "I" in the response, use a passive formulation instead.`;

export default class ReadRecordStepExecutor extends BaseStepExecutor<
  AiTaskStepDefinition,
  AiTaskStepHistory
> {
  async execute(
    step: AiTaskStepDefinition,
    stepHistory: AiTaskStepHistory,
  ): Promise<StepExecutionResult> {
    const records = await this.getAvailableRecords();

    let selectedRef: RecordRef;
    let schema: CollectionSchema;
    let fieldNames: string[];
    let values: Record<string, unknown>;

    try {
      selectedRef = await this.selectRecord(records, step.prompt);
      schema = await this.context.workflowPort.getCollectionSchema(selectedRef.collectionName);
      fieldNames = await this.selectFields(schema, step.prompt);
      const agentRecord = await this.context.agentPort.getRecord(
        selectedRef.collectionName,
        selectedRef.recordId,
      );
      values = agentRecord.values;
    } catch (error) {
      return { stepHistory: { ...stepHistory, status: 'error', error: (error as Error).message } };
    }

    const fieldResults = this.readFieldValues(values, schema, fieldNames);

    await this.context.runStore.saveStepExecution({
      type: 'read-record',
      stepIndex: stepHistory.stepIndex,
      executionParams: { fieldNames },
      executionResult: { fields: fieldResults },
      selectedRecordRef: {
        collectionName: selectedRef.collectionName,
        recordId: selectedRef.recordId,
        stepIndex: selectedRef.stepIndex,
      },
    });

    return { stepHistory: { ...stepHistory, status: 'success' } };
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

  private async selectRecord(records: RecordRef[], prompt: string | undefined): Promise<RecordRef> {
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
      func: async input => JSON.stringify(input),
    });

    const messages = [
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
      throw new WorkflowExecutorError(
        `AI selected record "${recordIdentifier}" which does not match any available record`,
      );
    }

    return records[selectedIndex];
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
        // does not fail the whole tool call — per-field errors are handled in readFieldValues.
        // This matches the frontend implementation (ISO frontend).
        fieldNames: z
          .array(z.string())
          .describe(
            `Names of the fields to read, possible values are: ${displayNames
              .map(n => `"${n}"`)
              .join(', ')}`,
          ),
      }),
      func: async input => JSON.stringify(input),
    });
  }

  private readFieldValues(
    values: Record<string, unknown>,
    schema: CollectionSchema,
    fieldNames: string[],
  ): FieldReadResult[] {
    return fieldNames.map(name => {
      const field = schema.fields.find(f => f.fieldName === name || f.displayName === name);

      if (!field) return { error: `Field not found: ${name}`, fieldName: name, displayName: name };

      return {
        value: values[field.fieldName],
        fieldName: field.fieldName,
        displayName: field.displayName,
      };
    });
  }

  private async getAvailableRecords(): Promise<RecordRef[]> {
    const stepExecutions = await this.context.runStore.getStepExecutions();
    const relatedRecords = stepExecutions
      .filter((e): e is LoadRelatedRecordStepExecutionData => e.type === 'load-related-record')
      .map(e => e.record);

    return [this.context.baseRecord, ...relatedRecords];
  }

  private async toRecordIdentifier(record: RecordRef): Promise<string> {
    const schema = await this.context.workflowPort.getCollectionSchema(record.collectionName);

    return `Step ${record.stepIndex} - ${schema.collectionDisplayName} #${record.recordId}`;
  }
}
