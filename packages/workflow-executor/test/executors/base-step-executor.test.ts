import type { RunStore } from '../../src/ports/run-store';
import type { ExecutionContext, StepExecutionResult } from '../../src/types/execution';
import type { StepDefinition } from '../../src/types/step-definition';
import type { StepExecutionData } from '../../src/types/step-execution-data';
import type { StepHistory } from '../../src/types/step-history';
import type { AIMessage } from '@langchain/core/messages';

import { MalformedToolCallError, MissingToolCallError } from '../../src/errors';
import BaseStepExecutor from '../../src/executors/base-step-executor';
import { StepType } from '../../src/types/step-definition';

/** Concrete subclass that exposes protected methods for testing. */
class TestableExecutor extends BaseStepExecutor {
  async execute(): Promise<StepExecutionResult> {
    throw new Error('not used');
  }

  override summarizePreviousSteps(): Promise<string> {
    return super.summarizePreviousSteps();
  }

  override extractToolCallArgs<T = Record<string, unknown>>(response: AIMessage): T {
    return super.extractToolCallArgs<T>(response);
  }
}

function makeHistoryEntry(
  overrides: { stepId?: string; stepIndex?: number; prompt?: string } = {},
): { step: StepDefinition; stepHistory: StepHistory } {
  return {
    step: {
      id: overrides.stepId ?? 'step-1',
      type: StepType.Condition,
      options: ['A', 'B'],
      prompt: overrides.prompt ?? 'Pick one',
    },
    stepHistory: {
      type: 'condition',
      stepId: overrides.stepId ?? 'step-1',
      stepIndex: overrides.stepIndex ?? 0,
      status: 'success',
    },
  };
}

function makeMockRunStore(stepExecutions: StepExecutionData[] = []): RunStore {
  return {
    getRecords: jest.fn().mockResolvedValue([]),
    getRecord: jest.fn().mockResolvedValue(null),
    saveRecord: jest.fn().mockResolvedValue(undefined),
    getStepExecutions: jest.fn().mockResolvedValue(stepExecutions),
    getStepExecution: jest.fn().mockResolvedValue(null),
    saveStepExecution: jest.fn().mockResolvedValue(undefined),
  };
}

function makeContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    runId: 'run-1',
    model: {} as ExecutionContext['model'],
    agentPort: {} as ExecutionContext['agentPort'],
    workflowPort: {} as ExecutionContext['workflowPort'],
    runStore: makeMockRunStore(),
    history: [],
    remoteTools: [],
    ...overrides,
  };
}

