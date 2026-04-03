import type { StepExecutionResult } from '../types/execution';
import type { CollectionSchema, RecordRef } from '../types/record';
import type { TriggerActionStepDefinition } from '../types/step-definition';
import type { ActionRef, TriggerRecordActionStepExecutionData } from '../types/step-execution-data';

import { DynamicStructuredTool, HumanMessage, SystemMessage } from '@forestadmin/ai-proxy';
import { z } from 'zod';

import { ActionNotFoundError, NoActionsError, StepPersistenceError } from '../errors';
import RecordStepExecutor from './record-step-executor';

const TRIGGER_ACTION_SYSTEM_PROMPT = `You are an AI agent triggering an action on a record based on a user request.
Select the action to trigger.

Important rules:
- Be precise: only trigger the action directly relevant to the request.
- Final answer is definitive, you won't receive any other input from the user.
- Do not refer to yourself as "I" in the response, use a passive formulation instead.`;

interface ActionTarget extends ActionRef {
  selectedRecordRef: RecordRef;
}

export default class TriggerRecordActionStepExecutor extends RecordStepExecutor<TriggerActionStepDefinition> {
  protected async doExecute(): Promise<StepExecutionResult> {
    // Branch A -- Re-entry after pending execution found in RunStore
    const pending = await this.patchAndReloadPendingData<TriggerRecordActionStepExecutionData>(
      this.context.incomingPendingData,
    );

    if (pending) {
      return this.handleConfirmationFlow<TriggerRecordActionStepExecutionData>(
        pending,
        async exec => {
          const { selectedRecordRef, pendingData } = exec;
          const target: ActionTarget = {
            selectedRecordRef,
            ...(pendingData as ActionRef),
          };

          return this.resolveAndExecute(target, exec);
        },
      );
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
    const args = preRecordedArgs?.actionDisplayName
      ? { actionName: preRecordedArgs.actionDisplayName }
      : await this.selectAction(schema, step.prompt);
    const name = this.resolveActionName(schema, args.actionName);
    const target: ActionTarget = { selectedRecordRef, displayName: args.actionName, name };

    // Branch B -- automaticExecution
    if (step.automaticExecution) {
      return this.resolveAndExecute(target);
    }

    // Branch C -- Awaiting confirmation
    await this.context.runStore.saveStepExecution(this.context.runId, {
      type: 'trigger-action',
      stepIndex: this.context.stepIndex,
      pendingData: { displayName: target.displayName, name: target.name },
      selectedRecordRef: target.selectedRecordRef,
    });

    return this.buildOutcomeResult({ status: 'awaiting-input' });
  }

  /**
   * Resolves the action name, calls executeAction, and persists execution data.
   * When `existingExecution` is provided (confirmation flow), it is spread into the
   * saved execution to preserve pendingData for traceability.
   */
  private async resolveAndExecute(
    target: ActionTarget,
    existingExecution?: TriggerRecordActionStepExecutionData,
  ): Promise<StepExecutionResult> {
    const { selectedRecordRef, displayName, name } = target;

    const actionResult = await this.agentPort.executeAction(
      {
        collection: selectedRecordRef.collectionName,
        action: name,
        id: selectedRecordRef.recordId,
      },
      this.context.user,
    );

    try {
      await this.context.runStore.saveStepExecution(this.context.runId, {
        ...existingExecution,
        type: 'trigger-action',
        stepIndex: this.context.stepIndex,
        executionParams: { displayName, name },
        executionResult: { success: true, actionResult },
        selectedRecordRef,
      });
    } catch (cause) {
      throw new StepPersistenceError(
        `Action "${name}" executed but step state could not be persisted ` +
          `(run "${this.context.runId}", step ${this.context.stepIndex})`,
        cause,
      );
    }

    return this.buildOutcomeResult({ status: 'success' });
  }

  private async selectAction(
    schema: CollectionSchema,
    prompt: string | undefined,
  ): Promise<{ actionName: string; reasoning: string }> {
    const tool = this.buildSelectActionTool(schema);
    const messages = [
      this.buildContextMessage(),
      ...(await this.buildPreviousStepsMessages()),
      new SystemMessage(TRIGGER_ACTION_SYSTEM_PROMPT),
      new SystemMessage(
        `The selected record belongs to the "${schema.collectionDisplayName}" collection.`,
      ),
      new HumanMessage(`**Request**: ${prompt ?? 'Trigger the relevant action.'}`),
    ];

    return this.invokeWithTool<{ actionName: string; reasoning: string }>(messages, tool);
  }

  private buildSelectActionTool(schema: CollectionSchema): DynamicStructuredTool {
    if (schema.actions.length === 0) {
      throw new NoActionsError(schema.collectionName);
    }

    const displayNames = schema.actions.map(a => a.displayName) as [string, ...string[]];
    const technicalNames = schema.actions
      .map(a => `${a.displayName} (technical name: ${a.name})`)
      .join(', ');

    return new DynamicStructuredTool({
      name: 'select-action',
      description: 'Select the action to trigger on the record.',
      schema: z.object({
        actionName: z
          .enum(displayNames)
          .describe(`The name of the action to trigger. Available: ${technicalNames}`),
        reasoning: z.string().describe('Why this action was chosen'),
      }),
      func: undefined,
    });
  }

  private resolveActionName(schema: CollectionSchema, displayName: string): string {
    const action =
      schema.actions.find(a => a.displayName === displayName) ??
      schema.actions.find(a => a.name === displayName);

    if (!action) {
      throw new ActionNotFoundError(displayName, schema.collectionName);
    }

    return action.name;
  }
}
