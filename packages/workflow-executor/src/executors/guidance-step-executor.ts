import type { StepExecutionResult } from '../types/execution';
import type { GuidanceStepDefinition } from '../types/step-definition';
import type { BaseStepStatus } from '../types/step-outcome';

import { StepStateError } from '../errors';
import patchBodySchemas from '../pending-data-validators';
import BaseStepExecutor from './base-step-executor';

export default class GuidanceStepExecutor extends BaseStepExecutor<GuidanceStepDefinition> {
  protected async doExecute(): Promise<StepExecutionResult> {
    const { incomingPendingData } = this.context;

    if (!incomingPendingData) {
      throw new StepStateError('Guidance step triggered without pending data');
    }

    const schema = patchBodySchemas.guidance;

    if (!schema) {
      throw new StepStateError('No pending data validator for guidance step type');
    }

    const parsed = schema.safeParse(incomingPendingData);

    if (!parsed.success) {
      throw new StepStateError(
        `Invalid guidance input: ${parsed.error.issues.map(i => i.message).join(', ')}`,
      );
    }

    const { userInput } = parsed.data as { userInput: string };

    await this.context.runStore.saveStepExecution(this.context.runId, {
      type: 'guidance',
      stepIndex: this.context.stepIndex,
      executionResult: { userInput },
    });

    return this.buildOutcomeResult({ status: 'success' });
  }

  protected buildOutcomeResult(outcome: {
    status: BaseStepStatus;
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
