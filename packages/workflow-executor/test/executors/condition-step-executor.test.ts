import type { ActivityLogPort } from '../../src/ports/activity-log-port';
import type { AgentPort } from '../../src/ports/agent-port';
import type { RunStore } from '../../src/ports/run-store';
import type { WorkflowPort } from '../../src/ports/workflow-port';
import type { ExecutionContext, Step } from '../../src/types/execution-context';
import type { FieldReadResult, StepExecutionData } from '../../src/types/step-execution-data';
import type { RecordRef } from '../../src/types/validated/collection';
import type { ConditionStepDefinition } from '../../src/types/validated/step-definition';
import type { ConditionStepOutcome } from '../../src/types/validated/step-outcome';

import { RunStorePortError } from '../../src/errors';
import ActivityLog from '../../src/executors/activity-log';
import AgentWithLog from '../../src/executors/agent-with-log';
import ConditionStepExecutor from '../../src/executors/condition-step-executor';
import SchemaCache from '../../src/schema-cache';
import SchemaResolver from '../../src/schema-resolver';
import { StepExecutionMode, StepType } from '../../src/types/validated/step-definition';

function makeStep(overrides: Partial<ConditionStepDefinition> = {}): ConditionStepDefinition {
  return {
    type: StepType.Condition,
    executionType: StepExecutionMode.FullyAutomated,
    options: ['Approve', 'Reject'],
    prompt: 'Should we approve this?',
    ...overrides,
  };
}

type ConditionPreRecordedArgs = NonNullable<ConditionStepDefinition['preRecordedArgs']>;

// Published with aiDecision stripped, so a deterministic gateway arrives as manual: the args make it deterministic, not the mode.
function makeDeterministicStep(
  preRecordedArgs: ConditionPreRecordedArgs,
  executionType: ConditionStepDefinition['executionType'] = StepExecutionMode.Manual,
): ConditionStepDefinition {
  return makeStep({
    executionType,
    options: [
      ...preRecordedArgs.optionConditions.map(o => o.option),
      preRecordedArgs.fallbackOption,
    ],
    preRecordedArgs,
  });
}

function makeGetDataStep(stepId: string, stepIndex: number): Step {
  return {
    stepDefinition: {
      type: StepType.ReadRecord,
      executionType: StepExecutionMode.FullyAutomated,
    },
    stepOutcome: { type: 'record', stepId, stepIndex, status: 'success' },
  };
}

function makeReadRecordExecution(stepIndex: number, fields: FieldReadResult[]): StepExecutionData {
  return {
    type: 'read-record',
    stepIndex,
    executionParams: { fields: fields.map(({ name, displayName }) => ({ name, displayName })) },
    executionResult: { fields },
    selectedRecordRef: { collectionName: 'orders', recordId: [1], stepIndex: 0 },
  };
}

