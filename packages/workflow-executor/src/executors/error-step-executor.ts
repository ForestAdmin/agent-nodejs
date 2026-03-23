import type { Logger } from '../ports/logger-port';
import type { IStepExecutor, PendingStepExecution, StepExecutionResult } from '../types/execution';

import { causeMessage } from '../errors';
import { stepTypeToOutcomeType } from '../types/step-outcome';

export default class ErrorStepExecutor implements IStepExecutor {
  constructor(
    private readonly step: PendingStepExecution,
    private readonly error: unknown,
    private readonly logger: Logger,
  ) {}

  async execute(): Promise<StepExecutionResult> {
    this.logger.error('Step execution failed unexpectedly', {
      runId: this.step.runId,
      stepId: this.step.stepId,
      stepIndex: this.step.stepIndex,
      error: this.error instanceof Error ? this.error.message : String(this.error),
      cause: causeMessage(this.error),
      stack: this.error instanceof Error ? this.error.stack : undefined,
    });

    return {
      stepOutcome: {
        type: stepTypeToOutcomeType(this.step.stepDefinition.type),
        stepId: this.step.stepId,
        stepIndex: this.step.stepIndex,
        status: 'error',
        error: 'An unexpected error occurred.',
      },
    };
  }
}
