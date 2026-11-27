import type { ExecutionContext, StepExecutionResult } from '../types/execution-context';
import type { SkippedForNoRecordStepExecutionData } from '../types/step-execution-data';
import type { ErrorKind, RecordStepStatus } from '../types/validated/step-outcome';

import BaseStepExecutor from './base-step-executor';
import { EMPTY_LOAD_OUTCOME } from './load-related-record-step-executor';
import { StepType } from '../types/validated/step-definition';

// A record step whose load came back empty while set to Skip runs on no record: it keeps the empty
// load it skipped for, which the run view names, and a skipped load tells the orchestrator it
// loaded none, so a Sub-workflow on it is skipped too.
export default class SkippedForNoRecordStepExecutor extends BaseStepExecutor {
  constructor(
    context: ExecutionContext,
    private readonly emptySourceStepIndex: number,
  ) {
    super(context);
  }

  protected async doExecute(): Promise<StepExecutionResult> {
    const { runId, stepIndex, stepDefinition } = this.context;

    await this.context.runStore.saveStepExecution(runId, {
      type: stepDefinition.type as SkippedForNoRecordStepExecutionData['type'],
      stepIndex,
      executionResult: { skipped: true, emptySourceStepIndex: this.emptySourceStepIndex },
    });
    this.context.logger('Info', 'Step skipped: the load it uses loaded no record', {
      ...this.logCtx,
      emptySourceStepIndex: this.emptySourceStepIndex,
    });

    return this.buildOutcomeResult(
      stepDefinition.type === StepType.LoadRelatedRecord ? EMPTY_LOAD_OUTCOME : { status: 'success' },
    );
  }

  protected buildOutcomeResult(outcome: {
    status: RecordStepStatus;
    error?: string;
    errorKind?: ErrorKind;
    errorSourceStepIndex?: number;
    loadedRecordCount?: number;
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
}
