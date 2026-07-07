import type { StepExecutionResult } from '../types/execution-context';
import type { GuidanceStepExecutionData } from '../types/step-execution-data';
import type { GuidanceStepDefinition } from '../types/validated/step-definition';
import type { RecordStepStatus } from '../types/validated/step-outcome';

import { DynamicStructuredTool, HumanMessage, SystemMessage } from '@forestadmin/ai-proxy';
import { z } from 'zod';

import { AiAssistUnavailableError, StepStateError, extractErrorMessage } from '../errors';
import BaseStepExecutor from './base-step-executor';
import patchBodySchemas from '../http/pending-data-validators';
import { StepExecutionMode } from '../types/validated/step-definition';

const GUIDANCE_RESPONSE_SYSTEM_PROMPT = `You are completing a free-text response step in a business workflow on behalf of the operator.
Write the response the operator would type, using the step instructions and the workflow context (trigger record, previous steps).
- Answer the instructions directly; do not narrate what you are doing or address the operator.
- Keep a reasonable length: a few sentences unless the instructions clearly require more.
- Use only facts available in the context — never invent names, dates, amounts or identifiers.
- Plain text only (no markdown headings or code blocks).`;

// The trigger record grounds the AI; cap field count and value length to keep the prompt bounded.
const MAX_TRIGGER_RECORD_FIELDS = 40;
const MAX_TRIGGER_FIELD_VALUE_LENGTH = 200;

function clampFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const serialized = typeof value === 'string' ? value : JSON.stringify(value) ?? '';

  return serialized.length > MAX_TRIGGER_FIELD_VALUE_LENGTH
    ? `${serialized.slice(0, MAX_TRIGGER_FIELD_VALUE_LENGTH)}… (truncated)`
    : serialized;
}

export default class GuidanceStepExecutor extends BaseStepExecutor<GuidanceStepDefinition> {
  protected async doExecute(): Promise<StepExecutionResult> {
    const { incomingPendingData, stepDefinition } = this.context;

    // Submit path (front POST) — identical in all modes, never calls the AI.
    if (incomingPendingData) return this.saveSubmission(incomingPendingData);

    if (stepDefinition.executionType === StepExecutionMode.Manual) {
      return this.buildOutcomeResult({ status: 'awaiting-input' });
    }

    // Never re-run the AI on re-dispatch of the same (runId, stepIndex): replay the stored result.
    const existing = await this.findGuidanceExecution();
    if (existing?.executionResult) return this.buildOutcomeResult({ status: 'success' });
    if (existing?.pendingData) return this.buildOutcomeResult({ status: 'awaiting-input' });

    let draft: string;

    try {
      draft = await this.askAiForResponse();
    } catch (error) {
      if (!(error instanceof AiAssistUnavailableError)) throw error;
      this.logAiDegrade(error.reason);

      return this.degradeToManual();
    }

    // An empty draft is not a submittable answer (even in Full AI) → degrade to manual input.
    if (!draft.trim()) {
      this.context.logger(
        'Warn',
        `${this.context.stepDefinition.type}: AI returned an empty response, degrading to manual`,
        this.logCtx,
      );

      return this.degradeToManual();
    }

    if (stepDefinition.executionType === StepExecutionMode.FullyAutomated) {
      await this.context.runStore.saveStepExecution(this.context.runId, {
        type: 'guidance',
        stepIndex: this.context.stepIndex,
        executionResult: { userInput: draft, generatedByAi: true },
      });

      return this.buildOutcomeResult({ status: 'success' });
    }

    await this.context.runStore.saveStepExecution(this.context.runId, {
      type: 'guidance',
      stepIndex: this.context.stepIndex,
      pendingData: { userInput: draft, aiGenerated: true },
    });

    return this.buildOutcomeResult({ status: 'awaiting-input' });
  }

  private async saveSubmission(incomingPendingData: unknown): Promise<StepExecutionResult> {
    const parsed = patchBodySchemas.guidance.safeParse(incomingPendingData);

    if (!parsed.success) {
      throw new StepStateError(
        `Invalid guidance input: ${parsed.error.issues.map(i => i.message).join(', ')}`,
      );
    }

    const { userInput } = parsed.data as { userInput?: string };

    await this.context.runStore.saveStepExecution(this.context.runId, {
      type: 'guidance',
      stepIndex: this.context.stepIndex,
      executionResult: { userInput: userInput ?? '' },
    });

    return this.buildOutcomeResult({ status: 'success' });
  }

