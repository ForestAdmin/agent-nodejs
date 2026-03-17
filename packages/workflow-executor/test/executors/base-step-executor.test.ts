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

  override buildAdditionalContext(): Promise<string> {
    return super.buildAdditionalContext();
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
  describe('buildAdditionalContext', () => {
    it('returns empty string for empty history', async () => {
      const executor = new TestableExecutor(makeContext());

      expect(await executor.buildAdditionalContext()).toBe('');
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

      const result = await executor.buildAdditionalContext();

      expect(result).toContain('Step "cond-1"');
      expect(result).toContain('Prompt: Approve?');
      expect(result).toContain('"answer":"Yes"');
    });

    it('skips steps without executionResult', async () => {
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

      const result = await executor.buildAdditionalContext();

      expect(result).not.toContain('cond-1');
      expect(result).toContain('cond-2');
      expect(result).toContain('"answer":"No"');
    });

    it('skips history entries with no matching step execution', async () => {
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

      const result = await executor.buildAdditionalContext();

      expect(result).not.toContain('orphan');
      expect(result).toContain('matched');
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

      const result = await executor.buildAdditionalContext();

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
