import type { StepExecutionData } from '../../src/types/step-execution-data';

import StepExecutionFormatters from '../../src/executors/summary/step-execution-formatters';

describe('StepExecutionFormatters', () => {
  describe('format', () => {
    describe('load-related-record', () => {
      it('returns the full Loaded: line for a completed execution', () => {
        const execution: StepExecutionData = {
          type: 'load-related-record',
          stepIndex: 1,
          selectedRecordRef: { collectionName: 'customers', recordId: [42], stepIndex: 0 },
          executionResult: {
            relation: { name: 'address', displayName: 'Address' },
            record: { collectionName: 'addresses', recordId: [1], stepIndex: 1 },
          },
        };

        expect(StepExecutionFormatters.format(execution)).toBe(
          '  Loaded: customers #42 → [Address] → addresses #1 (step 1)',
        );
      });

      it('returns null for a skipped execution', () => {
        const execution: StepExecutionData = {
          type: 'load-related-record',
          stepIndex: 1,
          selectedRecordRef: { collectionName: 'customers', recordId: [42], stepIndex: 0 },
          executionResult: { skipped: true },
        };

        expect(StepExecutionFormatters.format(execution)).toBeNull();
      });

      it('returns null when executionResult is absent (pending phase)', () => {
        const execution: StepExecutionData = {
          type: 'load-related-record',
          stepIndex: 1,
          selectedRecordRef: { collectionName: 'customers', recordId: [42], stepIndex: 0 },
          pendingData: {
            displayName: 'Address',
            name: 'address',
            relatedCollectionName: 'addresses',
            suggestedRecordId: [1],
          },
        };

        expect(StepExecutionFormatters.format(execution)).toBeNull();
      });

      it('formats composite record IDs joined by ", "', () => {
        const execution: StepExecutionData = {
          type: 'load-related-record',
          stepIndex: 1,
          selectedRecordRef: { collectionName: 'customers', recordId: [42, 'abc'], stepIndex: 0 },
          executionResult: {
            relation: { name: 'orders', displayName: 'Orders' },
            record: { collectionName: 'orders', recordId: [1, 'xyz'], stepIndex: 1 },
          },
        };

        expect(StepExecutionFormatters.format(execution)).toBe(
          '  Loaded: customers #42, abc → [Orders] → orders #1, xyz (step 1)',
        );
      });
    });

    describe('mcp-task', () => {
      it('returns the Result: line when formattedResponse is present', () => {
        const execution: StepExecutionData = {
          type: 'mcp-task',
          stepIndex: 2,
          executionParams: { name: 'search_records', input: { query: 'foo' } },
          executionResult: {
            success: true,
            toolResult: { items: [] },
            formattedResponse: 'No records found.',
          },
        };

        expect(StepExecutionFormatters.format(execution)).toBe('  Result: No records found.');
      });

      it('returns a generic Executed: line when formattedResponse is absent', () => {
        const execution: StepExecutionData = {
          type: 'mcp-task',
          stepIndex: 2,
          executionParams: { name: 'search_records', input: { query: 'foo' } },
          executionResult: { success: true, toolResult: { items: [] } },
        };

        expect(StepExecutionFormatters.format(execution)).toBe(
          '  Executed: search_records (result not summarized)',
        );
      });

      it('returns null when executionResult is absent (pending phase)', () => {
        const execution: StepExecutionData = {
          type: 'mcp-task',
          stepIndex: 2,
          pendingData: { name: 'search_records', input: {} },
        };

        expect(StepExecutionFormatters.format(execution)).toBeNull();
      });

      it('returns null for a skipped execution', () => {
        const execution: StepExecutionData = {
          type: 'mcp-task',
          stepIndex: 2,
          executionResult: { skipped: true },
        };

        expect(StepExecutionFormatters.format(execution)).toBeNull();
      });
    });

    describe('types without a custom formatter', () => {
      it('returns null for condition type', () => {
        const execution: StepExecutionData = {
          type: 'condition',
          stepIndex: 0,
          executionParams: { answer: 'Yes' },
          executionResult: { answer: 'Yes' },
        };

        expect(StepExecutionFormatters.format(execution)).toBeNull();
      });

      it('returns null for record-task type', () => {
        const execution: StepExecutionData = {
          type: 'record-task',
          stepIndex: 0,
          executionResult: { success: true },
        };

        expect(StepExecutionFormatters.format(execution)).toBeNull();
      });
    });
  });
});
