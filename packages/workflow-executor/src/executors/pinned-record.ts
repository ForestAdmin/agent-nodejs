import type { ExecutionContext } from '../types/execution-context';
import type { StepExecutionData } from '../types/step-execution-data';
import type { RecordRef } from '../types/validated/collection';
import type { CallScope, Step } from '../types/validated/execution';
import type { LoadRelatedRecordStepDefinition } from '../types/validated/step-definition';
import type { ErrorKind } from '../types/validated/step-outcome';

import {
  SourceLoadsSeveralRecordsError,
  SourceRecordCollectionMismatchError,
  SourceRecordMissingError,
  SourceRecordStepNotReachedError,
  SourceRunsOncePerRecordError,
} from '../errors';
import { findLatestStepInFrame, findStepExecution } from './base-step-executor';
import { isPerRecordExecution } from '../types/step-execution-data';
import { StepType } from '../types/validated/step-definition';

// Candidates passed over are the operator's call, and none at all is a source the operator can go
// back to. Neither is a configuration fault, so neither is classified as one.
export function classifyMissingSourceRecord(execution?: StepExecutionData): ErrorKind | undefined {
  if (execution?.type !== 'load-related-record') return undefined;

  const { pendingData, executionResult } = execution;

  // A result outside the declared shape signals an executor defect, not a decision the run made.
  if (executionResult !== undefined && !('skipped' in executionResult)) return undefined;

  // Nothing was ever offered: only Full AI continues without pausing, so there was no choice to make.
  if (!pendingData) return executionResult !== undefined ? 'empty-source' : undefined;

  // Whether it paused or recorded a decline, the candidate list says whether there was a choice.
  return pendingData.availableRecordIds.length > 0 ? 'operator' : 'empty-source';
}

// The step a pin names.
export function findPinnedLoadStep(
  previousSteps: readonly Step[],
  stepId: string,
  frameStepIndexes?: number[],
): Step | undefined {
  return findLatestStepInFrame(previousSteps, StepType.LoadRelatedRecord, stepId, frameStepIndexes);
}

// A call carrying a pin, "workflow start" included. A call pinning nothing has no record of its own.
export function isPinnedCall(callScope: CallScope | undefined): boolean {
  return Boolean(callScope?.selectedRecordStepId || callScope?.isPinned);
}

// Every record a load-related-record execution loaded: one, several, or one per record it ran for.
export function loadedRecordsOf(execution: StepExecutionData | undefined): RecordRef[] {
  if (isPerRecordExecution(execution)) {
    return execution.iterations.flatMap(iteration => {
      const result = iteration.executionResult;

      return result && 'record' in result ? [result.record] : [];
    });
  }

  if (execution?.type !== 'load-related-record' || execution.executionResult === undefined) {
    return [];
  }

  const result = execution.executionResult;
  if ('records' in result) return result.records;

  return 'record' in result ? [result.record] : [];
}

// Undefined on a miss so each caller names its own error. A call's pin passes its frame, and
// the record index the orchestrator gave a call opened once per record of a Multiple step.
export async function resolveStepRecordRef(
  context: ExecutionContext,
  stepId: string,
  frameStepIndexes?: number[],
  isCallPin = false,
): Promise<RecordRef | undefined> {
  const sourceStep = findPinnedLoadStep(context.previousSteps, stepId, frameStepIndexes);

  if (sourceStep) {
    const stepExecutions = await context.runStore.getStepExecutions(context.runId);
    const execution = findStepExecution(sourceStep, stepExecutions);
    const { title } = sourceStep.stepDefinition;

    // A step that ran once per record keeps what it loaded in its iterations, not in a result. A
    // step's own pin on one runs once per record, so a call's pin is the one expected here.
    if (isPerRecordExecution(execution)) {
      throw isCallPin
        ? new SourceRunsOncePerRecordError(title)
        : new SourceLoadsSeveralRecordsError(title);
    }

    const result = execution?.type === 'load-related-record' && execution.executionResult;

    if (result && 'record' in result) return result.record;

    // A call opened once per record reads its pinned step narrowed to its record, above, so a
    // call's pin on a Multiple step gets here only when the call was opened once for all of them.
    if (result && 'records' in result) throw new SourceLoadsSeveralRecordsError(title);

    // The source step exists but loaded nothing → clear "no source record" message,
    // distinct from a config pointing at a non-existent step. A call's pin on an empty Multiple
    // step gets here: with no record loaded, the orchestrator opened one call without an index.
    const isList =
      isCallPin &&
      (sourceStep.stepDefinition as LoadRelatedRecordStepDefinition).preRecordedArgs?.multiple ===
        true;

    throw new SourceRecordMissingError(sourceStep.stepDefinition.title, {
      errorKind: classifyMissingSourceRecord(execution),
      errorSourceStepIndex: sourceStep.stepOutcome.stepIndex,
      ...(isList && {
        emptyList: {
          recordsName:
            execution?.type === 'load-related-record'
              ? execution.executionParams?.displayName
              : undefined,
          forCall: true,
        },
      }),
    });
  }

  return undefined;
}

// The record "workflow start" names: the run's record, or inside a pinned call the call's record.
export async function resolveWorkflowStartRecordRef(context: ExecutionContext): Promise<RecordRef> {
  const { callScope, baseRecordRef } = context;
  if (!callScope) return baseRecordRef;

  // A call pinning nothing keeps the behaviour it had before the pin existed, whatever
  // collection the called workflow is on, until the Editor sets one.
  if (!isPinnedCall(callScope)) return baseRecordRef;

  // A call pinning "workflow start" all the way out pins the run's record, and is still checked.
  let record = baseRecordRef;

  if (callScope.selectedRecordStepId) {
    const pinned = await resolveStepRecordRef(
      context,
      callScope.selectedRecordStepId,
      callScope.pinnedFrameStepIndexes,
      true,
    );
    // The pin names a step of the calling workflow, so a miss is that Sub-workflow step's to fix.
    if (!pinned) throw new SourceRecordStepNotReachedError(callScope.selectedRecordStepId);
    record = pinned;
  }

  // The called workflow's steps were built against its own collection, so a record of another one
  // is refused rather than acted on.
  if (
    callScope.calledWorkflowCollectionName !== undefined &&
    record.collectionName !== callScope.calledWorkflowCollectionName
  ) {
    throw new SourceRecordCollectionMismatchError(
      record.collectionName,
      callScope.calledWorkflowCollectionName,
    );
  }

  return record;
}
