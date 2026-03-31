import type { StepExecutionResult } from '../types/execution';
import type { RecordRef } from '../types/record';
import type { StepDefinition } from '../types/step-definition';
import type { RecordTaskStepStatus } from '../types/step-outcome';

import { InvalidPreRecordedArgsError } from '../errors';
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

  /**
   * Resolves a record ref: uses pre-recorded stepIndex if provided, otherwise delegates to AI.
   */
  protected async resolveRecordRef(
    records: RecordRef[],
    prompt: string | undefined,
    preRecordedStepIndex?: number,
  ): Promise<RecordRef> {
    if (preRecordedStepIndex !== undefined) {
      const match = records.find(r => r.stepIndex === preRecordedStepIndex);

      if (!match) {
        throw new InvalidPreRecordedArgsError(
          `No record found at step index ${preRecordedStepIndex}`,
        );
      }

      return match;
    }

    return this.selectRecordRef(records, prompt);
  }
}