  private async findGuidanceExecution(): Promise<GuidanceStepExecutionData | undefined> {
    const executions = await this.context.runStore.getStepExecutions(this.context.runId);

    return executions.find(
      (e): e is GuidanceStepExecutionData =>
        e.type === 'guidance' && e.stepIndex === this.context.stepIndex,
    );
  }

  // Persists an empty pendingData so the front opens an empty field (no badge) and the AI is not
  // retried on re-dispatch.
  private async degradeToManual(): Promise<StepExecutionResult> {
    await this.context.runStore.saveStepExecution(this.context.runId, {
      type: 'guidance',
      stepIndex: this.context.stepIndex,
      pendingData: {},
    });

    return this.buildOutcomeResult({ status: 'awaiting-input' });
  }

  // Grounds the AI in the record the workflow runs on (without it, a first-step guidance has only
  // the operator's identity in context). Non-fatal: a schema/record fetch failure logs and the AI
  // proceeds without it rather than failing the whole step.
  private async buildTriggerRecordMessages(): Promise<SystemMessage[]> {
    const { baseRecordRef } = this.context;

    try {
      const schema = await this.context.schemaResolver.resolve(baseRecordRef.collectionName);
      const fields = schema.fields
        .filter(field => !field.isRelationship)
        .slice(0, MAX_TRIGGER_RECORD_FIELDS);

      if (!fields.length) return [];

      const record = await this.context.agent.getRecord({
        collection: baseRecordRef.collectionName,
        id: baseRecordRef.recordId,
        fields: fields.map(field => field.fieldName),
      });

      const lines = fields
        .map(field => `- ${field.displayName}: ${clampFieldValue(record.values[field.fieldName])}`)
        .join('\n');

      return [
        new SystemMessage(
          `Trigger record — the ${schema.collectionDisplayName} this workflow is running on:\n${lines}`,
        ),
      ];
    } catch (error) {
      this.context.logger('Warn', 'guidance: could not load the trigger record for AI grounding', {
        ...this.logCtx,
        error: extractErrorMessage(error),
      });

      return [];
    }
  }

  private async askAiForResponse(): Promise<string> {
    const { stepDefinition: step } = this.context;

    const tool = new DynamicStructuredTool({
      name: 'submit_guidance_response',
      description: 'Submit the free-text response for this workflow step.',
      schema: z.object({
        response: z.string().describe('The response text. Plain text, reasonable length.'),
      }),
      func: undefined,
    });

    const contextMessage = this.buildContextMessage();
    const triggerRecordMessages = await this.buildTriggerRecordMessages();
    const previousStepsMessages = await this.buildPreviousStepsMessages();
    const messages = [
      contextMessage,
      ...triggerRecordMessages,
      ...previousStepsMessages,
      new SystemMessage(GUIDANCE_RESPONSE_SYSTEM_PROMPT),
      new HumanMessage(
        `**Step instructions**: ${
          step.prompt ?? step.title ?? 'Provide the response for this step.'
        }`,
      ),
    ];

    this.context.logger('Debug', 'AI guidance-response: context', {
      ...this.logCtx,
      request: step.prompt ?? null,
      workflowContext: [contextMessage, ...triggerRecordMessages, ...previousStepsMessages].map(
        message => message.content,
      ),
    });

    // Wrap only the AI call: buildPreviousStepsMessages above reads the run store, and a store
    // failure must surface, not be mistagged as an AI failure and degraded.
    const { response } = await this.withAiAssist(() =>
      this.invokeWithTool<{ response?: string }>(messages, tool),
    );

    // The tool arg isn't runtime-validated against its zod schema, so coerce a non-string response
    // to '' — otherwise draft.trim() (outside the degrade try/catch) would throw a raw TypeError
    // instead of degrading to manual. Empty/non-string → treated as no usable draft.
    const text = typeof response === 'string' ? response : '';

    this.context.logger('Debug', 'AI guidance-response: text returned by the AI', {
      ...this.logCtx,
      response: text,
    });

    return text;
  }

  protected buildOutcomeResult(outcome: {
    status: RecordStepStatus;
    error?: string;
  }): StepExecutionResult {
    return {
      stepOutcome: {
        type: 'guidance',
        stepId: this.context.stepId,
        stepIndex: this.context.stepIndex,
        ...outcome,
      },
    };
  }
}
