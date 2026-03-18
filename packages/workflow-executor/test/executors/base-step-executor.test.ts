import type { RunStore } from '../../src/ports/run-store';
import type { ExecutionContext, StepExecutionResult } from '../../src/types/execution';
import type { RecordData } from '../../src/types/record';
import type { StepDefinition } from '../../src/types/step-definition';
import type { StepExecutionData } from '../../src/types/step-execution-data';
import type { StepHistory } from '../../src/types/step-history';
import type { BaseMessage, SystemMessage } from '@langchain/core/messages';
import type { DynamicStructuredTool } from '@langchain/core/tools';

import { MalformedToolCallError, MissingToolCallError } from '../../src/errors';
import BaseStepExecutor from '../../src/executors/base-step-executor';
import { StepType } from '../../src/types/step-definition';

/** Concrete subclass that exposes protected methods for testing. */
class TestableExecutor extends BaseStepExecutor {
  async execute(): Promise<StepExecutionResult> {
    throw new Error('not used');
  }

  override buildPreviousStepsMessages(): Promise<SystemMessage[]> {
    return super.buildPreviousStepsMessages();
  }

  override invokeWithTool<T = Record<string, unknown>>(
    messages: BaseMessage[],
    tool: DynamicStructuredTool,
  ): Promise<T> {
    return super.invokeWithTool<T>(messages, tool);
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
    getStepExecutions: jest.fn().mockResolvedValue(stepExecutions),
    saveStepExecution: jest.fn().mockResolvedValue(undefined),
  };
}

function makeContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    runId: 'run-1',
    baseRecord: {
      collectionName: 'customers',
      recordId: [1],
      stepIndex: 0,
      values: {},
    } as RecordData,
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
  describe('buildPreviousStepsMessages', () => {
    it('returns empty array for empty history', async () => {
      const executor = new TestableExecutor(makeContext());

      expect(await executor.buildPreviousStepsMessages()).toEqual([]);
    });

    it('includes prompt and executionParams from previous steps', async () => {
      const executor = new TestableExecutor(
        makeContext({
          history: [makeHistoryEntry({ stepId: 'cond-1', stepIndex: 0, prompt: 'Approve?' })],
          runStore: makeMockRunStore([
            {
              type: 'condition',
              stepIndex: 0,
              executionParams: { answer: 'Yes', reasoning: 'Order is valid' },
              executionResult: { answer: 'Yes' },
            },
          ]),
        }),
      );

      const result = await executor
        .buildPreviousStepsMessages()
        .then(msgs => msgs[0]?.content ?? '');

      expect(result).toContain('Step "cond-1"');
      expect(result).toContain('Prompt: Approve?');
      expect(result).toContain('Result: {"answer":"Yes","reasoning":"Order is valid"}');
    });

    it('uses Result for matched steps and History for unmatched steps', async () => {
      const executor = new TestableExecutor(
        makeContext({
          history: [
            makeHistoryEntry({ stepId: 'cond-1', stepIndex: 0 }),
            makeHistoryEntry({ stepId: 'cond-2', stepIndex: 1, prompt: 'Second?' }),
          ],
          // Only step 1 has an execution entry — step 0 has no match
          runStore: makeMockRunStore([
            {
              type: 'condition',
              stepIndex: 1,
              executionParams: { answer: 'No', reasoning: 'Clearly no' },
              executionResult: { answer: 'No' },
            },
          ]),
        }),
      );

      const result = await executor
        .buildPreviousStepsMessages()
        .then(msgs => msgs[0]?.content ?? '');

      expect(result).toContain('Step "cond-1"');
      expect(result).toContain('History: {"status":"success"}');
      expect(result).toContain('Step "cond-2"');
      expect(result).toContain('Result: {"answer":"No","reasoning":"Clearly no"}');
    });

    it('falls back to History when no matching step execution in RunStore', async () => {
      const executor = new TestableExecutor(
        makeContext({
          history: [
            makeHistoryEntry({ stepId: 'orphan', stepIndex: 5, prompt: 'Orphan step' }),
            makeHistoryEntry({ stepId: 'matched', stepIndex: 1, prompt: 'Matched step' }),
          ],
          runStore: makeMockRunStore([
            {
              type: 'condition',
              stepIndex: 1,
              executionParams: { answer: 'B', reasoning: 'Option B fits' },
              executionResult: { answer: 'B' },
            },
          ]),
        }),
      );

      const result = await executor
        .buildPreviousStepsMessages()
        .then(msgs => msgs[0]?.content ?? '');

      expect(result).toContain('Step "orphan"');
      expect(result).toContain('History: {"status":"success"}');
      expect(result).toContain('Step "matched"');
      expect(result).toContain('Result: {"answer":"B","reasoning":"Option B fits"}');
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

      const result = await executor
        .buildPreviousStepsMessages()
        .then(msgs => msgs[0]?.content ?? '');

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

      const result = await executor
        .buildPreviousStepsMessages()
        .then(msgs => msgs[0]?.content ?? '');

      expect(result).toContain('"status":"error"');
      expect(result).toContain('"error":"AI could not match an option"');
    });

    it('includes status in History for ai-task steps without RunStore data', async () => {
      const entry: { step: StepDefinition; stepHistory: StepHistory } = {
        step: { id: 'ai-step', type: StepType.ReadRecord, prompt: 'Run task' },
        stepHistory: { type: 'ai-task', stepId: 'ai-step', stepIndex: 0, status: 'awaiting-input' },
      };

      const executor = new TestableExecutor(
        makeContext({
          history: [entry],
          runStore: makeMockRunStore([]),
        }),
      );

      const result = await executor
        .buildPreviousStepsMessages()
        .then(msgs => msgs[0]?.content ?? '');

      expect(result).toContain('Step "ai-step"');
      expect(result).toContain('History: {"status":"awaiting-input"}');
    });

    it('uses Result when RunStore has executionParams, History otherwise', async () => {
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
            {
              type: 'ai-task',
              stepIndex: 1,
              executionParams: { answer: 'John Doe' },
            },
          ]),
        }),
      );

      const result = await executor
        .buildPreviousStepsMessages()
        .then(msgs => msgs[0]?.content ?? '');

      expect(result).toContain('Step "cond-1"');
      expect(result).toContain('History: {"status":"success","selectedOption":"Yes"}');
      expect(result).toContain('Step "read-customer"');
      expect(result).toContain('Result: {"answer":"John Doe"}');
    });

    it('prefers RunStore executionParams over History fallback', async () => {
      const entry = makeHistoryEntry({ stepId: 'cond-1', stepIndex: 0, prompt: 'Pick one' });
      (entry.stepHistory as { selectedOption?: string }).selectedOption = 'A';

      const executor = new TestableExecutor(
        makeContext({
          history: [entry],
          runStore: makeMockRunStore([
            {
              type: 'condition',
              stepIndex: 0,
              executionParams: { answer: 'A', reasoning: 'Best fit' },
              executionResult: { answer: 'A' },
            },
          ]),
        }),
      );

      const result = await executor
        .buildPreviousStepsMessages()
        .then(msgs => msgs[0]?.content ?? '');

      expect(result).toContain('Result: {"answer":"A","reasoning":"Best fit"}');
      expect(result).not.toContain('History:');
    });

    it('shows "(no prompt)" when step has no prompt', async () => {
      const entry = makeHistoryEntry({ stepIndex: 0 });
      entry.step.prompt = undefined;

      const executor = new TestableExecutor(
        makeContext({
          history: [entry],
          runStore: makeMockRunStore([
            {
              type: 'condition',
              stepIndex: 0,
              executionParams: { answer: 'A', reasoning: 'Only option' },
              executionResult: { answer: 'A' },
            },
          ]),
        }),
      );

      const result = await executor
        .buildPreviousStepsMessages()
        .then(msgs => msgs[0]?.content ?? '');

      expect(result).toContain('Prompt: (no prompt)');
    });
  });

  describe('invokeWithTool', () => {
    function makeMockModel(response: unknown) {
      const invoke = jest.fn().mockResolvedValue(response);

      return {
        model: {
          bindTools: jest.fn().mockReturnValue({ invoke }),
        } as unknown as ExecutionContext['model'],
        invoke,
      };
    }

    const dummyTool = {} as DynamicStructuredTool;
    const dummyMessages = [] as BaseMessage[];

    it('returns args from the first tool call', async () => {
      const { model } = makeMockModel({
        tool_calls: [{ name: 'tool', args: { key: 'value' }, id: 'c1' }],
      });
      const executor = new TestableExecutor(makeContext({ model }));

      const result = await executor.invokeWithTool(dummyMessages, dummyTool);

      expect(result).toEqual({ key: 'value' });
    });

    it('binds tool with tool_choice "any"', async () => {
      const { model } = makeMockModel({
        tool_calls: [{ name: 'tool', args: {}, id: 'c1' }],
      });
      const executor = new TestableExecutor(makeContext({ model }));

      await executor.invokeWithTool(dummyMessages, dummyTool);

      expect(model.bindTools).toHaveBeenCalledWith([dummyTool], { tool_choice: 'any' });
    });

    it('throws MissingToolCallError when tool_calls is undefined', async () => {
      const { model } = makeMockModel({});
      const executor = new TestableExecutor(makeContext({ model }));

      await expect(executor.invokeWithTool(dummyMessages, dummyTool)).rejects.toThrow(
        MissingToolCallError,
      );
    });

    it('throws MissingToolCallError when tool_calls is empty', async () => {
      const { model } = makeMockModel({ tool_calls: [] });
      const executor = new TestableExecutor(makeContext({ model }));

      await expect(executor.invokeWithTool(dummyMessages, dummyTool)).rejects.toThrow(
        MissingToolCallError,
      );
    });

    it('throws MalformedToolCallError when invalid_tool_calls is present', async () => {
      const { model } = makeMockModel({
        tool_calls: [],
        invalid_tool_calls: [{ name: 'my-tool', args: '{bad', error: 'Parse error' }],
      });
      const executor = new TestableExecutor(makeContext({ model }));

      await expect(executor.invokeWithTool(dummyMessages, dummyTool)).rejects.toThrow(
        MalformedToolCallError,
      );
      await expect(executor.invokeWithTool(dummyMessages, dummyTool)).rejects.toThrow(
        'AI returned a malformed tool call for "my-tool": Parse error',
      );
    });

    it('throws MalformedToolCallError with "unknown" when invalid_tool_call has no name', async () => {
      const { model } = makeMockModel({
        tool_calls: [],
        invalid_tool_calls: [{ error: 'Something broke' }],
      });
      const executor = new TestableExecutor(makeContext({ model }));

      await expect(executor.invokeWithTool(dummyMessages, dummyTool)).rejects.toThrow(
        MalformedToolCallError,
      );
      await expect(executor.invokeWithTool(dummyMessages, dummyTool)).rejects.toThrow(
        'AI returned a malformed tool call for "unknown": Something broke',
      );
    });
  });
});
