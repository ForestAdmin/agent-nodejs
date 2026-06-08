import type {
  LoadRelatedRecordStepExecutionData,
  StepExecutionData,
} from '../../src/types/step-execution-data';
import type { RecordRef } from '../../src/types/validated/collection';

import serializeStepForWire from '../../src/http/step-serializer';

function makeRecordRef(recordId: RecordRef['recordId'], stepIndex = 0): RecordRef {
  return { collectionName: 'orders', recordId, stepIndex };
}

describe('serializeStepForWire', () => {
  describe('record steps (read/update/trigger)', () => {
    it('serializes a composite selectedRecordRef.recordId to the pipe wire format', () => {
      const step: StepExecutionData = {
        type: 'update-record',
        stepIndex: 1,
        selectedRecordRef: makeRecordRef(['order-1', 42]),
        executionResult: { updatedValues: { status: 'active' } },
      };

      const result = serializeStepForWire(step) as { selectedRecordRef: { recordId: unknown } };

      expect(result.selectedRecordRef.recordId).toBe('order-1|42');
    });
  });

  describe('load-related-record', () => {
    it('serializes recordIds in pendingData (availableRecordIds + suggestedRecord) and the selectedRecordRef', () => {
      const step: LoadRelatedRecordStepExecutionData = {
        type: 'load-related-record',
        stepIndex: 2,
        selectedRecordRef: makeRecordRef(['cust-1']),
        pendingData: {
          availableFields: [{ name: 'order', displayName: 'Order' }],
          suggestedField: { name: 'order', displayName: 'Order' },
          availableRecordIds: [
            { recordId: ['o-1', 7], referenceFieldValue: 'A' },
            { recordId: ['o-2', 8], referenceFieldValue: 'B' },
          ],
          suggestedRecord: { recordId: ['o-1', 7], referenceFieldValue: 'A' },
        },
      };

      const result = serializeStepForWire(step) as {
        selectedRecordRef: { recordId: unknown };
        pendingData: {
          availableRecordIds: Array<{ recordId: unknown }>;
          suggestedRecord: { recordId: unknown };
        };
      };

      expect(result.selectedRecordRef.recordId).toBe('cust-1');
      expect(result.pendingData.availableRecordIds.map(c => c.recordId)).toEqual([
        'o-1|7',
        'o-2|8',
      ]);
      expect(result.pendingData.suggestedRecord.recordId).toBe('o-1|7');
    });

    it('omits suggestedRecord when the relation has no linked record', () => {
      const step: LoadRelatedRecordStepExecutionData = {
        type: 'load-related-record',
        stepIndex: 2,
        selectedRecordRef: makeRecordRef(['cust-1']),
        pendingData: {
          availableFields: [{ name: 'order', displayName: 'Order' }],
          suggestedField: { name: 'order', displayName: 'Order' },
          availableRecordIds: [],
        },
      };

      const result = serializeStepForWire(step) as { pendingData: Record<string, unknown> };

      expect(result.pendingData.availableRecordIds).toEqual([]);
      expect('suggestedRecord' in result.pendingData).toBe(false);
    });

    it('does not add a pendingData key when there is no pendingData', () => {
      const step: LoadRelatedRecordStepExecutionData = {
        type: 'load-related-record',
        stepIndex: 2,
        selectedRecordRef: makeRecordRef(['cust-1']),
        executionResult: {
          relation: { name: 'order', displayName: 'Order' },
          record: makeRecordRef(['o-1', 7], 2),
        },
      };

      const result = serializeStepForWire(step) as Record<string, unknown> & {
        executionResult: { record: { recordId: unknown } };
      };

      expect('pendingData' in result).toBe(false);
      expect(result.executionResult.record.recordId).toBe('o-1|7');
    });

    it('passes a skipped executionResult through untouched (no record to serialize)', () => {
      const step: LoadRelatedRecordStepExecutionData = {
        type: 'load-related-record',
        stepIndex: 2,
        selectedRecordRef: makeRecordRef(['cust-1']),
        executionResult: { skipped: true },
      };

      const result = serializeStepForWire(step) as { executionResult: unknown };

      expect(result.executionResult).toEqual({ skipped: true });
    });
  });

  it('returns non-record steps unchanged', () => {
    const step: StepExecutionData = {
      type: 'guidance',
      stepIndex: 0,
      executionResult: { userInput: 'noted' },
    };

    expect(serializeStepForWire(step)).toBe(step);
  });
});