describe('BaseStepExecutor', () => {
  describe('summarizePreviousSteps', () => {
    it('returns empty string for empty history', async () => {
      const executor = new TestableExecutor(makeContext());

      expect(await executor.summarizePreviousSteps()).toBe('');
    });

    it('includes prompt and result from previous steps', async () => {
      const executor = new TestableExecutor(
        makeContext({
          history: [makeHistoryEntry({ stepId: 'cond-1', stepIndex: 0, prompt: 'Approve?' })],
          runStore: makeMockRunStore([
            { type: 'condition', stepIndex: 0, executionResult: { answer: 'Yes' } },
          ]),
        }),
      );

      const result = await executor.summarizePreviousSteps();

      expect(result).toContain('Step "cond-1"');
      expect(result).toContain('Prompt: Approve?');
      expect(result).toContain('"answer":"Yes"');
    });

    it('falls back to History when step has no executionResult in RunStore', async () => {
      const executor = new TestableExecutor(
        makeContext({
          history: [
            makeHistoryEntry({ stepId: 'cond-1', stepIndex: 0 }),
            makeHistoryEntry({ stepId: 'cond-2', stepIndex: 1, prompt: 'Second?' }),
          ],
          runStore: makeMockRunStore([
            { type: 'condition', stepIndex: 0 },
            { type: 'condition', stepIndex: 1, executionResult: { answer: 'No' } },
          ]),
        }),
      );

      const result = await executor.summarizePreviousSteps();

      expect(result).toContain('Step "cond-1"');
      expect(result).toContain('History: {"status":"success"}');
      expect(result).toContain('Step "cond-2"');
      expect(result).toContain('Result: {"answer":"No"}');
    });

    it('falls back to History when no matching step execution in RunStore', async () => {
      const executor = new TestableExecutor(
        makeContext({
          history: [
            makeHistoryEntry({ stepId: 'orphan', stepIndex: 5, prompt: 'Orphan step' }),
            makeHistoryEntry({ stepId: 'matched', stepIndex: 1, prompt: 'Matched step' }),
          ],
          runStore: makeMockRunStore([
            { type: 'condition', stepIndex: 1, executionResult: { answer: 'B' } },
          ]),
        }),
      );

      const result = await executor.summarizePreviousSteps();

      expect(result).toContain('Step "orphan"');
      expect(result).toContain('History: {"status":"success"}');
      expect(result).toContain('Step "matched"');
      expect(result).toContain('Result: {"answer":"B"}');
    });

    it('includes selectedOption in History for condition steps', async () => {
      const entry = makeHistoryEntry({
        stepId: 'cond-approval',
        stepIndex: 0,
        prompt: 'Approved?',
      });
      (entry.stepHistory as { selectedOption?: string }).selectedOption = 'Yes';

      const executor = new TestableExecutor(
        makeContext({
          history: [entry],
          runStore: makeMockRunStore([]),
        }),
      );

      const result = await executor.summarizePreviousSteps();

      expect(result).toContain('Step "cond-approval"');
      expect(result).toContain('"selectedOption":"Yes"');
    });

    it('includes error in History for failed steps', async () => {
      const entry = makeHistoryEntry({
        stepId: 'failing-step',
        stepIndex: 0,
        prompt: 'Do something',
      });
      entry.stepHistory.status = 'error';
      (entry.stepHistory as { error?: string }).error = 'AI could not match an option';

      const executor = new TestableExecutor(
        makeContext({
          history: [entry],
          runStore: makeMockRunStore([]),
        }),
      );

      const result = await executor.summarizePreviousSteps();

      expect(result).toContain('"status":"error"');
      expect(result).toContain('"error":"AI could not match an option"');
    });

    it('includes status in History for ai-task steps without RunStore data', async () => {
      const entry: { step: StepDefinition; stepHistory: StepHistory } = {
        step: { id: 'ai-step', type: StepType.Condition, options: ['A'], prompt: 'Run task' },
        stepHistory: { type: 'ai-task', stepId: 'ai-step', stepIndex: 0, status: 'awaiting-input' },
      };

      const executor = new TestableExecutor(
        makeContext({
          history: [entry],
          runStore: makeMockRunStore([]),
        }),
      );

      const result = await executor.summarizePreviousSteps();

      expect(result).toContain('Step "ai-step"');
      expect(result).toContain('History: {"status":"awaiting-input"}');
    });

    it('uses Result when RunStore has executionResult, History otherwise', async () => {
      const condEntry = makeHistoryEntry({
        stepId: 'cond-1',
        stepIndex: 0,
        prompt: 'Approved?',
      });
      (condEntry.stepHistory as { selectedOption?: string }).selectedOption = 'Yes';

      const aiEntry: { step: StepDefinition; stepHistory: StepHistory } = {
        step: { id: 'read-customer', type: StepType.ReadRecord, prompt: 'Read name' },
        stepHistory: { type: 'ai-task', stepId: 'read-customer', stepIndex: 1, status: 'success' },
      };

      const executor = new TestableExecutor(
        makeContext({
          history: [condEntry, aiEntry],
          runStore: makeMockRunStore([
            { type: 'ai-task', stepIndex: 1, executionResult: { answer: 'John Doe' } },
          ]),
        }),
      );

      const result = await executor.summarizePreviousSteps();

      expect(result).toContain('Step "cond-1"');
      expect(result).toContain('History: {"status":"success","selectedOption":"Yes"}');
      expect(result).toContain('Step "read-customer"');
      expect(result).toContain('Result: {"answer":"John Doe"}');
    });

    it('prefers RunStore executionResult over History fallback', async () => {
      const entry = makeHistoryEntry({ stepId: 'cond-1', stepIndex: 0, prompt: 'Pick one' });
      (entry.stepHistory as { selectedOption?: string }).selectedOption = 'A';

      const executor = new TestableExecutor(
        makeContext({
          history: [entry],
          runStore: makeMockRunStore([
            { type: 'condition', stepIndex: 0, executionResult: { answer: 'A' } },
          ]),
        }),
      );

      const result = await executor.summarizePreviousSteps();

      expect(result).toContain('Result: {"answer":"A"}');
      expect(result).not.toContain('History:');
    });

    it('shows "(no prompt)" when step has no prompt', async () => {
      const entry = makeHistoryEntry({ stepIndex: 0 });
      entry.step.prompt = undefined;

      const executor = new TestableExecutor(
        makeContext({
          history: [entry],
          runStore: makeMockRunStore([
            { type: 'condition', stepIndex: 0, executionResult: { answer: 'A' } },
          ]),
        }),
      );

      const result = await executor.summarizePreviousSteps();

      expect(result).toContain('Prompt: (no prompt)');
    });
  });

  describe('extractToolCallArgs', () => {
    it('returns args from the first tool call', () => {
      const executor = new TestableExecutor(makeContext());
      const response = {
        tool_calls: [{ name: 'tool', args: { key: 'value' }, id: 'c1' }],
      } as unknown as AIMessage;

      expect(executor.extractToolCallArgs(response)).toEqual({ key: 'value' });
    });

    it('throws MissingToolCallError when tool_calls is undefined', () => {
      const executor = new TestableExecutor(makeContext());
      const response = {} as unknown as AIMessage;

      expect(() => executor.extractToolCallArgs(response)).toThrow(MissingToolCallError);
      expect(() => executor.extractToolCallArgs(response)).toThrow('AI did not return a tool call');
    });

    it('throws MissingToolCallError when tool_calls is empty', () => {
      const executor = new TestableExecutor(makeContext());
      const response = { tool_calls: [] } as unknown as AIMessage;

      expect(() => executor.extractToolCallArgs(response)).toThrow(MissingToolCallError);
      expect(() => executor.extractToolCallArgs(response)).toThrow('AI did not return a tool call');
    });

    it('throws MalformedToolCallError when invalid_tool_calls is present', () => {
      const executor = new TestableExecutor(makeContext());
      const response = {
        tool_calls: [],
        invalid_tool_calls: [{ name: 'my-tool', args: '{bad', error: 'Parse error' }],
      } as unknown as AIMessage;

      expect(() => executor.extractToolCallArgs(response)).toThrow(MalformedToolCallError);
      expect(() => executor.extractToolCallArgs(response)).toThrow(
        'AI returned a malformed tool call for "my-tool": Parse error',
      );
    });

    it('throws MalformedToolCallError with "unknown" when invalid_tool_call has no name', () => {
      const executor = new TestableExecutor(makeContext());
      const response = {
        tool_calls: [],
        invalid_tool_calls: [{ error: 'Something broke' }],
      } as unknown as AIMessage;

      expect(() => executor.extractToolCallArgs(response)).toThrow(MalformedToolCallError);
      expect(() => executor.extractToolCallArgs(response)).toThrow(
        'AI returned a malformed tool call for "unknown": Something broke',
      );
    });
  });
});
