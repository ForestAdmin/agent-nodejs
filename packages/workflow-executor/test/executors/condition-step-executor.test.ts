import type { RunStore } from '../../src/ports/run-store';
import type { ExecutionContext } from '../../src/types/execution';
import type { ConditionStepDefinition } from '../../src/types/step-definition';
import type { ConditionStepHistory } from '../../src/types/step-history';

import executeConditionStep, {
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

describe('executeConditionStep', () => {
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

      const result = await executeConditionStep(makeStep(), stepHistory, context);

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

    it('includes step.prompt in system message', async () => {
      const mockModel = makeMockModel({
        option: 'Approve',
        reasoning: 'Looks good',
        question: 'Should we approve?',
      });
      const context = makeContext({
        model: mockModel.model,
      });

      await executeConditionStep(
        makeStep({ prompt: 'Custom prompt for this step' }),
        makeStepHistory(),
        context,
      );

      const invokeCall = mockModel.invoke.mock.calls[0][0];
      expect(invokeCall[0].content).toContain('Custom prompt for this step');
    });

    it('includes additionalContext from previous steps', async () => {
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

      await executeConditionStep(
        makeStep({ id: 'cond-2' }),
        makeStepHistory({ stepId: 'cond-2', stepIndex: 1 }),
        context,
      );

      const invokeCall = mockModel.invoke.mock.calls[0][0];
      expect(invokeCall[0].content).toContain('Previous question');
      expect(invokeCall[0].content).toContain('"answer":"Yes"');
    });
  });

  describe('fallback NO_GATEWAY_OPTION_MATCH', () => {
    it('returns error when AI selects NO_MATCH', async () => {
      const mockModel = makeMockModel({
        option: NO_GATEWAY_OPTION_MATCH,
        reasoning: 'None apply',
        question: 'N/A',
      });
      const context = makeContext({
        model: mockModel.model,
      });

      const result = await executeConditionStep(makeStep(), makeStepHistory(), context);

      expect(result.stepHistory.status).toBe('error');
      expect(result.stepHistory.error).toBe('AI could not match an option');
    });

    it('returns error when AI returns no tool call', async () => {
      const mockModel = makeMockModel(); // no tool call args → tool_calls undefined
      const context = makeContext({
        model: mockModel.model,
      });

      const result = await executeConditionStep(makeStep(), makeStepHistory(), context);

      expect(result.stepHistory.status).toBe('error');
      expect(result.stepHistory.error).toBe('AI could not match an option');
    });
  });

  describe('invalid option', () => {
    it('returns error when option not in step.options', async () => {
      const mockModel = makeMockModel({
        option: 'Unknown',
        reasoning: 'Guessing',
        question: 'Something',
      });
      const context = makeContext({
        model: mockModel.model,
      });

      const result = await executeConditionStep(makeStep(), makeStepHistory(), context);

      expect(result.stepHistory.status).toBe('error');
      expect(result.stepHistory.error).toBe('No matching option');
    });
  });

  describe('error propagation', () => {
    it('lets model errors propagate', async () => {
      const invoke = jest.fn().mockRejectedValue(new Error('API timeout'));
      const bindTools = jest.fn().mockReturnValue({ invoke });
      const context = makeContext({
        model: { bindTools } as unknown as ExecutionContext['model'],
      });

      await expect(executeConditionStep(makeStep(), makeStepHistory(), context)).rejects.toThrow(
        'API timeout',
      );
    });
  });
});
