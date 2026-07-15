import type { ActivityLogPort } from '../../src/ports/activity-log-port';
import type { AgentPort } from '../../src/ports/agent-port';
import type { RunStore } from '../../src/ports/run-store';
import type { WorkflowPort } from '../../src/ports/workflow-port';
import type { ExecutionContext } from '../../src/types/execution-context';
import type { RecordRef } from '../../src/types/validated/collection';
import type { GuidanceStepDefinition } from '../../src/types/validated/step-definition';
import type { GuidanceStepOutcome } from '../../src/types/validated/step-outcome';

import ActivityLog from '../../src/executors/activity-log';
import AgentWithLog from '../../src/executors/agent-with-log';
import GuidanceStepExecutor from '../../src/executors/guidance-step-executor';
import SchemaCache from '../../src/schema-cache';
import SchemaResolver from '../../src/schema-resolver';
import { StepExecutionMode, StepType } from '../../src/types/validated/step-definition';

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

function makeMockModel(
  toolCallArgs?: Record<string, unknown>,
  toolName = 'submit_guidance_response',
) {
  const invoke = jest.fn().mockResolvedValue({
    tool_calls: toolCallArgs ? [{ name: toolName, args: toolCallArgs, id: 'call_1' }] : undefined,
  });
  const bindTools = jest.fn().mockReturnValue({ invoke });
  const model = { bindTools } as unknown as ExecutionContext['model'];

  return { model, bindTools, invoke };
}

function makeStep(overrides: Partial<GuidanceStepDefinition> = {}): GuidanceStepDefinition {
  return { type: StepType.Guidance, executionType: StepExecutionMode.Manual, ...overrides };
}

