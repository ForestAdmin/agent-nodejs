import type { CreateActivityLogArgs } from '../ports/activity-log-port';
import type { StepExecutionResult } from '../types/execution';
import type { CollectionSchema, RecordRef } from '../types/record';
import type { TriggerActionStepDefinition } from '../types/step-definition';
import type { ActionRef, TriggerRecordActionStepExecutionData } from '../types/step-execution-data';

import { DynamicStructuredTool, HumanMessage, SystemMessage } from '@forestadmin/ai-proxy';
import { z } from 'zod';

import {
  ActionNotFoundError,
  NoActionsError,
  StepPersistenceError,
  StepStateError,
  UnsupportedActionFormError,
} from '../errors';
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
  protected override buildActivityLogArgs(): Omit<
    CreateActivityLogArgs,
    'forestServerToken'
  > | null {
    // Skip when the frontend executes the action itself (non-automatic mode).
    // The front logs on its side via the standard agent activity flow.
    if (this.context.stepDefinition.automaticExecution !== true) return null;

    return {
      renderingId: this.context.user.renderingId,
      action: 'action',
      type: 'write',
      collectionName: this.context.baseRecordRef.collectionName,
      recordId: this.context.baseRecordRef.recordId[0],
    };
  }

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

          // The frontend executes the action itself and posts the result back.
          // A confirmed step without actionResult is a broken frontend contract.
          if (!pendingData || !('actionResult' in pendingData)) {
            throw new StepStateError(
              `Frontend confirmed action but did not provide actionResult ` +
                `(run "${this.context.runId}", step ${this.context.stepIndex})`,
            );
          }

          const target: ActionTarget = {
            selectedRecordRef,
            displayName: pendingData.displayName,
            name: pendingData.name,
          };

          return this.saveFrontendResult(target, pendingData.actionResult, exec);
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

    // Branch B -- automaticExecution: executor runs the action itself, so it cannot
    // handle forms (no UI to fill them). Reject form-bearing actions here. When the
    // frontend is in the loop (Branch C), it handles the form natively so no check.
    if (step.automaticExecution) {
      const { hasForm } = await this.agentPort.getActionFormInfo(
        {
          collection: selectedRecordRef.collectionName,
          action: name,
          id: selectedRecordRef.recordId,
        },
        this.context.user,
      );
      if (hasForm) throw new UnsupportedActionFormError(target.displayName);

      return this.executeOnExecutor(target);
    }

    // Branch C -- Awaiting confirmation (frontend executes the action, including forms)
    await this.context.runStore.saveStepExecution(this.context.runId, {
      type: 'trigger-action',
      stepIndex: this.context.stepIndex,
      pendingData: { displayName: target.displayName, name: target.name },
      selectedRecordRef: target.selectedRecordRef,
    });

    return this.buildOutcomeResult({ status: 'awaiting-input' });
  }

  /** Branch B — executor runs the action via agentPort, then persists the result. */
  private async executeOnExecutor(target: ActionTarget): Promise<StepExecutionResult> {
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

  /** Branch A — the frontend executed the action; executor only persists the result it sent. */
  private async saveFrontendResult(
    target: ActionTarget,
    actionResult: unknown,
    existingExecution: TriggerRecordActionStepExecutionData,
  ): Promise<StepExecutionResult> {
    const { selectedRecordRef, displayName, name } = target;

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
        `Frontend action result for "${name}" could not be persisted ` +
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
