import type {
  LoadRelatedRecordCandidate,
  LoadRelatedRecordPendingData,
  LoadRelatedRecordStepExecutionData,
  StepExecutionData,
  StepIteration,
} from '../types/step-execution-data';
import type { RecordRef } from '../types/validated/collection';

import { serializeRecordId } from '../record-id';
import { isPerRecordExecution } from '../types/step-execution-data';

function serializeRecordRef(ref: RecordRef): unknown {
  return { ...ref, recordId: serializeRecordId(ref.recordId) };
}

function serializeCandidate(candidate: LoadRelatedRecordCandidate): unknown {
  return { ...candidate, recordId: serializeRecordId(candidate.recordId) };
}

// Fields shared by a load-related-record step and each of its iterations.
function serializeLoadRelatedFields(
  fields: Pick<LoadRelatedRecordStepExecutionData, 'pendingData' | 'executionResult'>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (fields.pendingData) {
    const { availableRecordIds, suggestedRecord, suggestedRecords } = fields.pendingData;

    result.pendingData = {
      ...fields.pendingData,
      availableRecordIds: availableRecordIds.map(serializeCandidate),
      ...(suggestedRecord && { suggestedRecord: serializeCandidate(suggestedRecord) }),
      ...(suggestedRecords && { suggestedRecords: suggestedRecords.map(serializeCandidate) }),
    };
  }

  if (fields.executionResult && 'record' in fields.executionResult) {
    result.executionResult = {
      ...fields.executionResult,
      record: serializeRecordRef(fields.executionResult.record),
    };
  }

  if (fields.executionResult && 'records' in fields.executionResult) {
    result.executionResult = {
      ...fields.executionResult,
      records: fields.executionResult.records.map(serializeRecordRef),
    };
  }

  return result;
}

function serializeIteration(type: StepExecutionData['type'], iteration: StepIteration): unknown {
  return {
    ...iteration,
    sourceRecordRef: serializeRecordRef(iteration.sourceRecordRef),
    ...(iteration.selectedRecordRef && {
      selectedRecordRef: serializeRecordRef(iteration.selectedRecordRef),
    }),
    ...(type === 'load-related-record' &&
      serializeLoadRelatedFields({
        pendingData: iteration.pendingData as LoadRelatedRecordPendingData | undefined,
        executionResult:
          iteration.executionResult as LoadRelatedRecordStepExecutionData['executionResult'],
      })),
  };
}

export default function serializeStepForWire(step: StepExecutionData): unknown {
  if (isPerRecordExecution(step)) {
    return {
      ...step,
      iterations: step.iterations.map(iteration => serializeIteration(step.type, iteration)),
    };
  }

  switch (step.type) {
    case 'read-record':
    case 'update-record':
    case 'trigger-action':
      return { ...step, selectedRecordRef: serializeRecordRef(step.selectedRecordRef) };

    case 'load-related-record':
      // Omit selectedRecordRef when absent — serializing undefined throws.
      return {
        ...step,
        ...(step.selectedRecordRef && {
          selectedRecordRef: serializeRecordRef(step.selectedRecordRef),
        }),
        ...serializeLoadRelatedFields(step),
      };

    default:
      return step;
  }
}
