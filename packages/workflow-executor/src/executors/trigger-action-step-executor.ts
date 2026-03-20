import type { StepExecutionResult } from '../types/execution';
import type { CollectionSchema, RecordRef } from '../types/record';
import type { RecordTaskStepDefinition } from '../types/step-definition';
import type { TriggerActionStepExecutionData } from '../types/step-execution-data';

import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import { NoActionsError, WorkflowExecutorError } from '../errors';
import BaseStepExecutor from './base-step-executor';

const TRIGGER_ACTION_SYSTEM_PROMPT = `You are an AI agent triggering an action on a record based on a user request.
Select the action to trigger.

Important rules:
- Be precise: only trigger the action directly relevant to the request.
- Final answer is definitive, you won't receive any other input from the user.
- Do not refer to yourself as "I" in the response, use a passive formulation instead.`;

interface ActionTarget {
  selectedRecordRef: RecordRef;
  actionDisplayName: string;
  actionName: string;
}

export default class TriggerActionStepExecutor extends BaseStepExecutor<RecordTaskStepDefinition> {
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
      (e): e is TriggerActionStepExecutionData =>
        e.type === 'trigger-action' && e.stepIndex === this.context.stepIndex,
    );

    if (!execution?.pendingAction) {
      throw new WorkflowExecutorError('No pending action found for this step');
    }

    if (!this.context.userConfirmed) {
      await this.context.runStore.saveStepExecution(this.context.runId, {
        ...execution,
        executionResult: { skipped: true },
      });

      return this.buildOutcomeResult('success');
    }

    const { selectedRecordRef, pendingAction } = execution;
    const target: ActionTarget = {
      selectedRecordRef,
      actionDisplayName: pendingAction.actionDisplayName,
      actionName: pendingAction.actionName,
    };

    return this.resolveAndExecute(target, execution);
  }

  private async handleFirstCall(): Promise<StepExecutionResult> {
    const { stepDefinition: step } = this.context;
    const records = await this.getAvailableRecordRefs();

    let target: ActionTarget;

    try {
      const selectedRecordRef = await this.selectRecordRef(records, step.prompt);
      const schema = await this.getCollectionSchema(selectedRecordRef.collectionName);
      const args = await this.selectAction(schema, step.prompt);
      const actionName = this.resolveActionName(schema, args.actionDisplayName);
      target = { selectedRecordRef, actionDisplayName: args.actionDisplayName, actionName };
    } catch (error) {
      if (error instanceof WorkflowExecutorError) {
        return this.buildOutcomeResult('error', error.message);
      }

      throw error;
    }

    // Branch B -- automaticExecution
    if (step.automaticExecution) {
      return this.resolveAndExecute(target);
    }

    // Branch C -- Awaiting confirmation
    await this.context.runStore.saveStepExecution(this.context.runId, {
      type: 'trigger-action',
      stepIndex: this.context.stepIndex,
      pendingAction: { actionDisplayName: target.actionDisplayName, actionName: target.actionName },
      selectedRecordRef: target.selectedRecordRef,
    });

    return this.buildOutcomeResult('awaiting-input');
  }

  /**
   * Resolves the action name, calls executeAction, and persists execution data.
   * When `existingExecution` is provided (confirmation flow), it is spread into the
   * saved execution to preserve pendingAction for traceability.
   */
  private async resolveAndExecute(
    target: ActionTarget,
    existingExecution?: TriggerActionStepExecutionData,
  ): Promise<StepExecutionResult> {
    const { selectedRecordRef, actionDisplayName, actionName } = target;

    try {
      // Return value intentionally discarded: action results may contain client data
      // and must not leave the client's infrastructure (privacy constraint).
      await this.context.agentPort.executeAction(selectedRecordRef.collectionName, actionName, [
        selectedRecordRef.recordId,
      ]);
    } catch (error) {
      if (error instanceof WorkflowExecutorError) {
        return this.buildOutcomeResult('error', error.message);
      }

      throw error;
    }

    await this.context.runStore.saveStepExecution(this.context.runId, {
      ...existingExecution,
      type: 'trigger-action',
      stepIndex: this.context.stepIndex,
      executionParams: { actionDisplayName, actionName },
      executionResult: { success: true },
      selectedRecordRef,
    });

    return this.buildOutcomeResult('success');
  }

  private async selectAction(
    schema: CollectionSchema,
    prompt: string | undefined,
  ): Promise<{ actionDisplayName: string; reasoning: string }> {
    const tool = this.buildSelectActionTool(schema);
    const messages = [
      ...(await this.buildPreviousStepsMessages()),
      new SystemMessage(TRIGGER_ACTION_SYSTEM_PROMPT),
      new SystemMessage(
        `The selected record belongs to the "${schema.collectionDisplayName}" collection.`,
      ),
      new HumanMessage(`**Request**: ${prompt ?? 'Trigger the relevant action.'}`),
    ];

    return this.invokeWithTool<{ actionDisplayName: string; reasoning: string }>(messages, tool);
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
        actionDisplayName: z
          .enum(displayNames)
          .describe(`The display name of the action to trigger. Available: ${technicalNames}`),
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
      throw new WorkflowExecutorError(
        `Action "${displayName}" not found in collection "${schema.collectionName}"`,
      );
    }

    return action.name;
  }
}
