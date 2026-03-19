import type { RunStore } from '../../src/ports/run-store';
import type { ExecutionContext } from '../../src/types/execution';
import type { RecordRef } from '../../src/types/record';
import type { ConditionStepDefinition } from '../../src/types/step-definition';
import type { ConditionStepOutcome } from '../../src/types/step-outcome';

import ConditionStepExecutor from '../../src/executors/condition-step-executor';
import { StepType } from '../../src/types/step-definition';

function makeStep(overrides: Partial<ConditionStepDefinition> = {}): ConditionStepDefinition {
  return {
    type: StepType.Condition,
    options: ['Approve', 'Reject'],
    prompt: 'Should we approve this?',
    ...overrides,
  };
}

function makeMockRunStore(overrides: Partial<RunStore> = {}): RunStore {
  return {
    getStepExecutions: jest.fn().mockResolvedValue([]),
    saveStepExecution: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeMockModel(toolCallArgs?: Record<string, unknown>) {
  const invoke = jest.fn().mockResolvedValue({
    tool_calls: toolCallArgs
      ? [{ name: 'choose-gateway-option', args: toolCallArgs, id: 'call_1' }]
      : undefined,
  });
  const bindTools = jest.fn().mockReturnValue({ invoke });
  const model = { bindTools } as unknown as ExecutionContext['model'];

  return { model, bindTools, invoke };
}

function makeContext(
  overrides: Partial<ExecutionContext<ConditionStepDefinition>> = {},
): ExecutionContext<ConditionStepDefinition> {
  return {
    runId: 'run-1',
    stepId: 'cond-1',
    stepIndex: 0,
    baseRecordRef: {
      collectionName: 'customers',
      recordId: [1],
      stepIndex: 0,
    } as RecordRef,
    stepDefinition: makeStep(),
    model: makeMockModel().model,
    agentPort: {} as ExecutionContext['agentPort'],
    workflowPort: {} as ExecutionContext['workflowPort'],
    runStore: makeMockRunStore(),
    history: [],
    remoteTools: [],
    ...overrides,
  };
}

describe('ConditionStepExecutor', () => {
  describe('AI decision', () => {
    it('calls AI and returns selected option on success', async () => {
      const mockModel = makeMockModel({
        option: 'Reject',
        reasoning: 'The request is incomplete',
        question: 'Should we approve?',
      });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        runStore,
      });
      const executor = new ConditionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect((result.stepOutcome as ConditionStepOutcome).selectedOption).toBe('Reject');

      expect(mockModel.bindTools).toHaveBeenCalledWith(
        [expect.objectContaining({ name: 'choose-gateway-option' })],
        { tool_choice: 'any' },
      );

      expect(runStore.saveStepExecution).toHaveBeenCalledWith({
        type: 'condition',
        stepIndex: 0,
        executionParams: { answer: 'Reject', reasoning: 'The request is incomplete' },
        executionResult: { answer: 'Reject' },
      });
    });

    it('binds a tool with all step options and nullable for no-match', async () => {
      const mockModel = makeMockModel({
        option: 'Approve',
        reasoning: 'Looks good',
        question: 'Should we?',
      });
      const executor = new ConditionStepExecutor(
        makeContext({
          model: mockModel.model,
          stepDefinition: makeStep({ options: ['Approve', 'Reject', 'Defer'] }),
        }),
      );

      await executor.execute();

      const tool = mockModel.bindTools.mock.calls[0][0][0];
      expect(tool.name).toBe('choose-gateway-option');
      expect(tool.schema.parse({ option: 'Approve', reasoning: 'r', question: 'q' })).toBeTruthy();
      expect(tool.schema.parse({ option: 'Defer', reasoning: 'r', question: 'q' })).toBeTruthy();
      expect(tool.schema.parse({ option: null, reasoning: 'r', question: 'q' })).toBeTruthy();
      expect(() =>
        tool.schema.parse({ option: 'InvalidOption', reasoning: 'r', question: 'q' }),
      ).toThrow();
    });

    it('sends system prompt + user question as separate messages', async () => {
      const mockModel = makeMockModel({
        option: 'Approve',
        reasoning: 'Looks good',
        question: 'Should we approve?',
      });
      const context = makeContext({
        model: mockModel.model,
        stepDefinition: makeStep({ prompt: 'Custom prompt for this step' }),
      });
      const executor = new ConditionStepExecutor(context);

      await executor.execute();

      const messages = mockModel.invoke.mock.calls[0][0];
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toContain('workflow gateway decision');
      expect(messages[0].content).toContain('80% confident');
      expect(messages[1].content).toBe('**Question**: Custom prompt for this step');
    });

    it('uses default question when step.prompt is undefined', async () => {
      const mockModel = makeMockModel({
        option: 'Approve',
        reasoning: 'Default',
        question: 'Approve?',
      });
      const context = makeContext({
        model: mockModel.model,
        stepDefinition: makeStep({ prompt: undefined }),
      });
      const executor = new ConditionStepExecutor(context);

      await executor.execute();

      const messages = mockModel.invoke.mock.calls[0][0];
      const humanMessage = messages[messages.length - 1];
      expect(humanMessage.content).toBe('**Question**: Choose the most appropriate option.');
    });

    it('prepends previous steps summary as separate SystemMessage', async () => {
      const mockModel = makeMockModel({
        option: 'Approve',
        reasoning: 'Based on previous decision',
        question: 'Final approval?',
      });
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([
          {
            type: 'condition',
            stepIndex: 0,
            executionParams: { answer: 'Yes', reasoning: 'Validated by manager' },
          },
        ]),
      });
      const context = makeContext({
        model: mockModel.model,
        runStore,
        history: [
          {
            stepDefinition: {
              type: StepType.Condition,
              options: ['Yes', 'No'],
              prompt: 'Previous question',
            },
            stepOutcome: {
              type: 'condition',
              stepId: 'prev-step',
              stepIndex: 0,
              status: 'success',
            },
          },
        ],
      });
      const executor = new ConditionStepExecutor({
        ...context,
        stepId: 'cond-2',
        stepIndex: 1,
      });

      await executor.execute();

      const messages = mockModel.invoke.mock.calls[0][0];
      expect(messages).toHaveLength(3);
      expect(messages[0].content).toContain('Previous question');
      expect(messages[0].content).toContain('"answer":"Yes"');
      expect(messages[1].content).toContain('workflow gateway decision');
      expect(messages[2].content).toContain('**Question**');
    });
  });

  describe('no-match fallback', () => {
    it('returns manual-decision when AI selects null', async () => {
      const mockModel = makeMockModel({
        option: null,
        reasoning: 'None apply',
        question: 'N/A',
      });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        runStore,
      });
      const executor = new ConditionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('manual-decision');
      expect(result.stepOutcome.error).toBeUndefined();
      expect((result.stepOutcome as ConditionStepOutcome).selectedOption).toBeUndefined();
      expect(runStore.saveStepExecution).toHaveBeenCalledWith({
        type: 'condition',
        stepIndex: 0,
        executionParams: { answer: null, reasoning: 'None apply' },
        executionResult: undefined,
      });
    });

    it('returns error when AI returns an invalid (malformed) tool call', async () => {
      const invoke = jest.fn().mockResolvedValue({
        tool_calls: [],
        invalid_tool_calls: [
          { name: 'choose-gateway-option', args: '{bad json', error: 'JSON parse error' },
        ],
      });
      const bindTools = jest.fn().mockReturnValue({ invoke });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: { bindTools } as unknown as ExecutionContext['model'],
        runStore,
      });
      const executor = new ConditionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'AI returned a malformed tool call for "choose-gateway-option": JSON parse error',
      );
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('error propagation', () => {
    it('returns error status when model invocation fails', async () => {
      const invoke = jest.fn().mockRejectedValue(new Error('API timeout'));
      const bindTools = jest.fn().mockReturnValue({ invoke });
      const context = makeContext({
        model: { bindTools } as unknown as ExecutionContext['model'],
      });
      const executor = new ConditionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe('API timeout');
    });

    it('lets run store errors propagate', async () => {
      const mockModel = makeMockModel({
        option: 'Approve',
        reasoning: 'OK',
        question: 'Approve?',
      });
      const runStore = makeMockRunStore({
        saveStepExecution: jest.fn().mockRejectedValue(new Error('Storage full')),
      });
      const executor = new ConditionStepExecutor(makeContext({ model: mockModel.model, runStore }));

      await expect(executor.execute()).rejects.toThrow('Storage full');
    });
  });
});
