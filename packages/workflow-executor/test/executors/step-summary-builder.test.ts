import type { StepDefinition } from '../../src/types/step-definition';
import type { StepExecutionData } from '../../src/types/step-execution-data';
import type { StepOutcome } from '../../src/types/step-outcome';

import StepSummaryBuilder from '../../src/executors/step-summary-builder';
import { StepType } from '../../src/types/step-definition';

function makeConditionStep(prompt?: string): StepDefinition {
  return { type: StepType.Condition, options: ['A', 'B'], prompt };
}

function makeConditionOutcome(
  stepId: string,
  stepIndex: number,
  extra: Record<string, unknown> = {},
): StepOutcome {
  return { type: 'condition', stepId, stepIndex, status: 'success', ...extra } as StepOutcome;
}

describe('StepSummaryBuilder', () => {
  describe('build', () => {
    it('renders header, prompt, Input, and Output for a condition step with execution data', () => {
      const step = makeConditionStep('Approve?');
      const outcome = makeConditionOutcome('cond-1', 0);
      const execution: StepExecutionData = {
        type: 'condition',
        stepIndex: 0,
        executionParams: { answer: 'Yes', reasoning: 'Order is valid' },
        executionResult: { answer: 'Yes' },
      };

      const result = StepSummaryBuilder.build(step, outcome, execution);

      expect(result).toContain('Step "cond-1" (index 0):');
      expect(result).toContain('Prompt: Approve?');
      expect(result).toContain('Input: {"answer":"Yes","reasoning":"Order is valid"}');
      expect(result).toContain('Output: {"answer":"Yes"}');
    });

    it('renders Output: when executionResult is present but executionParams is absent', () => {
      const step: StepDefinition = { type: StepType.ReadRecord, prompt: 'Do something' };
      const outcome: StepOutcome = {
        type: 'record-task',
        stepId: 'task-1',
        stepIndex: 0,
        status: 'success',
      };
      const execution: StepExecutionData = {
        type: 'record-task',
        stepIndex: 0,
        executionResult: { success: true },
      };

      const result = StepSummaryBuilder.build(step, outcome, execution);

      expect(result).toContain('Output: {"success":true}');
      expect(result).not.toContain('Input:');
    });

    it('falls back to History when no execution data is provided', () => {
      const step = makeConditionStep('Pick one');
      const outcome = makeConditionOutcome('cond-1', 0);

      const result = StepSummaryBuilder.build(step, outcome, undefined);

      expect(result).toContain('Step "cond-1" (index 0):');
      expect(result).toContain('Prompt: Pick one');
      expect(result).toContain('History: {"status":"success"}');
      expect(result).not.toContain('"stepId"');
      expect(result).not.toContain('"stepIndex"');
      expect(result).not.toContain('"type"');
    });

    it('includes selectedOption in History for condition steps', () => {
      const step = makeConditionStep('Approved?');
      const outcome = makeConditionOutcome('cond-approval', 0, { selectedOption: 'Yes' });

      const result = StepSummaryBuilder.build(step, outcome, undefined);

      expect(result).toContain('"selectedOption":"Yes"');
    });

    it('includes error in History for failed steps', () => {
      const step = makeConditionStep('Do something');
      const outcome: StepOutcome = {
        type: 'condition',
        stepId: 'failing-step',
        stepIndex: 0,
        status: 'error',
        error: 'AI could not match an option',
      };

      const result = StepSummaryBuilder.build(step, outcome, undefined);

      expect(result).toContain('"status":"error"');
      expect(result).toContain('"error":"AI could not match an option"');
    });

    it('omits History type field and includes status for record-task steps', () => {
      const step: StepDefinition = { type: StepType.ReadRecord, prompt: 'Run task' };
      const outcome: StepOutcome = {
        type: 'record-task',
        stepId: 'read-record-1',
        stepIndex: 0,
        status: 'awaiting-input',
      };

      const result = StepSummaryBuilder.build(step, outcome, undefined);

      expect(result).toContain('Step "read-record-1" (index 0):');
      expect(result).toContain('History: {"status":"awaiting-input"}');
    });

    it('omits Input and Output lines when executionParams and executionResult are both absent', () => {
      const step: StepDefinition = { type: StepType.ReadRecord, prompt: 'Do something' };
      const outcome: StepOutcome = {
        type: 'record-task',
        stepId: 'read-record-1',
        stepIndex: 0,
        status: 'success',
      };
      const execution: StepExecutionData = { type: 'record-task', stepIndex: 0 };

      const result = StepSummaryBuilder.build(step, outcome, execution);

      expect(result).toContain('Step "read-record-1" (index 0):');
      expect(result).toContain('Prompt: Do something');
      expect(result).not.toContain('Input:');
      expect(result).not.toContain('Output:');
    });

    it('uses Pending when update-record step has pendingData but no executionParams', () => {
      const step: StepDefinition = { type: StepType.UpdateRecord, prompt: 'Set status to active' };
      const outcome: StepOutcome = {
        type: 'record-task',
        stepId: 'update-1',
        stepIndex: 0,
        status: 'awaiting-input',
      };
      const execution: StepExecutionData = {
        type: 'update-record',
        stepIndex: 0,
        pendingData: { displayName: 'Status', name: 'status', value: 'active' },
        selectedRecordRef: { collectionName: 'customers', recordId: [1], stepIndex: 0 },
      };

      const result = StepSummaryBuilder.build(step, outcome, execution);

      expect(result).toContain('Pending:');
      expect(result).toContain('"displayName":"Status"');
      expect(result).toContain('"value":"active"');
      expect(result).not.toContain('Input:');
    });

    it('uses Pending for trigger-action step with pendingData', () => {
      const step: StepDefinition = {
        type: StepType.TriggerAction,
        prompt: 'Archive the customer',
      };
      const outcome: StepOutcome = {
        type: 'record-task',
        stepId: 'trigger-1',
        stepIndex: 0,
        status: 'awaiting-input',
      };
      const execution: StepExecutionData = {
        type: 'trigger-action',
        stepIndex: 0,
        pendingData: { displayName: 'Archive Customer', name: 'archive' },
        selectedRecordRef: { collectionName: 'customers', recordId: [1], stepIndex: 0 },
      };

      const result = StepSummaryBuilder.build(step, outcome, execution);

      expect(result).toContain('Pending:');
      expect(result).toContain('"displayName":"Archive Customer"');
      expect(result).toContain('"name":"archive"');
      expect(result).not.toContain('Input:');
    });

    it('renders load-related-record completed as Loaded: (no Input: or Output:)', () => {
      const step: StepDefinition = {
        type: StepType.LoadRelatedRecord,
        prompt: 'Load the address',
      };
      const outcome: StepOutcome = {
        type: 'record-task',
        stepId: 'load-1',
        stepIndex: 1,
        status: 'success',
      };
      const execution: StepExecutionData = {
        type: 'load-related-record',
        stepIndex: 1,
        selectedRecordRef: { collectionName: 'customers', recordId: [42], stepIndex: 0 },
        executionResult: {
          relation: { name: 'address', displayName: 'Address' },
          record: { collectionName: 'addresses', recordId: [1], stepIndex: 1 },
        },
      };

      const result = StepSummaryBuilder.build(step, outcome, execution);

      const lines = result.split('\n');
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('Step "load-1" (index 1):');
      expect(lines[1]).toBe('  Prompt: Load the address');
      expect(lines[2]).toBe('  Loaded: customers #42 → [Address] → addresses #1 (step 1)');
      expect(result).not.toContain('Input:');
      expect(result).not.toContain('Output:');
    });

    it('renders load-related-record skipped as generic Output: fallback', () => {
      const step: StepDefinition = {
        type: StepType.LoadRelatedRecord,
        prompt: 'Load the address',
      };
      const outcome: StepOutcome = {
        type: 'record-task',
        stepId: 'load-1',
        stepIndex: 1,
        status: 'success',
      };
      const execution: StepExecutionData = {
        type: 'load-related-record',
        stepIndex: 1,
        selectedRecordRef: { collectionName: 'customers', recordId: [42], stepIndex: 0 },
        executionResult: { skipped: true },
      };

      const result = StepSummaryBuilder.build(step, outcome, execution);

      expect(result).toContain('Output: {"skipped":true}');
      expect(result).not.toContain('Loaded:');
    });

    it('renders load-related-record pending state with Pending: line', () => {
      const step: StepDefinition = {
        type: StepType.LoadRelatedRecord,
        prompt: 'Load the address',
      };
      const outcome: StepOutcome = {
        type: 'record-task',
        stepId: 'load-1',
        stepIndex: 1,
        status: 'awaiting-input',
      };
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

      const result = StepSummaryBuilder.build(step, outcome, execution);

      expect(result).toContain('Pending:');
      expect(result).toContain('"displayName":"Address"');
      expect(result).not.toContain('Input:');
      expect(result).not.toContain('Output:');
      expect(result).not.toContain('Loaded:');
    });

    it('shows "(no prompt)" when step has no prompt', () => {
      const step: StepDefinition = { type: StepType.Condition, options: ['A', 'B'] };
      const outcome = makeConditionOutcome('cond-1', 0);
      const execution: StepExecutionData = {
        type: 'condition',
        stepIndex: 0,
        executionParams: { answer: 'A', reasoning: 'Only option' },
        executionResult: { answer: 'A' },
      };

      const result = StepSummaryBuilder.build(step, outcome, execution);

      expect(result).toContain('Prompt: (no prompt)');
    });
  });
});
