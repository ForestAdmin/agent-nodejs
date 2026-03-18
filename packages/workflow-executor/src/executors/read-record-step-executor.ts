import type { StepExecutionResult } from '../types/execution';
import type { RecordData } from '../types/record';
import type { AiTaskStepDefinition } from '../types/step-definition';
import type { FieldReadResult } from '../types/step-execution-data';
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
    const records = await this.context.runStore.getRecords();

    let selectedRecord: RecordData;
    let fieldNames: string[];

    try {
      selectedRecord = await this.selectRecord(records, step.prompt);
      fieldNames = await this.selectFields(selectedRecord, step.prompt);
    } catch (error) {
      return { stepHistory: { ...stepHistory, status: 'error', error: (error as Error).message } };
    }

    const fieldResults = this.readFieldValues(selectedRecord, fieldNames);

    await this.context.runStore.saveStepExecution({
      type: 'read-record',
      stepIndex: stepHistory.stepIndex,
      executionParams: { fieldNames },
      executionResult: { fields: fieldResults },
      selectedRecordRef: {
        recordId: selectedRecord.recordId,
        collectionName: selectedRecord.collectionName,
        collectionDisplayName: selectedRecord.collectionDisplayName,
        fields: selectedRecord.fields,
      },
    });

    return { stepHistory: { ...stepHistory, status: 'success' } };
  }

  private async selectFields(record: RecordData, prompt: string | undefined): Promise<string[]> {
    const tool = this.buildReadFieldTool(record);
    const messages = [
      ...(await this.buildPreviousStepsMessages()),
      new SystemMessage(READ_RECORD_SYSTEM_PROMPT),
      new SystemMessage(
        `The selected record belongs to the "${record.collectionDisplayName}" collection.`,
      ),
      new HumanMessage(`**Request**: ${prompt ?? 'Read the relevant fields.'}`),
    ];

    const args = await this.invokeWithTool<{ fieldNames: string[] }>(messages, tool);

    return args.fieldNames;
  }

  private async selectRecord(
    records: RecordData[],
    prompt: string | undefined,
  ): Promise<RecordData> {
    if (records.length === 0) throw new NoRecordsError();
    if (records.length === 1) return records[0];

    const identifiers = records.map(ReadRecordStepExecutor.toRecordIdentifier) as [
      string,
      ...string[],
    ];

    const tool = new DynamicStructuredTool({
      name: 'select-record',
      description: 'Select the most relevant record for this workflow step.',
      schema: z.object({
        recordIdentifier: z.enum(identifiers),
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

    const selected = records.find(
      r => ReadRecordStepExecutor.toRecordIdentifier(r) === recordIdentifier,
    );

    if (!selected) {
      throw new WorkflowExecutorError(
        `AI selected record "${recordIdentifier}" which does not match any available record`,
      );
    }

    return selected;
  }

  private buildReadFieldTool(record: RecordData): DynamicStructuredTool {
    const nonRelationFields = record.fields.filter(f => !f.isRelationship);

    if (nonRelationFields.length === 0) {
      throw new NoReadableFieldsError(record.collectionName);
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

  private readFieldValues(record: RecordData, fieldNames: string[]): FieldReadResult[] {
    return fieldNames.map(name => {
      const field = record.fields.find(f => f.fieldName === name || f.displayName === name);

      if (!field) return { error: `Field not found: ${name}`, fieldName: name, displayName: name };

      return {
        value: record.values[field.fieldName],
        fieldName: field.fieldName,
        displayName: field.displayName,
      };
    });
  }

  private static toRecordIdentifier(record: RecordData): string {
    return `Step ${record.stepIndex} - ${record.collectionDisplayName} #${record.recordId}`;
  }
}
