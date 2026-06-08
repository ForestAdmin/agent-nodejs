import type { StepExecutionData } from '../types/step-execution-data';
import type { RecordRef } from '../types/validated/collection';

import { serializeRecordId } from '../adapters/record-id-serializer';

function serializeRecordRef(ref: RecordRef): unknown {
  return { ...ref, recordId: serializeRecordId(ref.recordId) };
}

export default function serializeStepForWire(step: StepExecutionData): unknown {
  switch (step.type) {
    case 'read-record':
    case 'update-record':
    case 'trigger-action':
      return { ...step, selectedRecordRef: serializeRecordRef(step.selectedRecordRef) };

    case 'load-related-record': {
      const result: Record<string, unknown> = {
        ...step,
        selectedRecordRef: serializeRecordRef(step.selectedRecordRef),
      };

      if (step.pendingData) {
        const { availableRecordIds, suggestedRecord } = step.pendingData;

        result.pendingData = {
          ...step.pendingData,
          availableRecordIds: availableRecordIds.map(c => ({
            ...c,
            recordId: serializeRecordId(c.recordId),
          })),
          ...(suggestedRecord && {
            suggestedRecord: {
              ...suggestedRecord,
              recordId: serializeRecordId(suggestedRecord.recordId),
            },
          }),
        };
      }

      if (step.executionResult && 'record' in step.executionResult) {
        result.executionResult = {
          ...step.executionResult,
          record: serializeRecordRef(step.executionResult.record),
        };
      }

      return result;
    }

    default:
      return step;
  }
}
