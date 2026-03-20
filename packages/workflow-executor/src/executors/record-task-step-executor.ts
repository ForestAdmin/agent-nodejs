import type { StepExecutionResult } from '../types/execution';
import type { RecordRef } from '../types/record';
import type { StepDefinition } from '../types/step-definition';
import type { StepExecutionData } from '../types/step-execution-data';
import type { RecordTaskStepStatus } from '../types/step-outcome';

import { WorkflowExecutorError } from '../errors';
import BaseStepExecutor from './base-step-executor';

/** Execution data that includes the fields required by the confirmation flow. */
type WithPendingData = StepExecutionData & { pendingData?: object; selectedRecordRef: RecordRef };

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
   * Shared confirmation flow for executors that require user approval before acting.
   * Handles the find → guard → skipped → delegate pattern.
   */
  protected async handleConfirmationFlow<TExec extends WithPendingData>(
    typeDiscriminator: string,
    resolveAndExecute: (execution: TExec) => Promise<StepExecutionResult>,
  ): Promise<StepExecutionResult> {
    const stepExecutions = await this.context.runStore.getStepExecutions(this.context.runId);
    const execution = stepExecutions.find(
      (e): e is TExec =>
        (e as TExec).type === typeDiscriminator && e.stepIndex === this.context.stepIndex,
    );

    if (!execution) {
      throw new WorkflowExecutorError(
        `No execution record found for step at index ${this.context.stepIndex}`,
      );
    }

    if (!execution.pendingData) {
      throw new WorkflowExecutorError(
        `Step at index ${this.context.stepIndex} has no pending data`,
      );
    }

    if (!this.context.userConfirmed) {
      await this.context.runStore.saveStepExecution(this.context.runId, {
        ...execution,
        executionResult: { skipped: true },
      } as StepExecutionData);

      return this.buildOutcomeResult({ status: 'success' });
    }

    return resolveAndExecute(execution);
  }
}
