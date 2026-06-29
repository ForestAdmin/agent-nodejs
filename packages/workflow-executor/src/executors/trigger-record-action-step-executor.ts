import type { ActionForm, ActionFormField } from '../ports/agent-port';
import type { StepExecutionResult } from '../types/execution-context';
import type {
  ActionRef,
  AiFilledFormValue,
  TriggerRecordActionStepExecutionData,
} from '../types/step-execution-data';
import type { ActionSchema, CollectionSchema, RecordRef } from '../types/validated/collection';
import type { TriggerActionStepDefinition } from '../types/validated/step-definition';

import { DynamicStructuredTool, HumanMessage, SystemMessage } from '@forestadmin/ai-proxy';
import { z } from 'zod';

import {
  ActionFormValidationError,
  ActionNotFoundError,
  ActionRequiresApprovalError,
  NoActionsError,
  StepStateError,
} from '../errors';
import RecordStepExecutor from './record-step-executor';
import { StepExecutionMode } from '../types/validated/step-definition';

const TRIGGER_ACTION_SYSTEM_PROMPT = `You are an AI agent triggering an action on a record based on a user request.
Select the action to trigger.

Important rules:
- Be precise: only trigger the action directly relevant to the request.
- Final answer is definitive, you won't receive any other input from the user.
- Do not refer to yourself as "I" in the response, use a passive formulation instead.`;

const FILL_FORM_SYSTEM_PROMPT = `You are filling out an action form using the user's request and the data available in the workflow context.

Important rules:
- The request is an explicit instruction. When it states a value for a field (e.g. "set the price to 35"), use that exact value — following an explicit instruction is NOT guessing.
- Otherwise, fill a field only when the workflow context gives you the value with confidence.
- A field's "current" value is just its existing default; override it when the request asks you to.
- If neither the request nor the workflow context gives you a field's value, LEAVE IT OUT — never guess or assume.
- For Enum fields, use exactly one of the allowed values, otherwise leave the field out.
- Do not invent identifiers, dates, amounts, or file contents that are absent from both the request and the context.`;

interface ActionTarget extends ActionRef {
  selectedRecordRef: RecordRef;
}

