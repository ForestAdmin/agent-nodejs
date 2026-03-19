import type { StepExecutionResult, UserInput } from '../types/execution';
import type { CollectionSchema, RecordRef } from '../types/record';
import type { RecordTaskStepDefinition } from '../types/step-definition';
import type { UpdateRecordStepExecutionData } from '../types/step-execution-data';

import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import { NoWritableFieldsError, WorkflowExecutorError } from '../errors';
import BaseStepExecutor from './base-step-executor';

const UPDATE_RECORD_SYSTEM_PROMPT = `You are an AI agent updating a field on a record based on a user request.
Select the field to update and provide the new value.

Important rules:
- Be precise: only update the field that is directly relevant to the request.
- Final answer is definitive, you won't receive any other input from the user.
- Do not refer to yourself as "I" in the response, use a passive formulation instead.`;

export default class UpdateRecordStepExecutor extends BaseStepExecutor<RecordTaskStepDefinition> {
  async execute(): Promise<StepExecutionResult> {
    // Branch A -- Re-entry with user confirmation
    if (this.context.userInput) {
      return this.handleConfirmation(this.context.userInput);
    }

    // Branches B & C -- First call
    return this.handleFirstCall();
  }

  private async handleConfirmation(userInput: UserInput): Promise<StepExecutionResult> {
    const stepExecutions = await this.context.runStore.getStepExecutions();
    const execution = stepExecutions.find(
      (e): e is UpdateRecordStepExecutionData =>
        e.type === 'update-record' && e.stepIndex === this.context.stepIndex,
    );

    if (!execution?.pendingUpdate) {
      throw new WorkflowExecutorError('No pending update found for this step');
    }

    if (!userInput.confirmed) {
      await this.context.runStore.saveStepExecution({
        ...execution,
        executionResult: { skipped: true },
      });

      return this.buildOutcomeResult('success');
    }

    const { selectedRecordRef, pendingUpdate } = execution;

    return this.resolveAndUpdate(
      selectedRecordRef,
      pendingUpdate.fieldDisplayName,
      pendingUpdate.value,
      execution,
    );
  }

  private async handleFirstCall(): Promise<StepExecutionResult> {
    const { stepDefinition: step } = this.context;
    const records = await this.getAvailableRecordRefs();

    let selectedRecordRef: RecordRef;
    let fieldDisplayName: string;
    let value: string;

    try {
      selectedRecordRef = await this.selectRecordRef(records, step.prompt);
      const schema = await this.getCollectionSchema(selectedRecordRef.collectionName);
      const args = await this.selectFieldAndValue(schema, step.prompt);
      fieldDisplayName = args.fieldName;
      value = args.value;
    } catch (error) {
      if (error instanceof WorkflowExecutorError) {
        return this.buildOutcomeResult('error', error.message);
      }

      throw error;
    }

    // Branch B -- automaticCompletion
    if (step.automaticCompletion) {
      return this.resolveAndUpdate(selectedRecordRef, fieldDisplayName, value);
    }

    // Branch C -- Awaiting confirmation
    await this.context.runStore.saveStepExecution({
      type: 'update-record',
      stepIndex: this.context.stepIndex,
      pendingUpdate: { fieldDisplayName, value },
      selectedRecordRef,
    });

    return this.buildOutcomeResult('awaiting-input');
  }

  /**
   * Resolves the field name, calls updateRecord, and persists execution data.
   * When `existingExecution` is provided (confirmation flow), it spreads its
   * properties into the saved execution to preserve pendingUpdate for traceability.
   */
  private async resolveAndUpdate(
    selectedRecordRef: RecordRef,
    fieldDisplayName: string,
    value: string,
    existingExecution?: UpdateRecordStepExecutionData,
  ): Promise<StepExecutionResult> {
    let updated: { values: Record<string, unknown> };

    try {
      const schema = await this.getCollectionSchema(selectedRecordRef.collectionName);
      const fieldName = this.resolveFieldName(schema, fieldDisplayName);
      updated = await this.context.agentPort.updateRecord(
        selectedRecordRef.collectionName,
        selectedRecordRef.recordId,
        { [fieldName]: value },
      );
    } catch (error) {
      if (error instanceof WorkflowExecutorError) {
        return this.buildOutcomeResult('error', error.message);
      }

      throw error;
    }

    await this.context.runStore.saveStepExecution({
      ...existingExecution,
      type: 'update-record',
      stepIndex: this.context.stepIndex,
      executionParams: { fieldDisplayName, value },
      executionResult: { updatedValues: updated.values },
      selectedRecordRef,
    });

    return this.buildOutcomeResult('success');
  }

  private async selectFieldAndValue(
    schema: CollectionSchema,
    prompt: string | undefined,
  ): Promise<{ fieldName: string; value: string; reasoning: string }> {
    const tool = this.buildUpdateFieldTool(schema);
    const messages = [
      ...(await this.buildPreviousStepsMessages()),
      new SystemMessage(UPDATE_RECORD_SYSTEM_PROMPT),
      new SystemMessage(
        `The selected record belongs to the "${schema.collectionDisplayName}" collection.`,
      ),
      new HumanMessage(`**Request**: ${prompt ?? 'Update the relevant field.'}`),
    ];

    return this.invokeWithTool<{ fieldName: string; value: string; reasoning: string }>(
      messages,
      tool,
    );
  }

  private buildUpdateFieldTool(schema: CollectionSchema): DynamicStructuredTool {
    const nonRelationFields = schema.fields.filter(f => !f.isRelationship);

    if (nonRelationFields.length === 0) {
      throw new NoWritableFieldsError(schema.collectionName);
    }

    const displayNames = nonRelationFields.map(f => f.displayName) as [string, ...string[]];

    return new DynamicStructuredTool({
      name: 'update-record-field',
      description: 'Update a field on the selected record.',
      schema: z.object({
        fieldName: z.enum(displayNames),
        // z.string() intentionally: the value is always transmitted as string
        // to updateRecord; data typing is handled by the agent/datasource layer.
        value: z.string().describe('The new value for the field'),
        reasoning: z.string().describe('Why this field and value were chosen'),
      }),
      func: undefined,
    });
  }

  private resolveFieldName(schema: CollectionSchema, displayName: string): string {
    const field = this.findField(schema, displayName);

    if (!field) {
      throw new WorkflowExecutorError(
        `Field "${displayName}" not found in collection "${schema.collectionName}"`,
      );
    }

    return field.fieldName;
  }
}
