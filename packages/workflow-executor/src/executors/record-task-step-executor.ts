import type { StepExecutionResult } from '../types/execution';
import type { StepDefinition } from '../types/step-definition';
import type { RecordTaskStepStatus } from '../types/step-outcome';

import BaseStepExecutor from './base-step-executor';

export default abstract class RecordTaskStepExecutor<
  TStep extends StepDefinition = StepDefinition,
> extends BaseStepExecutor<TStep> {
  protected buildOutcomeResult(outcome: {
    status: RecordTaskStepStatus;
    error?: string;
  }): StepExecutionResult {
    return {
      stepOutcome: {
        type: 'record-task',
        stepId: this.context.stepId,
        stepIndex: this.context.stepIndex,
        ...outcome,
      },
    };
  }
}
