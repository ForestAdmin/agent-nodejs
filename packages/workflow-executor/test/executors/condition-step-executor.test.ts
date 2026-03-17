import type { RunStore } from '../../src/ports/run-store';
import type { ExecutionContext } from '../../src/types/execution';
import type { ConditionStepDefinition } from '../../src/types/step-definition';
import type { ConditionStepHistory } from '../../src/types/step-history';

import ConditionStepExecutor, {
  NO_GATEWAY_OPTION_MATCH,
} from '../../src/executors/condition-step-executor';
import { StepType } from '../../src/types/step-definition';

function makeStep(overrides: Partial<ConditionStepDefinition> = {}): ConditionStepDefinition {
  return {
    id: 'cond-1',
    type: StepType.Condition,
    options: ['Approve', 'Reject'],
    prompt: 'Should we approve this?',
    ...overrides,
  };
}

function makeStepHistory(overrides: Partial<ConditionStepHistory> = {}): ConditionStepHistory {
  return {
    type: 'condition',
    stepId: 'cond-1',
    stepIndex: 0,
    status: 'success',
    ...overrides,
  };
}

function makeMockRunStore(overrides: Partial<RunStore> = {}): RunStore {
  return {
    getRecords: jest.fn().mockResolvedValue([]),
    getRecord: jest.fn().mockResolvedValue(null),
    saveRecord: jest.fn().mockResolvedValue(undefined),
    getStepExecutions: jest.fn().mockResolvedValue([]),
    getStepExecution: jest.fn().mockResolvedValue(null),
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

function makeContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    runId: 'run-1',
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
  describe('empty options', () => {
    it('returns error when step has no options', async () => {
      const executor = new ConditionStepExecutor(makeContext());

      const result = await executor.execute(makeStep({ options: [] }), makeStepHistory());

      expect(result.stepHistory.status).toBe('error');
      expect(result.stepHistory.error).toBe(
        'Condition step "cond-1" has no options to choose from',
      );
    });
  });

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
      const stepHistory = makeStepHistory();
      const executor = new ConditionStepExecutor(context);

      const result = await executor.execute(makeStep(), stepHistory);

      expect(result.stepHistory.status).toBe('success');
      expect((result.stepHistory as ConditionStepHistory).selectedOption).toBe('Reject');

      // Verify bindTools received tool with correct enum + tool_choice
      expect(mockModel.bindTools).toHaveBeenCalledWith(
        [expect.objectContaining({ name: 'choose-gateway-option' })],
        { tool_choice: 'any' },
      );

      // Verify persisted to RunStore
      expect(runStore.saveStepExecution).toHaveBeenCalledWith({
        type: 'condition',
        stepIndex: 0,
        executionParams: { answer: 'Reject', reasoning: 'The request is incomplete' },
        executionResult: { answer: 'Reject' },
      });
    });

    it('sends system prompt + user question as separate messages', async () => {
      const mockModel = makeMockModel({
        option: 'Approve',
        reasoning: 'Looks good',
        question: 'Should we approve?',
      });
      const context = makeContext({ model: mockModel.model });
      const executor = new ConditionStepExecutor(context);

      await executor.execute(
        makeStep({ prompt: 'Custom prompt for this step' }),
        makeStepHistory(),
      );

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
      const context = makeContext({ model: mockModel.model });
      const executor = new ConditionStepExecutor(context);

      await executor.execute(makeStep({ prompt: undefined }), makeStepHistory());

      const messages = mockModel.invoke.mock.calls[0][0];
      const humanMessage = messages[messages.length - 1];
      expect(humanMessage.content).toBe('**Question**: Choose the most appropriate option.');
    });

    it('prepends additionalContext as separate SystemMessage', async () => {
      const mockModel = makeMockModel({
        option: 'Approve',
        reasoning: 'Based on previous decision',
        question: 'Final approval?',
      });
      const runStore = makeMockRunStore({
        getStepExecution: jest.fn().mockResolvedValue(null),
        getStepExecutions: jest
          .fn()
          .mockResolvedValue([
            { type: 'condition', stepIndex: 0, executionResult: { answer: 'Yes' } },
          ]),
      });
      const context = makeContext({
        model: mockModel.model,
        runStore,
        history: [
          {
            step: {
              id: 'prev-step',
              type: StepType.Condition,
              options: ['Yes', 'No'],
              prompt: 'Previous question',
            },
            stepHistory: {
              type: 'condition',
              stepId: 'prev-step',
              stepIndex: 0,
              status: 'success',
            },
          },
        ],
      });
      const executor = new ConditionStepExecutor(context);

      await executor.execute(
        makeStep({ id: 'cond-2' }),
        makeStepHistory({ stepId: 'cond-2', stepIndex: 1 }),
      );

      const messages = mockModel.invoke.mock.calls[0][0];
      expect(messages).toHaveLength(3);
      expect(messages[0].content).toContain('Previous question');
      expect(messages[0].content).toContain('"answer":"Yes"');
      expect(messages[1].content).toContain('workflow gateway decision');
      expect(messages[2].content).toContain('**Question**');
    });
  });

  describe('fallback NO_GATEWAY_OPTION_MATCH', () => {
    it('returns manual-decision when AI selects NO_MATCH', async () => {
      const mockModel = makeMockModel({
        option: NO_GATEWAY_OPTION_MATCH,
        reasoning: 'None apply',
        question: 'N/A',
      });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        runStore,
      });
      const executor = new ConditionStepExecutor(context);

      const result = await executor.execute(makeStep(), makeStepHistory());

      expect(result.stepHistory.status).toBe('manual-decision');
      expect(result.stepHistory.error).toBeUndefined();
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          executionParams: { answer: NO_GATEWAY_OPTION_MATCH, reasoning: 'None apply' },
        }),
      );
    });

    it('returns error when AI returns no tool call', async () => {
      const mockModel = makeMockModel(); // no tool call args → tool_calls undefined
      const context = makeContext({
        model: mockModel.model,
      });
      const executor = new ConditionStepExecutor(context);

      const result = await executor.execute(makeStep(), makeStepHistory());

      expect(result.stepHistory.status).toBe('error');
      expect(result.stepHistory.error).toBe('AI did not return a tool call');
    });

    it('returns error when AI returns empty tool_calls array', async () => {
      const invoke = jest.fn().mockResolvedValue({ tool_calls: [] });
      const bindTools = jest.fn().mockReturnValue({ invoke });
      const context = makeContext({
        model: { bindTools } as unknown as ExecutionContext['model'],
      });
      const executor = new ConditionStepExecutor(context);

      const result = await executor.execute(makeStep(), makeStepHistory());

      expect(result.stepHistory.status).toBe('error');
      expect(result.stepHistory.error).toBe('AI did not return a tool call');
    });
  });

  describe('invalid option', () => {
    it('returns error with diagnostic details when option not in step.options', async () => {
      const mockModel = makeMockModel({
        option: 'Unknown',
        reasoning: 'Guessing',
        question: 'Something',
      });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        runStore,
      });
      const executor = new ConditionStepExecutor(context);

      const result = await executor.execute(makeStep(), makeStepHistory());

      expect(result.stepHistory.status).toBe('error');
      expect(result.stepHistory.error).toContain('Unknown');
      expect(result.stepHistory.error).toContain('Approve');
      expect(result.stepHistory.error).toContain('Reject');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          executionParams: { answer: 'Unknown', reasoning: 'Guessing' },
          executionResult: undefined,
        }),
      );
    });
  });

  describe('error propagation', () => {
    it('lets model errors propagate', async () => {
      const invoke = jest.fn().mockRejectedValue(new Error('API timeout'));
      const bindTools = jest.fn().mockReturnValue({ invoke });
      const context = makeContext({
        model: { bindTools } as unknown as ExecutionContext['model'],
      });
      const executor = new ConditionStepExecutor(context);

      await expect(executor.execute(makeStep(), makeStepHistory())).rejects.toThrow('API timeout');
    });
  });
});
