import type { StepExecutionResult } from '../types/execution-context';
import type { RecordRef } from '../types/validated/collection';
import type { StepDefinition } from '../types/validated/step-definition';
import type { RecordStepStatus } from '../types/validated/step-outcome';

import { InvalidPreRecordedArgsError } from '../errors';
import BaseStepExecutor from './base-step-executor';

export default abstract class RecordStepExecutor<
  TStep extends StepDefinition = StepDefinition,
> extends BaseStepExecutor<TStep> {
  protected buildOutcomeResult(outcome: {
    status: RecordStepStatus;
    error?: string;
  }): StepExecutionResult {
    return {
      stepOutcome: {
        type: 'record',
        stepId: this.context.stepId,
        stepIndex: this.context.stepIndex,
        ...outcome,
      },
    };
  }

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
