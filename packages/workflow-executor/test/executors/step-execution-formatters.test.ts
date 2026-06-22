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
            availableFields: [{ name: 'address', displayName: 'Address' }],
            suggestedField: { name: 'address', displayName: 'Address' },
            availableRecordIds: [{ recordId: [1], referenceFieldValue: null }],
            suggestedRecord: { recordId: [1], referenceFieldValue: null },
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

    describe('mcp', () => {
      it('returns the Result: line when formattedResponse is present', () => {
        const execution: StepExecutionData = {
          type: 'mcp',
          stepIndex: 2,
          executionParams: {
            name: 'search_records',
            sourceId: 'mcp-server-1',
            input: { query: 'foo' },
          },
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
          type: 'mcp',
          stepIndex: 2,
          executionParams: {
            name: 'search_records',
            sourceId: 'mcp-server-1',
            input: { query: 'foo' },
          },
          executionResult: { success: true, toolResult: { items: [] } },
        };

        expect(StepExecutionFormatters.format(execution)).toBe(
          '  Executed: search_records (result not summarized)',
        );
      });

      it('returns null when executionResult is absent (pending phase)', () => {
        const execution: StepExecutionData = {
          type: 'mcp',
          stepIndex: 2,
          pendingData: { name: 'search_records', sourceId: 'mcp-server-1', input: {} },
        };

        expect(StepExecutionFormatters.format(execution)).toBeNull();
      });

      it('returns null for a skipped execution', () => {
        const execution: StepExecutionData = {
          type: 'mcp',
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

      it('returns null for record type', () => {
        const execution: StepExecutionData = {
          type: 'record',
          stepIndex: 0,
          executionResult: { success: true },
        };

        expect(StepExecutionFormatters.format(execution)).toBeNull();
      });
    });

    describe('guidance', () => {
      it('returns the user input line when executionResult is present', () => {
        const execution: StepExecutionData = {
          type: 'guidance',
          stepIndex: 0,
          executionResult: { userInput: 'I called the client and confirmed the delivery date.' },
        };

        expect(StepExecutionFormatters.format(execution)).toBe(
          '  The user provided the following input: "I called the client and confirmed the delivery date."',
        );
      });

      it('returns null when executionResult is absent', () => {
        const execution: StepExecutionData = {
          type: 'guidance',
          stepIndex: 0,
        };

        expect(StepExecutionFormatters.format(execution)).toBeNull();
      });
    });

    describe('trigger-action', () => {
      const recordRef = { collectionName: 'customers', recordId: [42], stepIndex: 0 };

      it('marks a pending-approval submission as NOT executed', () => {
        const execution: StepExecutionData = {
          type: 'trigger-action',
          stepIndex: 1,
          selectedRecordRef: recordRef,
          executionParams: { name: 'refund', displayName: 'Process refund' },
          executionResult: {
            success: true,
            submissionOutcome: 'pending-approval',
            submittedBy: 'user',
          },
        };

        const summary = StepExecutionFormatters.format(execution);
        expect(summary).toContain('AWAITING APPROVAL');
        expect(summary).toContain('has NOT been executed');
      });

      it('reports a Full AI execution as submitted by AI with the pre-filled fields', () => {
        const execution: StepExecutionData = {
          type: 'trigger-action',
          stepIndex: 1,
          selectedRecordRef: recordRef,
          executionParams: { name: 'refund', displayName: 'Process refund' },
          executionResult: {
            success: true,
            actionResult: { ok: true },
            submissionOutcome: 'executed',
            submittedBy: 'ai',
            submittedValues: { amount: 50 },
            aiFilledValues: [{ field: 'amount', value: 50 }],
          },
        };

        const summary = StepExecutionFormatters.format(execution) ?? '';
        expect(summary).toContain('submitted by AI');
        expect(summary).toContain('AI pre-filled: amount');
      });

      it('reports human edits in AI-assisted mode (diff prefill vs submitted)', () => {
        const execution: StepExecutionData = {
          type: 'trigger-action',
          stepIndex: 1,
          selectedRecordRef: recordRef,
          executionParams: { name: 'refund', displayName: 'Process refund' },
          executionResult: {
            success: true,
            actionResult: { ok: true },
            submissionOutcome: 'executed',
            submittedBy: 'user',
            // AI proposed amount 50; the human changed it to 80 before submitting.
            aiFilledValues: [{ field: 'amount', value: 50 }],
            submittedValues: { amount: 80 },
          },
        };

        const summary = StepExecutionFormatters.format(execution) ?? '';
        expect(summary).toContain('submitted by the user');
        expect(summary).toContain('Edited by the user before submitting: amount');
      });

      it('returns null for a skipped action', () => {
        const execution: StepExecutionData = {
          type: 'trigger-action',
          stepIndex: 1,
          selectedRecordRef: recordRef,
          executionResult: { skipped: true },
        };

        expect(StepExecutionFormatters.format(execution)).toBeNull();
      });
    });
  });
});
