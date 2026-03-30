import type { StepExecutionResult } from '../types/execution';
import type { CollectionSchema, RecordRef } from '../types/record';
import type { UpdateRecordStepDefinition } from '../types/step-definition';
import type { FieldRef, UpdateRecordStepExecutionData } from '../types/step-execution-data';

import { DynamicStructuredTool, HumanMessage, SystemMessage } from '@forestadmin/ai-proxy';
import { z } from 'zod';

import {
  FieldNotFoundError,
  InvalidPreRecordedArgsError,
  NoWritableFieldsError,
  StepPersistenceError,
} from '../errors';
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

export default class UpdateRecordStepExecutor extends RecordTaskStepExecutor<UpdateRecordStepDefinition> {
  protected async doExecute(): Promise<StepExecutionResult> {
    // Branch A -- Re-entry after pending execution found in RunStore
    const pending = await this.findPendingExecution<UpdateRecordStepExecutionData>('update-record');

    if (pending) {
      return this.handleConfirmationFlow<UpdateRecordStepExecutionData>(pending, async exec => {
        const { selectedRecordRef, pendingData } = exec;
        const target: UpdateTarget = {
          selectedRecordRef,
          ...(pendingData as FieldRef & { value: string }),
        };

        return this.resolveAndUpdate(target, exec);
      });
    }

    // Branches B & C -- First call
    return this.handleFirstCall();
  }

  private async handleFirstCall(): Promise<StepExecutionResult> {
    const { stepDefinition: step } = this.context;
    const { preRecordedArgs } = step;
    const records = await this.getAvailableRecordRefs();

    const selectedRecordRef = await this.resolveRecordRef(
      records,
      step.prompt,
      preRecordedArgs?.selectedRecordStepIndex,
    );
    const schema = await this.getCollectionSchema(selectedRecordRef.collectionName);

    if (preRecordedArgs?.fieldDisplayName !== undefined && preRecordedArgs?.value === undefined) {
      throw new InvalidPreRecordedArgsError(
        'fieldDisplayName and value must both be provided or both omitted',
      );
    }

    if (preRecordedArgs?.value !== undefined && preRecordedArgs?.fieldDisplayName === undefined) {
      throw new InvalidPreRecordedArgsError(
        'fieldDisplayName and value must both be provided or both omitted',
      );
    }

    const args = preRecordedArgs?.fieldDisplayName !== undefined
      ? { fieldName: preRecordedArgs.fieldDisplayName, value: preRecordedArgs.value as string }
      : await this.selectFieldAndValue(schema, step.prompt);
    const name = this.resolveFieldName(schema, args.fieldName);
    const target: UpdateTarget = {
      selectedRecordRef,
      displayName: args.fieldName,
      name,
      value: args.value,
    };

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
   * saved execution to preserve pendingData for traceability.
   */
  private async resolveAndUpdate(
    target: UpdateTarget,
    existingExecution?: UpdateRecordStepExecutionData,
  ): Promise<StepExecutionResult> {
    const { selectedRecordRef, displayName, name, value } = target;

    const updated = await this.agentPort.updateRecord(
      {
        collection: selectedRecordRef.collectionName,
        id: selectedRecordRef.recordId,
        values: { [name]: value },
      },
      this.context.user,
    );

    try {
      await this.context.runStore.saveStepExecution(this.context.runId, {
        ...existingExecution,
        type: 'update-record',
        stepIndex: this.context.stepIndex,
        executionParams: { displayName, name, value },
        executionResult: { updatedValues: updated.values },
        selectedRecordRef,
      });
    } catch (cause) {
      throw new StepPersistenceError(
        `Record update persisted but step state could not be saved ` +
          `(run "${this.context.runId}", step ${this.context.stepIndex})`,
        cause,
      );
    }

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
      throw new FieldNotFoundError(displayName, schema.collectionName);
    }

    return field.fieldName;
  }
}