export default class TriggerRecordActionStepExecutor extends RecordStepExecutor<TriggerActionStepDefinition> {
  protected override async checkIdempotency(): Promise<StepExecutionResult | null> {
    const existing = await this.findPendingExecution<TriggerRecordActionStepExecutionData>(
      'trigger-action',
    );

    if (existing?.idempotencyPhase === 'done') {
      const result = existing.executionResult;
      const approvalRequest =
        result && !('skipped' in result) && result.submissionOutcome === 'pending-approval'
          ? result.approvalRequest
          : undefined;

      return this.buildOutcomeResult({
        status: 'success',
        ...(approvalRequest && { approvalRequest }),
      });
    }

    if (existing?.idempotencyPhase === 'executing') {
      throw new StepStateError('Step execution was interrupted. Please retry the step manually.');
    }

    return null;
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
          const { selectedRecordRef, pendingData, userConfirmation } = exec;

          // The frontend executes the action natively and posts the result back. A confirmed step
          // must carry an actionResult — UNLESS the submission only created an approval request
          // (pending-approval), in which case no result exists yet.
          const isPendingApproval = userConfirmation?.submissionOutcome === 'pending-approval';

          if (
            !pendingData ||
            !userConfirmation ||
            (!('actionResult' in userConfirmation) && !isPendingApproval)
          ) {
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

          return this.saveFrontendResult(target, exec);
        },
      );
    }

    // Branches B & C -- First call
    return this.handleFirstCall();
  }

  private async handleFirstCall(): Promise<StepExecutionResult> {
    const { stepDefinition: step } = this.context;
    const { preRecordedArgs } = step;

    // "On record" pins the source by stable step id (revise-safe); legacy steps without it fall
    // back to AI record selection among the available source records.
    const selectedRecordRef = preRecordedArgs?.selectedRecordStepId
      ? await this.resolveSourceRecordRef(preRecordedArgs.selectedRecordStepId)
      : await this.resolveRecordRef(await this.getAvailableRecordRefs(), step.prompt);
    const schema = await this.getCollectionSchema(selectedRecordRef.collectionName);
    const recordedAction = preRecordedArgs?.actionName;
    const actionName = recordedAction ?? (await this.selectAction(schema, step.prompt)).actionName;
    const action = this.findActionByTechnicalName(schema, actionName);

    if (!action) {
      throw new ActionNotFoundError(actionName, schema.collectionName);
    }

    const target: ActionTarget = {
      selectedRecordRef,
      displayName: action.displayName,
      name: action.name,
    };

    const form = await this.context.agent.getActionForm({
      collection: selectedRecordRef.collectionName,
      action: target.name,
      id: selectedRecordRef.recordId,
    });
    const hasForm = form.fields.length > 0;

    // Formless: Full AI executes directly, else pause for the user.
    if (!hasForm) {
      return step.executionType === StepExecutionMode.FullyAutomated
        ? this.executeOnExecutor(target)
        : this.pauseForConfirmation(target);
    }

    // Manual: pause with the native form, NO AI pre-fill.
    if (step.executionType === StepExecutionMode.Manual) {
      return this.pauseForConfirmation(target, { fields: form.fields, aiFilledValues: [] });
    }

    // AI-assisted + Full AI share the same fill loop; only the exit differs.
    const { aiFilledValues, form: filledForm } = await this.fillFormWithAi(
      selectedRecordRef,
      target.name,
      form,
    );
    const reviewState = { fields: filledForm.fields, aiFilledValues };

    // AI-assisted: pause for the user to review/edit/submit natively.
    if (step.executionType !== StepExecutionMode.FullyAutomated) {
      return this.pauseForConfirmation(target, reviewState);
    }

    // Full AI: submit if all required fields are filled, else fallback (pause) with what was filled.
    if (!filledForm.canExecute) {
      return this.pauseForConfirmation(target, reviewState);
    }

    const values = Object.fromEntries(aiFilledValues.map(v => [v.field, v.value]));

    try {
      return await this.executeOnExecutor(target, { values, aiFilledValues });
    } catch (error) {
      // Validation rejection or an approval-gated action → not a hard failure: pause as
      // AI-assisted so a human can finish/submit natively. Plain permission 403, infra errors,
      // etc. propagate as a real step error (a reviewing human couldn't fix those).
      if (
        error instanceof ActionFormValidationError ||
        error instanceof ActionRequiresApprovalError
      ) {
        return this.pauseForConfirmation(target, reviewState);
      }

      throw error;
    }
  }

  // Pause the step awaiting user confirmation. For form-bearing actions, `form` carries the native
  // form fields + the ordered AI prefill the front replays sequentially.
  private async pauseForConfirmation(
    target: ActionTarget,
    form?: { fields: ActionFormField[]; aiFilledValues: AiFilledFormValue[] },
  ): Promise<StepExecutionResult> {
    await this.context.runStore.saveStepExecution(this.context.runId, {
      type: 'trigger-action',
      stepIndex: this.context.stepIndex,
      pendingData: { displayName: target.displayName, name: target.name, ...(form && { form }) },
      selectedRecordRef: target.selectedRecordRef,
    });

    return this.buildOutcomeResult({ status: 'awaiting-input' });
  }

  // Shared AI form-fill loop (reused by Full AI). Iteratively asks the AI to
  // fill the fields it has context for (leave-empty-if-unsure), re-applying after each pass so
  // change hooks reveal dependent fields. Bounded by max iterations + no-progress detection so an
  // oscillating dynamic form can't loop forever. Returns the values in fill order + the final form.
  private async fillFormWithAi(
    recordRef: RecordRef,
    action: string,
    initialForm: ActionForm,
  ): Promise<{ aiFilledValues: AiFilledFormValue[]; form: ActionForm }> {
    const MAX_ITERATIONS = 3;
    const accumulator: Record<string, unknown> = {};
    const ordered: AiFilledFormValue[] = [];
    let form = initialForm;

    for (let i = 0; i < MAX_ITERATIONS; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const aiValues = await this.askAiToFillForm(form);
      let progressed = false;

      for (const [field, value] of Object.entries(aiValues)) {
        const isEmpty = value === undefined || value === null || value === '';
        const exists = form.fields.some(f => f.name === field);
        const isNew = accumulator[field] !== value;

        // Keep only non-empty values for fields that still exist and weren't already set.
        if (!isEmpty && exists && isNew) {
          accumulator[field] = value;
          ordered.push({ field, value });
          progressed = true;
        }
      }

      // No-progress guard: the AI added nothing new this pass → it has no more context to offer.
      if (!progressed) break;

      // Re-apply so change hooks reveal/adjust dependent fields for the next pass.
      // eslint-disable-next-line no-await-in-loop
      form = await this.context.agent.getActionForm({
        collection: recordRef.collectionName,
        action,
        id: recordRef.recordId,
        values: accumulator,
      });

      if (form.canExecute) break;
    }

    // Drop any value whose field no longer exists after the hooks (state drift) — fail-safe.
    const finalFieldNames = new Set(form.fields.map(f => f.name));
    const aiFilledValues = ordered.filter(v => finalFieldNames.has(v.field));

    // Debug: net retained values + whether the form can execute.
    this.context.logger('Debug', 'AI form-fill: final values', {
      ...this.logCtx,
      aiFilledValues,
      canExecute: form.canExecute,
    });

    return { aiFilledValues, form };
  }

  // One AI fill pass: present the current form fields and ask the AI for values it's confident
  // about. The strict leave-empty rule (never guess) lives in the prompt + tool description.
  private async askAiToFillForm(form: ActionForm): Promise<Record<string, unknown>> {
    const { stepDefinition: step } = this.context;
    const fieldLines = form.fields
      .map(field => {
        const parts = [`- ${field.name} (${field.type}${field.isRequired ? ', required' : ''})`];
        if (field.enumValues?.length) parts.push(`allowed: ${field.enumValues.join(', ')}`);

        if (field.value !== undefined && field.value !== null) {
          parts.push(`current: ${JSON.stringify(field.value)}`);
        }

        return parts.join(' — ');
      })
      .join('\n');

    const tool = new DynamicStructuredTool({
      name: 'fill_action_form',
      description:
        'Provide values for the action form fields you have enough context to fill. ' +
        'Return a `values` object keyed by field name. Leave a field OUT entirely if you are ' +
        'not sure — never guess or assume. For Enum fields use exactly one of the allowed values.',
      schema: z.object({
        values: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('Field name → value, only for fields you are confident about.'),
      }),
      func: undefined,
    });

    const contextMessage = this.buildContextMessage();
    const previousStepsMessages = await this.buildPreviousStepsMessages();
    const messages = [
      contextMessage,
      ...previousStepsMessages,
      new SystemMessage(FILL_FORM_SYSTEM_PROMPT),
      new SystemMessage(`Action form fields:\n${fieldLines}`),
      new HumanMessage(`**Request**: ${step.prompt ?? 'Fill the action form.'}`),
    ];

    // Debug: AI form inputs (request, fields, context); logged before the call to trace mis-fills.
    this.context.logger('Debug', 'AI form-fill: context', {
      ...this.logCtx,
      request: step.prompt ?? null,
      fields: form.fields.map(field => ({
        name: field.name,
        type: field.type,
        required: field.isRequired,
        current: field.value,
        ...(field.enumValues?.length ? { allowed: field.enumValues } : {}),
      })),
      workflowContext: [contextMessage, ...previousStepsMessages].map(message => message.content),
    });

    const { values } = await this.invokeWithTool<{ values?: Record<string, unknown> }>(
      messages,
      tool,
    );

    this.context.logger('Debug', 'AI form-fill: values returned by the AI', {
      ...this.logCtx,
      values: values ?? {},
    });

    return values ?? {};
  }

  /** Branch B — executor runs the action via the audited agent, then persists the result. */
  private async executeOnExecutor(
    target: ActionTarget,
    // Form submission (Full AI): the AI-filled values to submit + the ordered prefill for
    // the audit trail. Omitted for a formless action (executor just triggers it).
    form?: { values: Record<string, unknown>; aiFilledValues: AiFilledFormValue[] },
  ): Promise<StepExecutionResult> {
    const { selectedRecordRef, displayName, name } = target;

    const outcome = await this.context.agent.executeAction(
      {
        collection: selectedRecordRef.collectionName,
        action: name,
        id: selectedRecordRef.recordId,
        ...(form && { values: form.values }),
      },
      {
        beforeCall: () =>
          this.context.runStore.saveStepExecution(this.context.runId, {
            type: 'trigger-action',
            stepIndex: this.context.stepIndex,
            selectedRecordRef,
            idempotencyPhase: 'executing',
          }),
      },
    );

    const submission = form && {
      submittedBy: 'ai' as const,
      submittedValues: form.values,
      ...(form.aiFilledValues.length && { aiFilledValues: form.aiFilledValues }),
    };

    if ('approvalRequested' in outcome) {
      await this.context.runStore.saveStepExecution(this.context.runId, {
        type: 'trigger-action',
        stepIndex: this.context.stepIndex,
        executionParams: { displayName, name },
        executionResult: {
          success: true,
          submissionOutcome: 'pending-approval',
          ...(submission || { submittedBy: 'ai' as const }),
          ...(outcome.approvalRequest && { approvalRequest: outcome.approvalRequest }),
        },
        selectedRecordRef,
        idempotencyPhase: 'done',
      });

      return this.buildOutcomeResult({
        status: 'success',
        ...(outcome.approvalRequest && { approvalRequest: outcome.approvalRequest }),
      });
    }

    await this.context.runStore.saveStepExecution(this.context.runId, {
      type: 'trigger-action',
      stepIndex: this.context.stepIndex,
      executionParams: { displayName, name },
      executionResult: {
        success: true,
        actionResult: outcome.result,
        // Form-bearing Full AI: record what the executor submitted.
        ...(submission && { submissionOutcome: 'executed', ...submission }),
      },
      selectedRecordRef,
      idempotencyPhase: 'done',
    });

    return this.buildOutcomeResult({ status: 'success' });
  }

  /**
   * Branch A — the frontend executed the action natively; the executor persists what it reported.
   * Records the submission outcome (executed vs pending-approval), the submitted values, and the
   * AI prefill (from the stored pending payload) for the audit trail / downstream-AI context.
   */
  private async saveFrontendResult(
    target: ActionTarget,
    existingExecution: TriggerRecordActionStepExecutionData,
  ): Promise<StepExecutionResult> {
    const { selectedRecordRef, displayName, name } = target;
    const confirmation = existingExecution.userConfirmation;
    const submissionOutcome = confirmation?.submissionOutcome ?? 'executed';
    const aiFilledValues = existingExecution.pendingData?.form?.aiFilledValues;

    await this.context.runStore.saveStepExecution(this.context.runId, {
      ...existingExecution,
      type: 'trigger-action',
      stepIndex: this.context.stepIndex,
      executionParams: { displayName, name },
      executionResult: {
        success: true,
        // No action result exists yet when the submission only created an approval request.
        ...(submissionOutcome === 'executed' && { actionResult: confirmation?.actionResult }),
        submissionOutcome,
        // AI-assisted = the human submitted natively (audit).
        submittedBy: 'user',
        ...(confirmation?.submittedValues && { submittedValues: confirmation.submittedValues }),
        ...(aiFilledValues?.length && { aiFilledValues }),
      },
      selectedRecordRef,
    });

    return this.buildOutcomeResult({ status: 'success' });
  }

  private async selectAction(
    schema: CollectionSchema,
    prompt: string | undefined,
  ): Promise<{ actionName: string }> {
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

    const { actionName } = await this.invokeWithTool<{ actionName: string; reasoning: string }>(
      messages,
      tool,
    );

    return { actionName: this.findAction(schema, actionName)?.name ?? actionName };
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

  private findActionByTechnicalName(
    schema: CollectionSchema,
    name: string,
  ): ActionSchema | undefined {
    return schema.actions.find(a => a.name === name);
  }

  private findAction(schema: CollectionSchema, name: string): ActionSchema | undefined {
    return (
      schema.actions.find(a => a.displayName === name) ?? schema.actions.find(a => a.name === name)
    );
  }
}