function makeMockRunStore(overrides: Partial<RunStore> = {}): RunStore {
  return {
    init: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    getStepExecutions: jest.fn().mockResolvedValue([]),
    saveStepExecution: jest.fn().mockResolvedValue(undefined),
    deleteStepExecution: jest.fn().mockResolvedValue(undefined),
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
  overrides: Partial<ExecutionContext<ConditionStepDefinition>> & {
    agentPort?: AgentPort;
    activityLogPort?: ActivityLogPort;
    activityLog?: ActivityLog;
    workflowPort?: WorkflowPort;
  } = {},
): ExecutionContext<ConditionStepDefinition> {
  const runId = overrides.runId ?? 'run-1';
  const workflowPort = overrides.workflowPort ?? ({} as WorkflowPort);
  const schemaCache = new SchemaCache();

  const base: Omit<ExecutionContext<ConditionStepDefinition>, 'agent' | 'activityLog'> = {
    runId,
    stepId: 'cond-1',
    stepIndex: 0,
    collectionId: 'col-1',
    baseRecordRef: {
      collectionName: 'customers',
      recordId: [1],
      stepIndex: 0,
    } as RecordRef,
    stepDefinition: makeStep(),
    model: makeMockModel().model,
    runStore: makeMockRunStore(),
    user: {
      id: 1,
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      team: 'admin',
      renderingId: 1,
      role: 'admin',
      permissionLevel: 'admin',
      tags: {},
    },
    timezone: 'UTC',
    schemaResolver: new SchemaResolver(schemaCache, workflowPort, runId, 1),
    previousSteps: [],
    logger: jest.fn(),
    ...overrides,
  };

  const activityLog =
    overrides.activityLog ??
    new ActivityLog(
      overrides.activityLogPort ?? {
        createPending: jest.fn().mockResolvedValue({ id: 'log-1', index: '0' }),
        markSucceeded: jest.fn().mockResolvedValue(undefined),
        markFailed: jest.fn().mockResolvedValue(undefined),
      },
      base.user,
    );

  return {
    ...base,
    activityLog,
    agent:
      overrides.agent ??
      new AgentWithLog({
        agentPort: overrides.agentPort ?? ({} as AgentPort),
        schemaResolver: base.schemaResolver,
        user: base.user,
        activityLog,
      }),
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

      expect(runStore.saveStepExecution).toHaveBeenCalledWith('run-1', {
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
      expect(messages[0].content).toContain('Step executed by');
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
        previousSteps: [
          {
            stepDefinition: {
              type: StepType.Condition,
              executionType: StepExecutionMode.FullyAutomated,
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
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toContain('Step executed by');
      expect(messages[0].content).toContain('Previous question');
      expect(messages[0].content).toContain('"answer":"Yes"');
      expect(messages[0].content).toContain('workflow gateway decision');
      expect(messages[1].content).toContain('**Question**');
    });
  });

  describe('no-match fallback', () => {
    it('returns error when AI selects null', async () => {
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

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        "The AI couldn't decide. Try rephrasing the step's prompt.",
      );
      expect((result.stepOutcome as ConditionStepOutcome).selectedOption).toBeUndefined();
      expect(runStore.saveStepExecution).toHaveBeenCalledWith('run-1', {
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

      expect(result.stepOutcome.type).toBe('condition');
      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        "The AI returned an unexpected response. Try rephrasing the step's prompt.",
      );
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('error propagation', () => {
    it('returns error outcome for infrastructure errors', async () => {
      const invoke = jest.fn().mockRejectedValue(new Error('API timeout'));
      const bindTools = jest.fn().mockReturnValue({ invoke });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: { bindTools } as unknown as ExecutionContext['model'],
        runStore,
      });
      const executor = new ConditionStepExecutor(context);

      const result = await executor.execute();
      expect(result.stepOutcome.status).toBe('error');
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });

    it('returns error outcome when run store save fails with context', async () => {
      const mockModel = makeMockModel({
        option: 'Approve',
        reasoning: 'OK',
        question: 'Approve?',
      });
      const runStore = makeMockRunStore({
        saveStepExecution: jest
          .fn()
          .mockRejectedValue(new RunStorePortError('saveStepExecution', new Error('Storage full'))),
      });
      const executor = new ConditionStepExecutor(makeContext({ model: mockModel.model, runStore }));

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe('The step state could not be accessed. Please retry.');
    });
  });

  describe('user override via incomingPendingData', () => {
    it('bypasses AI and persists the user-selected option', async () => {
      const mockModel = makeMockModel();
      const runStore = makeMockRunStore();
      const executor = new ConditionStepExecutor(
        makeContext({
          model: mockModel.model,
          runStore,
          incomingPendingData: { selectedOption: 'Approve' },
        }),
      );

      const result = await executor.execute();

      expect(mockModel.bindTools).not.toHaveBeenCalled();
      expect(mockModel.invoke).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).toHaveBeenCalledWith('run-1', {
        type: 'condition',
        stepIndex: 0,
        executionParams: { answer: 'Approve', reasoning: 'Selected by user' },
        executionResult: { answer: 'Approve' },
      });
      expect(result.stepOutcome.status).toBe('success');
      expect((result.stepOutcome as ConditionStepOutcome).selectedOption).toBe('Approve');
    });

    it('returns error outcome when the selected option is not in step.options', async () => {
      const mockModel = makeMockModel();
      const runStore = makeMockRunStore();
      const executor = new ConditionStepExecutor(
        makeContext({
          model: mockModel.model,
          runStore,
          incomingPendingData: { selectedOption: 'Maybe' },
        }),
      );

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(mockModel.bindTools).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });

    it('returns error outcome when incomingPendingData has unexpected fields', async () => {
      const mockModel = makeMockModel();
      const runStore = makeMockRunStore();
      const executor = new ConditionStepExecutor(
        makeContext({
          model: mockModel.model,
          runStore,
          incomingPendingData: { selectedOption: 'Approve', extraField: 'x' },
        }),
      );

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(mockModel.bindTools).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('deterministic evaluation driven by preRecordedArgs', () => {
    const amountArgs: ConditionPreRecordedArgs = {
      optionConditions: [
        {
          option: 'High',
          aggregator: 'and',
          conditions: [
            { sourceStepId: 'get-1', fieldName: 'amount', operator: 'greater_than', value: 100 },
          ],
        },
        {
          option: 'Low',
          aggregator: 'and',
          conditions: [
            {
              sourceStepId: 'get-1',
              fieldName: 'amount',
              operator: 'less_than',
              value: 101,
            },
          ],
        },
      ],
      fallbackOption: 'Other',
    };

    function makeDeterministicContext(
      preRecordedArgs: ConditionPreRecordedArgs,
      fields: FieldReadResult[],
      overrides: Partial<ExecutionContext<ConditionStepDefinition>> = {},
    ) {
      const mockModel = makeMockModel();
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([makeReadRecordExecution(1, fields)]),
      });
      const context = makeContext({
        model: mockModel.model,
        runStore,
        stepDefinition: makeDeterministicStep(preRecordedArgs),
        previousSteps: [makeGetDataStep('get-1', 1)],
        ...overrides,
      });

      // The override wins in the context, so returning the local store would hand back one the
      // executor never received — every assertion on it would pass vacuously.
      return { context, mockModel, runStore: (overrides.runStore ?? runStore) as typeof runStore };
    }

    it('evaluates a manual condition instead of awaiting input, with no incomingPendingData', async () => {
      const { context, mockModel, runStore } = makeDeterministicContext(amountArgs, [
        { name: 'amount', displayName: 'Amount', value: 150 },
      ]);

      expect(context.stepDefinition.executionType).toBe(StepExecutionMode.Manual);
      expect(context.incomingPendingData).toBeUndefined();

      const result = await new ConditionStepExecutor(context).execute();

      expect(result.stepOutcome.status).toBe('success');
      expect((result.stepOutcome as ConditionStepOutcome).selectedOption).toBe('High');
      expect(mockModel.bindTools).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionParams: expect.objectContaining({ selectedOption: 'High', usedFallback: false }),
        }),
      );
    });

    it('evaluates a fully-automated condition carrying preRecordedArgs without calling the AI', async () => {
      const { context, mockModel, runStore } = makeDeterministicContext(
        amountArgs,
        [{ name: 'amount', displayName: 'Amount', value: 150 }],
        { stepDefinition: makeDeterministicStep(amountArgs, StepExecutionMode.FullyAutomated) },
      );

      const result = await new ConditionStepExecutor(context).execute();

      expect(result.stepOutcome.status).toBe('success');
      expect((result.stepOutcome as ConditionStepOutcome).selectedOption).toBe('High');
      expect(mockModel.bindTools).not.toHaveBeenCalled();
      expect(mockModel.invoke).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionParams: expect.objectContaining({
            evaluations: [
              { option: 'High', outcome: 'matched', conditions: [{ index: 0, met: true }] },
              { option: 'Low', outcome: 'not-evaluated' },
            ],
          }),
        }),
      );
    });

    it('selects the first matching option without calling the AI or awaiting input', async () => {
      const { context, mockModel, runStore } = makeDeterministicContext(amountArgs, [
        { name: 'amount', displayName: 'Amount', value: 150 },
      ]);
      const executor = new ConditionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect((result.stepOutcome as ConditionStepOutcome).selectedOption).toBe('High');
      expect(mockModel.bindTools).not.toHaveBeenCalled();
      expect(mockModel.invoke).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).toHaveBeenCalledWith('run-1', {
        type: 'condition',
        stepIndex: 0,
        executionParams: {
          evaluations: [
            { option: 'High', outcome: 'matched', conditions: [{ index: 0, met: true }] },
            { option: 'Low', outcome: 'not-evaluated' },
          ],
          selectedOption: 'High',
          usedFallback: false,
          evaluatedAt: expect.any(String),
          timezone: 'UTC',
        },
        executionResult: { answer: 'High' },
      });
    });

    it('does not evaluate options after the first match, even if they would also match', async () => {
      const bothMatch: ConditionPreRecordedArgs = {
        optionConditions: [
          {
            option: 'First',
            aggregator: 'and',
            conditions: [{ sourceStepId: 'get-1', fieldName: 'amount', operator: 'present' }],
          },
          {
            option: 'Second',
            aggregator: 'and',
            conditions: [{ sourceStepId: 'get-1', fieldName: 'amount', operator: 'present' }],
          },
        ],
        fallbackOption: 'Other',
      };
      const { context, runStore } = makeDeterministicContext(bothMatch, [
        { name: 'amount', displayName: 'Amount', value: 150 },
      ]);

      const result = await new ConditionStepExecutor(context).execute();

      expect((result.stepOutcome as ConditionStepOutcome).selectedOption).toBe('First');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionParams: expect.objectContaining({
            evaluations: [
              { option: 'First', outcome: 'matched', conditions: [{ index: 0, met: true }] },
              { option: 'Second', outcome: 'not-evaluated' },
            ],
          }),
        }),
      );
    });

    it('requires all conditions with the and aggregator', async () => {
      const andArgs: ConditionPreRecordedArgs = {
        optionConditions: [
          {
            option: 'High paid',
            aggregator: 'and',
            conditions: [
              { sourceStepId: 'get-1', fieldName: 'amount', operator: 'greater_than', value: 100 },
              { sourceStepId: 'get-1', fieldName: 'status', operator: 'equal', value: 'paid' },
            ],
          },
        ],
        fallbackOption: 'Other',
      };
      const { context, runStore } = makeDeterministicContext(andArgs, [
        { name: 'amount', displayName: 'Amount', value: 150 },
        { name: 'status', displayName: 'Status', value: 'pending' },
      ]);

      const result = await new ConditionStepExecutor(context).execute();

      expect((result.stepOutcome as ConditionStepOutcome).selectedOption).toBe('Other');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith('run-1', {
        type: 'condition',
        stepIndex: 0,
        executionParams: {
          evaluations: [
            {
              option: 'High paid',
              outcome: 'not-matched',
              conditions: [
                { index: 0, met: true },
                { index: 1, met: false },
              ],
            },
          ],
          selectedOption: 'Other',
          usedFallback: true,
          evaluatedAt: expect.any(String),
          timezone: 'UTC',
        },
        executionResult: { answer: 'Other' },
      });
    });

    it('matches with the or aggregator when any condition is met', async () => {
      const orArgs: ConditionPreRecordedArgs = {
        optionConditions: [
          {
            option: 'High or paid',
            aggregator: 'or',
            conditions: [
              { sourceStepId: 'get-1', fieldName: 'status', operator: 'equal', value: 'paid' },
              { sourceStepId: 'get-1', fieldName: 'amount', operator: 'greater_than', value: 100 },
            ],
          },
        ],
        fallbackOption: 'Other',
      };
      const { context, runStore } = makeDeterministicContext(orArgs, [
        { name: 'amount', displayName: 'Amount', value: 150 },
        { name: 'status', displayName: 'Status', value: 'pending' },
      ]);

      const result = await new ConditionStepExecutor(context).execute();

      expect((result.stepOutcome as ConditionStepOutcome).selectedOption).toBe('High or paid');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionParams: expect.objectContaining({
            evaluations: [
              {
                option: 'High or paid',
                outcome: 'matched',
                conditions: [
                  { index: 0, met: false },
                  { index: 1, met: true },
                ],
              },
            ],
          }),
        }),
      );
    });

    it('treats a null field value as not evaluable and falls back — never an error', async () => {
      const { context, runStore } = makeDeterministicContext(amountArgs, [
        { name: 'amount', displayName: 'Amount', value: null },
      ]);

      const result = await new ConditionStepExecutor(context).execute();

      expect(result.stepOutcome.status).toBe('success');
      expect((result.stepOutcome as ConditionStepOutcome).selectedOption).toBe('Other');
      // Strict, because toHaveBeenCalledWith compares like toEqual: a stray `reason: undefined`
      // would read as equal to no reason at all, and this test is what pins its absence.
      expect(jest.mocked(runStore.saveStepExecution).mock.calls[0]).toStrictEqual([
        'run-1',
        {
          type: 'condition',
          stepIndex: 0,
          executionParams: {
            evaluations: [
              { option: 'High', outcome: 'not-matched', conditions: [{ index: 0, met: null }] },
              { option: 'Low', outcome: 'not-matched', conditions: [{ index: 0, met: null }] },
            ],
            selectedOption: 'Other',
            usedFallback: true,
            evaluatedAt: expect.any(String),
            timezone: 'UTC',
          },
          executionResult: { answer: 'Other' },
        },
      ]);
      expect(context.logger).not.toHaveBeenCalledWith(
        'Warn',
        'Condition value could not be resolved, counting it as not met',
        expect.anything(),
      );
    });

    it('counts a condition whose source step never ran as not met, and says so', async () => {
      const unknownSource: ConditionPreRecordedArgs = {
        optionConditions: [
          {
            option: 'High',
            aggregator: 'and',
            conditions: [
              {
                sourceStepId: 'never-ran',
                fieldName: 'amount',
                operator: 'greater_than',
                value: 100,
              },
            ],
          },
        ],
        fallbackOption: 'Other',
      };
      const { context, runStore } = makeDeterministicContext(unknownSource, [
        { name: 'amount', displayName: 'Amount', value: 150 },
      ]);

      const result = await new ConditionStepExecutor(context).execute();

      expect(result.stepOutcome.status).toBe('success');
      expect((result.stepOutcome as ConditionStepOutcome).selectedOption).toBe('Other');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith('run-1', {
        type: 'condition',
        stepIndex: 0,
        executionParams: {
          evaluations: [
            {
              option: 'High',
              outcome: 'not-matched',
              conditions: [{ index: 0, met: null, reason: 'source-step-not-reached' }],
            },
          ],
          selectedOption: 'Other',
          usedFallback: true,
          evaluatedAt: expect.any(String),
          timezone: 'UTC',
        },
        executionResult: { answer: 'Other' },
      });
      expect(context.logger).toHaveBeenCalledWith(
        'Warn',
        'Condition value could not be resolved, counting it as not met',
        expect.objectContaining({
          sourceStepId: 'never-ran',
          fieldName: 'amount',
          reason: 'source-step-not-reached',
        }),
      );
    });

    // Build-time validation cannot catch this one: the Get Data step may let the AI pick its
    // fields, so nobody knows which ones it returns until the run.
    it('counts a condition the Get Data step failed to read as not met, and says so', async () => {
      const { context, runStore } = makeDeterministicContext(amountArgs, [
        { name: 'amount', displayName: 'Amount', error: 'Field not found: amount' },
      ]);

      const result = await new ConditionStepExecutor(context).execute();

      expect(result.stepOutcome.status).toBe('success');
      expect((result.stepOutcome as ConditionStepOutcome).selectedOption).toBe('Other');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionParams: expect.objectContaining({
            evaluations: [
              {
                option: 'High',
                outcome: 'not-matched',
                conditions: [{ index: 0, met: null, reason: 'field-not-loaded' }],
              },
              {
                option: 'Low',
                outcome: 'not-matched',
                conditions: [{ index: 0, met: null, reason: 'field-not-loaded' }],
              },
            ],
            usedFallback: true,
          }),
        }),
      );
      expect(context.logger).toHaveBeenCalledWith(
        'Warn',
        'Condition value could not be resolved, counting it as not met',
        expect.objectContaining({ fieldName: 'amount', reason: 'field-not-loaded' }),
      );
    });

    it('counts a condition as not met when the Get Data step stored no execution at all', async () => {
      const { context } = makeDeterministicContext(amountArgs, [], {
        runStore: makeMockRunStore({ getStepExecutions: jest.fn().mockResolvedValue([]) }),
      });

      const result = await new ConditionStepExecutor(context).execute();

      expect(result.stepOutcome.status).toBe('success');
      expect((result.stepOutcome as ConditionStepOutcome).selectedOption).toBe('Other');
      expect(context.logger).toHaveBeenCalledWith(
        'Warn',
        'Condition value could not be resolved, counting it as not met',
        expect.objectContaining({ reason: 'field-not-loaded' }),
      );
    });

    it('counts a condition as not met when the source step stored another kind of execution', async () => {
      const { context } = makeDeterministicContext(amountArgs, [], {
        runStore: makeMockRunStore({
          getStepExecutions: jest
            .fn()
            .mockResolvedValue([
              { type: 'guidance', stepIndex: 1, executionParams: {}, executionResult: {} },
            ]),
        }),
      });

      const result = await new ConditionStepExecutor(context).execute();

      expect((result.stepOutcome as ConditionStepOutcome).selectedOption).toBe('Other');
      expect(context.logger).toHaveBeenCalledWith(
        'Warn',
        'Condition value could not be resolved, counting it as not met',
        expect.objectContaining({ reason: 'field-not-loaded' }),
      );
    });

    // The whole point of not failing: an option that could not be read must not stop the ones
    // after it from being tried.
    it('goes on to evaluate the next option after one it could not read', async () => {
      const twoOptions: ConditionPreRecordedArgs = {
        optionConditions: [
          {
            option: 'High',
            aggregator: 'and',
            conditions: [{ sourceStepId: 'get-1', fieldName: 'missing', operator: 'present' }],
          },
          {
            option: 'Low',
            aggregator: 'and',
            conditions: [
              { sourceStepId: 'get-1', fieldName: 'amount', operator: 'greater_than', value: 100 },
            ],
          },
        ],
        fallbackOption: 'Other',
      };
      const { context, runStore } = makeDeterministicContext(twoOptions, [
        { name: 'amount', displayName: 'Amount', value: 150 },
      ]);

      const result = await new ConditionStepExecutor(context).execute();

      expect((result.stepOutcome as ConditionStepOutcome).selectedOption).toBe('Low');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionParams: expect.objectContaining({
            evaluations: [
              {
                option: 'High',
                outcome: 'not-matched',
                conditions: [{ index: 0, met: null, reason: 'field-not-loaded' }],
              },
              { option: 'Low', outcome: 'matched', conditions: [{ index: 0, met: true }] },
            ],
            usedFallback: false,
          }),
        }),
      );
    });

    it('lets blank match a resolved null value (unlike an unresolvable one)', async () => {
      const blankArgs: ConditionPreRecordedArgs = {
        optionConditions: [
          {
            option: 'No amount',
            aggregator: 'and',
            conditions: [{ sourceStepId: 'get-1', fieldName: 'amount', operator: 'blank' }],
          },
        ],
        fallbackOption: 'Other',
      };
      const { context } = makeDeterministicContext(blankArgs, [
        { name: 'amount', displayName: 'Amount', value: null },
      ]);

      const result = await new ConditionStepExecutor(context).execute();

      expect((result.stepOutcome as ConditionStepOutcome).selectedOption).toBe('No amount');
    });

    it('selects the fallback when no option matches', async () => {
      const { context, runStore } = makeDeterministicContext(amountArgs, [
        { name: 'amount', displayName: 'Amount', value: 'not a number' },
      ]);

      const result = await new ConditionStepExecutor(context).execute();

      expect(result.stepOutcome.status).toBe('success');
      expect((result.stepOutcome as ConditionStepOutcome).selectedOption).toBe('Other');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith('run-1', {
        type: 'condition',
        stepIndex: 0,
        executionParams: {
          evaluations: [
            { option: 'High', outcome: 'not-matched', conditions: [{ index: 0, met: false }] },
            { option: 'Low', outcome: 'not-matched', conditions: [{ index: 0, met: false }] },
          ],
          selectedOption: 'Other',
          usedFallback: true,
          evaluatedAt: expect.any(String),
          timezone: 'UTC',
        },
        executionResult: { answer: 'Other' },
      });
    });

    it('ignores incomingPendingData: no user override, no awaiting-input', async () => {
      const { context, mockModel, runStore } = makeDeterministicContext(
        amountArgs,
        [{ name: 'amount', displayName: 'Amount', value: 150 }],
        { incomingPendingData: { selectedOption: 'Low' } },
      );

      const result = await new ConditionStepExecutor(context).execute();

      expect(result.stepOutcome.status).toBe('success');
      expect((result.stepOutcome as ConditionStepOutcome).selectedOption).toBe('High');
      expect(mockModel.bindTools).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionParams: expect.objectContaining({ selectedOption: 'High' }),
        }),
      );
    });

    it('matches an or option when one condition is not evaluable and another is met', async () => {
      const orArgs: ConditionPreRecordedArgs = {
        optionConditions: [
          {
            option: 'Unknown or high',
            aggregator: 'or',
            conditions: [
              { sourceStepId: 'get-1', fieldName: 'status', operator: 'equal', value: 'paid' },
              { sourceStepId: 'get-1', fieldName: 'amount', operator: 'greater_than', value: 100 },
            ],
          },
        ],
        fallbackOption: 'Other',
      };
      const { context, runStore } = makeDeterministicContext(orArgs, [
        { name: 'status', displayName: 'Status', value: null },
        { name: 'amount', displayName: 'Amount', value: 150 },
      ]);

      const result = await new ConditionStepExecutor(context).execute();

      expect((result.stepOutcome as ConditionStepOutcome).selectedOption).toBe('Unknown or high');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionParams: expect.objectContaining({
            evaluations: [
              {
                option: 'Unknown or high',
                outcome: 'matched',
                conditions: [
                  { index: 0, met: null },
                  { index: 1, met: true },
                ],
              },
            ],
          }),
        }),
      );
    });

    // Not even present/blank get an answer out of a reference that was never loaded: "no value was
    // read" is not the same claim as "the value is empty".
    it.each(['blank', 'present'] as const)(
      'answers %s not met, never true, when the reference cannot be resolved at all',
      async operator => {
        const unresolvable: ConditionPreRecordedArgs = {
          optionConditions: [
            {
              option: 'Matched',
              aggregator: 'and',
              conditions: [{ sourceStepId: 'never-ran', fieldName: 'amount', operator }],
            },
          ],
          fallbackOption: 'Other',
        };
        const { context, runStore } = makeDeterministicContext(unresolvable, [
          { name: 'amount', displayName: 'Amount', value: 150 },
        ]);

        const result = await new ConditionStepExecutor(context).execute();

        expect((result.stepOutcome as ConditionStepOutcome).selectedOption).toBe('Other');
        expect(runStore.saveStepExecution).toHaveBeenCalledWith(
          'run-1',
          expect.objectContaining({
            executionParams: expect.objectContaining({
              evaluations: [
                {
                  option: 'Matched',
                  outcome: 'not-matched',
                  conditions: [{ index: 0, met: null, reason: 'source-step-not-reached' }],
                },
              ],
            }),
          }),
        );
      },
    );

    it('compares a decimal column returned as a string against the builder number', async () => {
      const { context } = makeDeterministicContext(amountArgs, [
        { name: 'amount', displayName: 'Amount', value: '150.00' },
      ]);

      const result = await new ConditionStepExecutor(context).execute();

      expect((result.stepOutcome as ConditionStepOutcome).selectedOption).toBe('High');
    });

    it('fails loud when the matched option is not one of the step options', async () => {
      const { context, runStore } = makeDeterministicContext(amountArgs, [
        { name: 'amount', displayName: 'Amount', value: 150 },
      ]);
      const result = await new ConditionStepExecutor({
        ...context,
        stepDefinition: { ...context.stepDefinition, options: ['Low', 'Other'] },
      }).execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'The workflow step configuration is invalid. Please check the workflow designer.',
      );
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });

    it('fails loud when the fallback option is not one of the step options', async () => {
      const { context, runStore } = makeDeterministicContext(amountArgs, [
        { name: 'amount', displayName: 'Amount', value: 'not a number' },
      ]);
      const result = await new ConditionStepExecutor({
        ...context,
        stepDefinition: { ...context.stepDefinition, options: ['High', 'Low'] },
      }).execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });

    it('reads nothing from a repeated source step id whose latest occurrence did not load', async () => {
      const runStore = makeMockRunStore({
        getStepExecutions: jest
          .fn()
          .mockResolvedValue([
            makeReadRecordExecution(1, [{ name: 'amount', displayName: 'Amount', value: 150 }]),
            makeReadRecordExecution(2, [{ name: 'other', displayName: 'Other', value: 1 }]),
          ]),
      });
      const context = makeContext({
        model: makeMockModel().model,
        runStore,
        stepDefinition: makeDeterministicStep(amountArgs),
        previousSteps: [makeGetDataStep('get-1', 1), makeGetDataStep('get-1', 2)],
      });

      const result = await new ConditionStepExecutor(context).execute();

      // The value the earlier occurrence did load must not be borrowed: this iteration read nothing.
      expect((result.stepOutcome as ConditionStepOutcome).selectedOption).toBe('Other');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionParams: expect.objectContaining({
            evaluations: expect.arrayContaining([
              {
                option: 'High',
                outcome: 'not-matched',
                conditions: [{ index: 0, met: null, reason: 'field-not-loaded' }],
              },
            ]),
          }),
        }),
      );
    });

    // 2026-09-04T23:00Z is still 4 September in UTC but already 5 September in Paris. A record
    // stamped 5 September 00:30 Paris is "today" only if the project zone, not UTC nor the
    // machine's, is what the evaluator was handed.
    it('reads relative dates in the context timezone and records the instant it used', async () => {
      const todayInParis: ConditionPreRecordedArgs = {
        optionConditions: [
          {
            option: 'Today',
            aggregator: 'and',
            conditions: [{ sourceStepId: 'get-1', fieldName: 'signedAt', operator: 'today' }],
          },
        ],
        fallbackOption: 'Other',
      };
      const { context, runStore } = makeDeterministicContext(
        todayInParis,
        [{ name: 'signedAt', displayName: 'Signed at', value: '2026-09-04T22:30:00Z' }],
        { timezone: 'Europe/Paris' },
      );

      try {
        jest.useFakeTimers().setSystemTime(new Date('2026-09-04T23:00:00Z'));
        const result = await new ConditionStepExecutor(context).execute();

        expect((result.stepOutcome as ConditionStepOutcome).selectedOption).toBe('Today');
        expect(runStore.saveStepExecution).toHaveBeenCalledWith(
          'run-1',
          expect.objectContaining({
            executionParams: expect.objectContaining({
              evaluatedAt: '2026-09-04T23:00:00.000Z',
              timezone: 'Europe/Paris',
            }),
          }),
        );
      } finally {
        jest.useRealTimers();
      }
    });

    it('does not read a record from the next UTC day as today when the project zone is UTC', async () => {
      const todayArgs: ConditionPreRecordedArgs = {
        optionConditions: [
          {
            option: 'Today',
            aggregator: 'and',
            conditions: [{ sourceStepId: 'get-1', fieldName: 'signedAt', operator: 'today' }],
          },
        ],
        fallbackOption: 'Other',
      };
      const { context } = makeDeterministicContext(todayArgs, [
        { name: 'signedAt', displayName: 'Signed at', value: '2026-09-05T00:30:00Z' },
      ]);

      try {
        jest.useFakeTimers().setSystemTime(new Date('2026-09-04T23:00:00Z'));
        const result = await new ConditionStepExecutor(context).execute();

        expect((result.stepOutcome as ConditionStepOutcome).selectedOption).toBe('Other');
      } finally {
        jest.useRealTimers();
      }
    });

    it('uses the most recent occurrence of a repeated source step id (loop)', async () => {
      const runStore = makeMockRunStore({
        getStepExecutions: jest
          .fn()
          .mockResolvedValue([
            makeReadRecordExecution(1, [{ name: 'amount', displayName: 'Amount', value: 50 }]),
            makeReadRecordExecution(2, [{ name: 'amount', displayName: 'Amount', value: 150 }]),
          ]),
      });
      const context = makeContext({
        model: makeMockModel().model,
        runStore,
        stepDefinition: makeDeterministicStep(amountArgs),
        previousSteps: [makeGetDataStep('get-1', 1), makeGetDataStep('get-1', 2)],
      });

      const result = await new ConditionStepExecutor(context).execute();

      expect((result.stepOutcome as ConditionStepOutcome).selectedOption).toBe('High');
    });
  });

  describe('executionType=Manual', () => {
    it('returns awaiting-input without preRecordedArgs, no AI and no save, when no incomingPendingData', async () => {
      const mockModel = makeMockModel();
      const runStore = makeMockRunStore();
      const stepDefinition = makeStep({ executionType: StepExecutionMode.Manual });
      const executor = new ConditionStepExecutor(
        makeContext({ model: mockModel.model, runStore, stepDefinition }),
      );

      expect(stepDefinition.preRecordedArgs).toBeUndefined();

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('awaiting-input');
      expect(mockModel.bindTools).not.toHaveBeenCalled();
      expect(mockModel.invoke).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });

    it('persists the user-selected option without calling AI when incomingPendingData is provided', async () => {
      const mockModel = makeMockModel();
      const runStore = makeMockRunStore();
      const executor = new ConditionStepExecutor(
        makeContext({
          model: mockModel.model,
          runStore,
          stepDefinition: makeStep({ executionType: StepExecutionMode.Manual }),
          incomingPendingData: { selectedOption: 'Approve' },
        }),
      );

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect((result.stepOutcome as ConditionStepOutcome).selectedOption).toBe('Approve');
      expect(mockModel.bindTools).not.toHaveBeenCalled();
      expect(mockModel.invoke).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).toHaveBeenCalledWith('run-1', {
        type: 'condition',
        stepIndex: 0,
        executionParams: { answer: 'Approve', reasoning: 'Selected by user' },
        executionResult: { answer: 'Approve' },
      });
    });

    it('rejects an option not in step.options even in Manual mode', async () => {
      const mockModel = makeMockModel();
      const runStore = makeMockRunStore();
      const executor = new ConditionStepExecutor(
        makeContext({
          model: mockModel.model,
          runStore,
          stepDefinition: makeStep({ executionType: StepExecutionMode.Manual }),
          incomingPendingData: { selectedOption: 'Maybe' },
        }),
      );

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(mockModel.bindTools).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });
});
