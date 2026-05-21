import type { StepExecutionResult } from '../types/execution-context';
import type { GuidanceStepDefinition } from '../types/validated/step-definition';
import type { RecordStepStatus } from '../types/validated/step-outcome';

import { StepStateError } from '../errors';
import BaseStepExecutor from './base-step-executor';
import patchBodySchemas from '../http/pending-data-validators';
import { StepExecutionMode } from '../types/validated/step-definition';

export default class GuidanceStepExecutor extends BaseStepExecutor<GuidanceStepDefinition> {
  protected async doExecute(): Promise<StepExecutionResult> {
    this.warnIfUnsupportedExecutionType([StepExecutionMode.Manual], StepExecutionMode.Manual);

    const { incomingPendingData } = this.context;

    if (!incomingPendingData) {
      return this.buildOutcomeResult({ status: 'awaiting-input' });
    }

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
