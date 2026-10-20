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

    it('does not throw when selectedRecordRef is absent (Full AI no-source skip)', () => {
      const step: LoadRelatedRecordStepExecutionData = {
        type: 'load-related-record',
        stepIndex: 2,
        executionResult: { skipped: true },
      };

      const result = serializeStepForWire(step) as Record<string, unknown>;

      expect(result.executionResult).toEqual({ skipped: true });
      expect('selectedRecordRef' in result).toBe(false);
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

  describe('a Multiple step and a step running once per record', () => {
    it('serializes every record a Multiple step loaded and the records the AI picked', () => {
      const step = {
        type: 'load-related-record',
        stepIndex: 1,
        pendingData: {
          availableFields: [{ name: 'ubos', displayName: 'UBOs' }],
          suggestedField: { name: 'ubos', displayName: 'UBOs' },
          availableRecordIds: [{ recordId: ['a', 1], referenceFieldValue: 'A' }],
          suggestedRecords: [{ recordId: ['a', 1], referenceFieldValue: 'A' }],
          hasMoreRecords: true,
        },
        selectedRecordRef: makeRecordRef([7]),
        executionResult: {
          relation: { name: 'ubos', displayName: 'UBOs' },
          records: [makeRecordRef(['a', 1], 1), makeRecordRef([2], 1)],
        },
      } as unknown as StepExecutionData;

      const result = serializeStepForWire(step) as {
        pendingData: { suggestedRecords: Array<{ recordId: unknown }>; hasMoreRecords: boolean };
        executionResult: { records: Array<{ recordId: unknown }> };
      };

      expect(result.pendingData.suggestedRecords.map(r => r.recordId)).toStrictEqual(['a|1']);
      expect(result.pendingData.hasMoreRecords).toBe(true);
      expect(result.executionResult.records.map(r => r.recordId)).toStrictEqual(['a|1', '2']);
    });

    it("serializes each iteration's records the way the step's own fields would be", () => {
      const step = {
        type: 'load-related-record',
        stepIndex: 2,
        iterations: [
          {
            sourceRecordRef: makeRecordRef(['u', 1], 1),
            selectedRecordRef: makeRecordRef(['u', 1], 1),
            attempt: 1,
            pendingData: {
              availableFields: [],
              suggestedField: { name: 'address', displayName: 'Address' },
              availableRecordIds: [{ recordId: ['ad', 9], referenceFieldValue: null }],
              suggestedRecord: { recordId: ['ad', 9], referenceFieldValue: null },
            },
            executionResult: {
              relation: { name: 'address', displayName: 'Address' },
              record: makeRecordRef(['ad', 9], 2),
            },
          },
          { sourceRecordRef: makeRecordRef([2], 1), attempt: 1 },
        ],
      } as unknown as StepExecutionData;

      const result = serializeStepForWire(step) as {
        iterations: Array<Record<string, { recordId?: unknown } & Record<string, unknown>>>;
      };

      expect(result.iterations[0].sourceRecordRef.recordId).toBe('u|1');
      expect(result.iterations[0].selectedRecordRef.recordId).toBe('u|1');
      expect((result.iterations[0].executionResult.record as { recordId: unknown }).recordId).toBe(
        'ad|9',
      );
      expect(
        (result.iterations[0].pendingData.suggestedRecord as { recordId: unknown }).recordId,
      ).toBe('ad|9');
      expect(result.iterations[1]).toStrictEqual({
        sourceRecordRef: { collectionName: 'orders', recordId: '2', stepIndex: 1 },
        attempt: 1,
      });
    });
  });
});
