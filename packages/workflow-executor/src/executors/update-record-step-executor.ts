import type { StepExecutionResult } from '../types/execution';
import type { CollectionSchema, RecordRef } from '../types/record';
import type { RecordTaskStepDefinition } from '../types/step-definition';
import type { FieldRef, UpdateRecordStepExecutionData } from '../types/step-execution-data';

import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import { NoWritableFieldsError, WorkflowExecutorError } from '../errors';
import RecordTaskStepExecutor from './record-task-step-executor';

const UPDATE_RECORD_SYSTEM_PROMPT = `You are an AI agent updating a field on a record based on a user request.
Select the field to update and provide the new value.

Important rules:
- Be precise: only update the field that is directly relevant to the request.
- Final answer is definitive, you won't receive any other input from the user.
- Do not refer to yourself as "I" in the response, use a passive formulation instead.`;

interface UpdateTarget extends FieldRef {
  selectedRecordRef: RecordRef;
  value: string;
}

export default class UpdateRecordStepExecutor extends RecordTaskStepExecutor<RecordTaskStepDefinition> {
  async execute(): Promise<StepExecutionResult> {
    // Branch A -- Re-entry with user confirmation
    if (this.context.userConfirmed !== undefined) {
      return this.handleConfirmation();
    }

    // Branches B & C -- First call
    return this.handleFirstCall();
  }

  private async handleConfirmation(): Promise<StepExecutionResult> {
    const stepExecutions = await this.context.runStore.getStepExecutions(this.context.runId);
    const execution = stepExecutions.find(
      (e): e is UpdateRecordStepExecutionData =>
        e.type === 'update-record' && e.stepIndex === this.context.stepIndex,
    );

    if (!execution?.pendingData) {
      throw new WorkflowExecutorError('No pending update found for this step');
    }

    if (!this.context.userConfirmed) {
      await this.context.runStore.saveStepExecution(this.context.runId, {
        ...execution,
        executionResult: { skipped: true },
      });

      return this.buildOutcomeResult({ status: 'success' });
    }

    const { selectedRecordRef, pendingData } = execution;
    const target: UpdateTarget = {
      selectedRecordRef,
      displayName: pendingData.displayName,
      name: pendingData.name,
      value: pendingData.value,
    };

    return this.resolveAndUpdate(target, execution);
  }

  private async handleFirstCall(): Promise<StepExecutionResult> {
    const { stepDefinition: step } = this.context;
    const records = await this.getAvailableRecordRefs();

    let target: UpdateTarget;

    try {
      const selectedRecordRef = await this.selectRecordRef(records, step.prompt);
      const schema = await this.getCollectionSchema(selectedRecordRef.collectionName);
      const args = await this.selectFieldAndValue(schema, step.prompt);
      const name = this.resolveFieldName(schema, args.fieldName);
      target = {
        selectedRecordRef,
        displayName: args.fieldName,
        name,
        value: args.value,
      };
    } catch (error) {
      return this.buildErrorOutcomeOrThrow(error);
    }

    // Branch B -- automaticExecution
    if (step.automaticExecution) {
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

  /**
   * Resolves the field name, calls updateRecord, and persists execution data.
   * When `existingExecution` is provided (confirmation flow), it is spread into the
   * saved execution to preserve pendingUpdate for traceability.
   */
  private async resolveAndUpdate(
    target: UpdateTarget,
    existingExecution?: UpdateRecordStepExecutionData,
  ): Promise<StepExecutionResult> {
    const { selectedRecordRef, displayName, name, value } = target;
    let updated: { values: Record<string, unknown> };

    try {
      updated = await this.context.agentPort.updateRecord(
        selectedRecordRef.collectionName,
        selectedRecordRef.recordId,
        { [name]: value },
      );
    } catch (error) {
      return this.buildErrorOutcomeOrThrow(error);
    }

    await this.context.runStore.saveStepExecution(this.context.runId, {
      ...existingExecution,
      type: 'update-record',
      stepIndex: this.context.stepIndex,
      executionParams: { displayName, name, value },
      executionResult: { updatedValues: updated.values },
      selectedRecordRef,
    });

    return this.buildOutcomeResult({ status: 'success' });
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