function makeContext(
  overrides: Partial<ExecutionContext<GuidanceStepDefinition>> & {
    agentPort?: AgentPort;
    activityLogPort?: ActivityLogPort;
    activityLog?: ActivityLog;
    workflowPort?: WorkflowPort;
  } = {},
): ExecutionContext<GuidanceStepDefinition> {
  const runId = overrides.runId ?? 'run-1';
  const workflowPort = overrides.workflowPort ?? ({} as WorkflowPort);
  const schemaCache = new SchemaCache();

  const base: Omit<ExecutionContext<GuidanceStepDefinition>, 'agent' | 'activityLog'> = {
    runId,
    stepId: 'guidance-1',
    stepIndex: 0,
    collectionId: 'col-1',
    baseRecordRef: {
      collectionName: 'customers',
      recordId: [1],
      stepIndex: 0,
    } as RecordRef,
    stepDefinition: makeStep(),
    model: {} as ExecutionContext['model'],
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

describe('GuidanceStepExecutor', () => {
  describe('submit path (front POST)', () => {
    it('saves executionResult and returns success when incomingPendingData has valid userInput', async () => {
      const runStore = makeMockRunStore();

      const executor = new GuidanceStepExecutor(
        makeContext({
          runStore,
          incomingPendingData: { userInput: 'Please proceed with option A' },
        }),
      );
      const result = await executor.execute();

      const outcome = result.stepOutcome as GuidanceStepOutcome;
      expect(outcome.type).toBe('guidance');
      expect(outcome.status).toBe('success');
      expect(outcome.stepId).toBe('guidance-1');
      expect(outcome.stepIndex).toBe(0);

      expect(runStore.saveStepExecution).toHaveBeenCalledWith('run-1', {
        type: 'guidance',
        stepIndex: 0,
        executionResult: { userInput: 'Please proceed with option A' },
      });
    });

    it('saves empty string and returns success when userInput is empty', async () => {
      const runStore = makeMockRunStore();

      const executor = new GuidanceStepExecutor(
        makeContext({ runStore, incomingPendingData: { userInput: '' } }),
      );
      const result = await executor.execute();

      expect((result.stepOutcome as GuidanceStepOutcome).status).toBe('success');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith('run-1', {
        type: 'guidance',
        stepIndex: 0,
        executionResult: { userInput: '' },
      });
    });

    it('saves empty string and returns success when userInput is absent', async () => {
      const runStore = makeMockRunStore();

      const executor = new GuidanceStepExecutor(makeContext({ runStore, incomingPendingData: {} }));
      const result = await executor.execute();

      expect((result.stepOutcome as GuidanceStepOutcome).status).toBe('success');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith('run-1', {
        type: 'guidance',
        stepIndex: 0,
        executionResult: { userInput: '' },
      });
    });

    it('processes the submission without calling the AI even in an AI mode', async () => {
      const runStore = makeMockRunStore();
      const { model, bindTools } = makeMockModel({ response: 'unused' });

      const executor = new GuidanceStepExecutor(
        makeContext({
          runStore,
          model,
          stepDefinition: makeStep({ executionType: StepExecutionMode.AutomatedWithConfirmation }),
          incomingPendingData: { userInput: 'human answer' },
        }),
      );
      await executor.execute();

      expect(bindTools).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).toHaveBeenCalledWith('run-1', {
        type: 'guidance',
        stepIndex: 0,
        executionResult: { userInput: 'human answer' },
      });
    });
  });

  describe('executionType=Manual', () => {
    it('returns awaiting-input and never calls the AI', async () => {
      const runStore = makeMockRunStore();
      const { model, bindTools } = makeMockModel({ response: 'unused' });

      const executor = new GuidanceStepExecutor(makeContext({ runStore, model }));
      const result = await executor.execute();

      expect((result.stepOutcome as GuidanceStepOutcome).status).toBe('awaiting-input');
      expect(bindTools).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('executionType=AutomatedWithConfirmation (AI-assisted)', () => {
    it('saves the AI draft as pendingData with aiGenerated and returns awaiting-input', async () => {
      const runStore = makeMockRunStore();
      const { model } = makeMockModel({ response: 'Drafted answer from the AI' });

      const executor = new GuidanceStepExecutor(
        makeContext({
          runStore,
          model,
          stepDefinition: makeStep({
            executionType: StepExecutionMode.AutomatedWithConfirmation,
            prompt: 'Summarize the situation',
          }),
        }),
      );
      const result = await executor.execute();

      expect((result.stepOutcome as GuidanceStepOutcome).status).toBe('awaiting-input');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith('run-1', {
        type: 'guidance',
        stepIndex: 0,
        pendingData: { userInput: 'Drafted answer from the AI', aiGenerated: true },
      });
    });

    it('sends the step prompt and workflow context to the AI', async () => {
      const { model, bindTools, invoke } = makeMockModel({ response: 'answer' });

      const executor = new GuidanceStepExecutor(
        makeContext({
          model,
          stepDefinition: makeStep({
            executionType: StepExecutionMode.AutomatedWithConfirmation,
            prompt: 'Summarize the customer situation',
          }),
        }),
      );
      await executor.execute();

      expect(bindTools).toHaveBeenCalledWith(
        [expect.objectContaining({ name: 'submit_guidance_response' })],
        { tool_choice: 'any' },
      );
      const messages = invoke.mock.calls[0][0] as { content: string }[];
      const allContent = messages.map(m => m.content).join('\n');
      expect(allContent).toContain('Summarize the customer situation');
    });

    it('grounds the AI in the trigger record field values', async () => {
      const { model, invoke } = makeMockModel({ response: 'answer' });
      const schema = {
        collectionName: 'customers',
        collectionId: 'col-customers',
        collectionDisplayName: 'Customers',
        primaryKeyFields: ['id'],
        fields: [
          { fieldName: 'firstName', displayName: 'First name', isRelationship: false },
          { fieldName: 'lastName', displayName: 'Last name', isRelationship: false },
          { fieldName: 'orders', displayName: 'Orders', isRelationship: true },
        ],
        actions: [],
      };
      const workflowPort = {
        getCollectionSchema: jest.fn().mockResolvedValue(schema),
      } as unknown as WorkflowPort;
      const agentPort = {
        getRecord: jest.fn().mockResolvedValue({
          values: { firstName: 'Godfried', lastName: 'Kunstmann', orders: null },
        }),
      } as unknown as AgentPort;

      const executor = new GuidanceStepExecutor(
        makeContext({
          model,
          workflowPort,
          agentPort,
          stepDefinition: makeStep({
            executionType: StepExecutionMode.AutomatedWithConfirmation,
            prompt: 'Summarize the account holder',
          }),
        }),
      );
      await executor.execute();

      // Only non-relation fields are fetched for the trigger record.
      expect(agentPort.getRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'customers',
          id: [1],
          fields: ['firstName', 'lastName'],
        }),
        expect.anything(),
      );
      const allContent = (invoke.mock.calls[0][0] as { content: string }[])
        .map(m => m.content)
        .join('\n');
      // The record values reach the model (regression guard for the "uses operator name" bug).
      expect(allContent).toContain('Godfried');
      expect(allContent).toContain('Kunstmann');
    });

    it('keeps the trigger record grounding when one field value is not JSON-serializable', async () => {
      const { model, invoke } = makeMockModel({ response: 'answer' });
      const schema = {
        collectionName: 'customers',
        collectionId: 'col-customers',
        collectionDisplayName: 'Customers',
        primaryKeyFields: ['id'],
        fields: [
          { fieldName: 'firstName', displayName: 'First name', isRelationship: false },
          { fieldName: 'balance', displayName: 'Balance', isRelationship: false },
        ],
        actions: [],
      };
      const workflowPort = {
        getCollectionSchema: jest.fn().mockResolvedValue(schema),
      } as unknown as WorkflowPort;
      const agentPort = {
        getRecord: jest.fn().mockResolvedValue({
          values: { firstName: 'Godfried', balance: BigInt(9007199254740993n) },
        }),
      } as unknown as AgentPort;

      const executor = new GuidanceStepExecutor(
        makeContext({
          model,
          workflowPort,
          agentPort,
          stepDefinition: makeStep({
            executionType: StepExecutionMode.AutomatedWithConfirmation,
            prompt: 'Summarize the account holder',
          }),
        }),
      );
      await executor.execute();

      const allContent = (invoke.mock.calls[0][0] as { content: string }[])
        .map(m => m.content)
        .join('\n');
      expect(allContent).toContain('Godfried');
      expect(allContent).toContain('9007199254740993');
    });

    it('does not regenerate the draft when a pending execution already exists (re-dispatch)', async () => {
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([
          {
            type: 'guidance',
            stepIndex: 0,
            pendingData: { userInput: 'earlier draft', aiGenerated: true },
          },
        ]),
      });
      const { model, bindTools } = makeMockModel({ response: 'new draft' });

      const executor = new GuidanceStepExecutor(
        makeContext({
          runStore,
          model,
          stepDefinition: makeStep({ executionType: StepExecutionMode.AutomatedWithConfirmation }),
        }),
      );
      const result = await executor.execute();

      expect((result.stepOutcome as GuidanceStepOutcome).status).toBe('awaiting-input');
      expect(bindTools).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });

    it('degrades to manual (empty pendingData, awaiting-input) when the AI call fails', async () => {
      const runStore = makeMockRunStore();
      const invoke = jest.fn().mockRejectedValue(new Error('AI provider down'));
      const model = {
        bindTools: jest.fn().mockReturnValue({ invoke }),
      } as unknown as ExecutionContext['model'];

      const executor = new GuidanceStepExecutor(
        makeContext({
          runStore,
          model,
          stepDefinition: makeStep({ executionType: StepExecutionMode.AutomatedWithConfirmation }),
        }),
      );
      const result = await executor.execute();

      expect((result.stepOutcome as GuidanceStepOutcome).status).toBe('awaiting-input');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith('run-1', {
        type: 'guidance',
        stepIndex: 0,
        pendingData: {},
      });
    });

    it('opens an empty field (degrade, no badge) when the AI returns a whitespace-only draft', async () => {
      const runStore = makeMockRunStore();
      const { model } = makeMockModel({ response: '   ' });

      const executor = new GuidanceStepExecutor(
        makeContext({
          runStore,
          model,
          stepDefinition: makeStep({ executionType: StepExecutionMode.AutomatedWithConfirmation }),
        }),
      );
      const result = await executor.execute();

      expect((result.stepOutcome as GuidanceStepOutcome).status).toBe('awaiting-input');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith('run-1', {
        type: 'guidance',
        stepIndex: 0,
        pendingData: {},
      });
    });

    it('degrades to manual when the AI returns a non-string response (no TypeError)', async () => {
      const runStore = makeMockRunStore();
      // A malformed tool arg (not a string) — the tool arg is not runtime-validated against its schema.
      const { model } = makeMockModel({ response: 123 });

      const executor = new GuidanceStepExecutor(
        makeContext({
          runStore,
          model,
          stepDefinition: makeStep({ executionType: StepExecutionMode.AutomatedWithConfirmation }),
        }),
      );
      const result = await executor.execute();

      expect((result.stepOutcome as GuidanceStepOutcome).status).toBe('awaiting-input');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith('run-1', {
        type: 'guidance',
        stepIndex: 0,
        pendingData: {},
      });
    });

    it('does not retry the AI on re-dispatch after a degrade (empty pendingData persisted)', async () => {
      const runStore = makeMockRunStore({
        getStepExecutions: jest
          .fn()
          .mockResolvedValue([{ type: 'guidance', stepIndex: 0, pendingData: {} }]),
      });
      const { model, bindTools } = makeMockModel({ response: 'new draft' });

      const executor = new GuidanceStepExecutor(
        makeContext({
          runStore,
          model,
          stepDefinition: makeStep({ executionType: StepExecutionMode.AutomatedWithConfirmation }),
        }),
      );
      const result = await executor.execute();

      expect((result.stepOutcome as GuidanceStepOutcome).status).toBe('awaiting-input');
      expect(bindTools).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('executionType=FullyAutomated (Full AI)', () => {
    it('saves the AI response as executionResult with generatedByAi and returns success without pausing', async () => {
      const runStore = makeMockRunStore();
      const { model } = makeMockModel({ response: 'Auto-written summary' });

      const executor = new GuidanceStepExecutor(
        makeContext({
          runStore,
          model,
          stepDefinition: makeStep({
            executionType: StepExecutionMode.FullyAutomated,
            prompt: 'Write a summary',
          }),
        }),
      );
      const result = await executor.execute();

      expect((result.stepOutcome as GuidanceStepOutcome).status).toBe('success');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith('run-1', {
        type: 'guidance',
        stepIndex: 0,
        executionResult: { userInput: 'Auto-written summary', generatedByAi: true },
      });
    });

    it('replays success without re-calling the AI when executionResult already exists', async () => {
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([
          {
            type: 'guidance',
            stepIndex: 0,
            executionResult: { userInput: 'done', generatedByAi: true },
          },
        ]),
      });
      const { model, bindTools } = makeMockModel({ response: 'new' });

      const executor = new GuidanceStepExecutor(
        makeContext({
          runStore,
          model,
          stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
        }),
      );
      const result = await executor.execute();

      expect((result.stepOutcome as GuidanceStepOutcome).status).toBe('success');
      expect(bindTools).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });

    it('degrades to manual awaiting-input on AI failure (run does not fail, step not skipped)', async () => {
      const runStore = makeMockRunStore();
      const invoke = jest.fn().mockRejectedValue(new Error('AI provider down'));
      const model = {
        bindTools: jest.fn().mockReturnValue({ invoke }),
      } as unknown as ExecutionContext['model'];

      const executor = new GuidanceStepExecutor(
        makeContext({
          runStore,
          model,
          stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
        }),
      );
      const result = await executor.execute();

      expect((result.stepOutcome as GuidanceStepOutcome).status).toBe('awaiting-input');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith('run-1', {
        type: 'guidance',
        stepIndex: 0,
        pendingData: {},
      });
    });

    it('degrades to manual awaiting-input on an empty AI response', async () => {
      const runStore = makeMockRunStore();
      const { model } = makeMockModel({ response: '' });

      const executor = new GuidanceStepExecutor(
        makeContext({
          runStore,
          model,
          stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
        }),
      );
      const result = await executor.execute();

      expect((result.stepOutcome as GuidanceStepOutcome).status).toBe('awaiting-input');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith('run-1', {
        type: 'guidance',
        stepIndex: 0,
        pendingData: {},
      });
    });
  });
});
