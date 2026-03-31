import type { AgentPort } from '../../src/ports/agent-port';
import type { RunStore } from '../../src/ports/run-store';
import type { WorkflowPort } from '../../src/ports/workflow-port';
import type { ExecutionContext } from '../../src/types/execution';
import type { CollectionSchema, RecordRef } from '../../src/types/record';
import type { TriggerActionStepDefinition } from '../../src/types/step-definition';
import type { TriggerRecordActionStepExecutionData } from '../../src/types/step-execution-data';

import { StepStateError } from '../../src/errors';
import TriggerRecordActionStepExecutor from '../../src/executors/trigger-record-action-step-executor';
import SchemaCache from '../../src/schema-cache';
import { StepType } from '../../src/types/step-definition';

function makeStep(
  overrides: Partial<TriggerActionStepDefinition> = {},
): TriggerActionStepDefinition {
  return {
    type: StepType.TriggerAction,
    prompt: 'Send a welcome email to the customer',
    ...overrides,
  };
}

function makeRecordRef(overrides: Partial<RecordRef> = {}): RecordRef {
  return {
    collectionName: 'customers',
    recordId: [42],
    stepIndex: 0,
    ...overrides,
  };
}

function makeMockAgentPort(): AgentPort {
  return {
    getRecord: jest.fn(),
    updateRecord: jest.fn(),
    getRelatedData: jest.fn(),
    executeAction: jest.fn().mockResolvedValue(undefined),
  } as unknown as AgentPort;
}

function makeCollectionSchema(overrides: Partial<CollectionSchema> = {}): CollectionSchema {
  return {
    collectionName: 'customers',
    collectionDisplayName: 'Customers',
    primaryKeyFields: ['id'],
    fields: [
      { fieldName: 'email', displayName: 'Email', isRelationship: false },
      { fieldName: 'status', displayName: 'Status', isRelationship: false },
    ],
    actions: [
      {
        name: 'send-welcome-email',
        displayName: 'Send Welcome Email',
        endpoint: '/forest/actions/send-welcome-email',
      },
      { name: 'archive', displayName: 'Archive Customer', endpoint: '/forest/actions/archive' },
    ],
    ...overrides,
  };
}

function makeMockRunStore(overrides: Partial<RunStore> = {}): RunStore {
  return {
    init: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    getStepExecutions: jest.fn().mockResolvedValue([]),
    saveStepExecution: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeMockWorkflowPort(
  schemasByCollection: Record<string, CollectionSchema> = {
    customers: makeCollectionSchema(),
  },
): WorkflowPort {
  return {
    getPendingStepExecutions: jest.fn().mockResolvedValue([]),
    getPendingStepExecutionsForRun: jest.fn().mockResolvedValue(null),
    updateStepExecution: jest.fn().mockResolvedValue(undefined),
    getCollectionSchema: jest
      .fn()
      .mockImplementation((name: string) =>
        Promise.resolve(
          schemasByCollection[name] ?? makeCollectionSchema({ collectionName: name }),
        ),
      ),
    getMcpServerConfigs: jest.fn().mockResolvedValue([]),
    hasRunAccess: jest.fn().mockResolvedValue(true),
  };
}

function makeMockModel(toolCallArgs?: Record<string, unknown>, toolName = 'select-action') {
  const invoke = jest.fn().mockResolvedValue({
    tool_calls: toolCallArgs ? [{ name: toolName, args: toolCallArgs, id: 'call_1' }] : undefined,
  });
  const bindTools = jest.fn().mockReturnValue({ invoke });
  const model = { bindTools } as unknown as ExecutionContext['model'];

  return { model, bindTools, invoke };
}

function makeContext(
<<<<<<< HEAD
  overrides: Partial<ExecutionContext<TriggerActionStepDefinition>> = {},
): ExecutionContext<TriggerActionStepDefinition> {
=======
  overrides: Partial<ExecutionContext<RecordStepDefinition>> = {},
): ExecutionContext<RecordStepDefinition> {
>>>>>>> f1f21c002 (refactor(workflow-executor): rename McpTask to Mcp and RecordTaskStepDefinition to RecordStepDefinition)
  return {
    runId: 'run-1',
    stepId: 'trigger-1',
    stepIndex: 0,
    baseRecordRef: makeRecordRef(),
    stepDefinition: makeStep(),
    model: makeMockModel({
      actionName: 'Send Welcome Email',
      reasoning: 'User requested welcome email',
    }).model,
    agentPort: makeMockAgentPort(),
    workflowPort: makeMockWorkflowPort(),
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
    schemaCache: new SchemaCache(),
    previousSteps: [],
    logger: { info: jest.fn(), error: jest.fn() },
    ...overrides,
  };
}

describe('TriggerRecordActionStepExecutor', () => {
  describe('automaticExecution: trigger direct (Branch B)', () => {
    it('triggers the action and returns success', async () => {
      const agentPort = makeMockAgentPort();
      (agentPort.executeAction as jest.Mock).mockResolvedValue({ message: 'Email sent' });
      const mockModel = makeMockModel({
        actionName: 'Send Welcome Email',
        reasoning: 'User requested welcome email',
      });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        runStore,
        stepDefinition: makeStep({ automaticExecution: true }),
      });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(agentPort.executeAction).toHaveBeenCalledWith(
        { collection: 'customers', action: 'send-welcome-email', id: [42] },
        expect.objectContaining({ id: 1 }),
      );
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          type: 'trigger-action',
          stepIndex: 0,
          executionParams: {
            displayName: 'Send Welcome Email',
            name: 'send-welcome-email',
          },
          executionResult: { success: true, actionResult: { message: 'Email sent' } },
          selectedRecordRef: expect.objectContaining({
            collectionName: 'customers',
            recordId: [42],
          }),
        }),
      );
    });
  });

  describe('without automaticExecution: awaiting-input (Branch C)', () => {
    it('saves pendingAction and returns awaiting-input', async () => {
      const mockModel = makeMockModel({
        actionName: 'Send Welcome Email',
        reasoning: 'User requested welcome email',
      });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        runStore,
      });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('awaiting-input');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          type: 'trigger-action',
          stepIndex: 0,
          pendingData: {
            displayName: 'Send Welcome Email',
            name: 'send-welcome-email',
          },
          selectedRecordRef: expect.objectContaining({
            collectionName: 'customers',
            recordId: [42],
          }),
        }),
      );
    });
  });

  describe('confirmation accepted (Branch A)', () => {
    it('triggers the action when user confirms and preserves pendingAction', async () => {
      const agentPort = makeMockAgentPort();
      (agentPort.executeAction as jest.Mock).mockResolvedValue({ message: 'Email sent' });
      const execution: TriggerRecordActionStepExecutionData = {
        type: 'trigger-action',
        stepIndex: 0,
        pendingData: {
          displayName: 'Send Welcome Email',
          name: 'send-welcome-email',
          userConfirmed: true,
        },
        selectedRecordRef: makeRecordRef(),
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const context = makeContext({ agentPort, runStore });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(agentPort.executeAction).toHaveBeenCalledWith(
        { collection: 'customers', action: 'send-welcome-email', id: [42] },
        expect.objectContaining({ id: 1 }),
      );
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          type: 'trigger-action',
          executionParams: {
            displayName: 'Send Welcome Email',
            name: 'send-welcome-email',
          },
          executionResult: { success: true, actionResult: { message: 'Email sent' } },
          pendingData: {
            displayName: 'Send Welcome Email',
            name: 'send-welcome-email',
            userConfirmed: true,
          },
        }),
      );
    });
  });

  describe('confirmation rejected (Branch A)', () => {
    it('skips the action when user rejects', async () => {
      const agentPort = makeMockAgentPort();
      const execution: TriggerRecordActionStepExecutionData = {
        type: 'trigger-action',
        stepIndex: 0,
        pendingData: {
          displayName: 'Send Welcome Email',
          name: 'send-welcome-email',
          userConfirmed: false,
        },
        selectedRecordRef: makeRecordRef(),
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const context = makeContext({ agentPort, runStore });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(agentPort.executeAction).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionResult: { skipped: true },
          pendingData: {
            displayName: 'Send Welcome Email',
            name: 'send-welcome-email',
            userConfirmed: false,
          },
        }),
      );
    });
  });

  describe('no pending action in confirmation flow (Branch A)', () => {
    it('falls through to first-call path when no pending action is found', async () => {
      const runStore = makeMockRunStore({
        init: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
        getStepExecutions: jest.fn().mockResolvedValue([]),
      });
      const context = makeContext({ runStore });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('awaiting-input');
    });

    it('falls through to first-call path when execution exists but stepIndex does not match', async () => {
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([
          {
            type: 'trigger-action',
            stepIndex: 5,
            pendingData: { displayName: 'Send Welcome Email' },
            selectedRecordRef: makeRecordRef(),
          },
        ]),
      });
      const context = makeContext({ runStore });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('awaiting-input');
    });

    it('returns error outcome when execution exists but pendingData is absent', async () => {
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([
          {
            type: 'trigger-action',
            stepIndex: 0,
            selectedRecordRef: makeRecordRef(),
          },
        ]),
      });
      const context = makeContext({ runStore });
      const executor = new TriggerRecordActionStepExecutor(context);

      await expect(executor.execute()).resolves.toMatchObject({
        stepOutcome: {
          type: 'record',
          stepId: 'trigger-1',
          stepIndex: 0,
          status: 'error',
          error: 'An unexpected error occurred while processing this step.',
        },
      });
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('NoActionsError', () => {
    it('returns error when collection has no actions', async () => {
      const schema = makeCollectionSchema({ actions: [] });
      const mockModel = makeMockModel({
        actionName: 'Send Welcome Email',
        reasoning: 'test',
      });
      const runStore = makeMockRunStore();
      const workflowPort = makeMockWorkflowPort({ customers: schema });
      const context = makeContext({ model: mockModel.model, runStore, workflowPort });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe('No actions are available on this record.');
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('resolveActionName failure', () => {
    it('returns error when AI returns an action name not found in the schema', async () => {
      const agentPort = makeMockAgentPort();
      const mockModel = makeMockModel({
        actionName: 'NonExistentAction',
        reasoning: 'hallucinated',
      });
      const schema = makeCollectionSchema({
        actions: [
          { name: 'archive', displayName: 'Archive Customer', endpoint: '/forest/actions/archive' },
        ],
      });
      const runStore = makeMockRunStore();
      const workflowPort = makeMockWorkflowPort({ customers: schema });
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        runStore,
        workflowPort,
        stepDefinition: makeStep({ automaticExecution: true }),
      });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        "The AI selected an action that doesn't exist on this record. Try rephrasing the step's prompt.",
      );
      expect(agentPort.executeAction).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('agentPort.executeAction WorkflowExecutorError (Branch B)', () => {
    it('returns error when executeAction throws WorkflowExecutorError', async () => {
      const agentPort = makeMockAgentPort();
      (agentPort.executeAction as jest.Mock).mockRejectedValue(
        new StepStateError('Action not permitted'),
      );
      const mockModel = makeMockModel({
        actionName: 'Send Welcome Email',
        reasoning: 'test',
      });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        runStore,
        stepDefinition: makeStep({ automaticExecution: true }),
      });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.type).toBe('record');
      expect(result.stepOutcome.stepId).toBe('trigger-1');
      expect(result.stepOutcome.stepIndex).toBe(0);
      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'An unexpected error occurred while processing this step.',
      );
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('agentPort.executeAction WorkflowExecutorError (Branch A)', () => {
    it('returns error when executeAction throws WorkflowExecutorError during confirmation', async () => {
      const agentPort = makeMockAgentPort();
      (agentPort.executeAction as jest.Mock).mockRejectedValue(
        new StepStateError('Action not permitted'),
      );
      const execution: TriggerRecordActionStepExecutionData = {
        type: 'trigger-action',
        stepIndex: 0,
        pendingData: {
          displayName: 'Send Welcome Email',
          name: 'send-welcome-email',
          userConfirmed: true,
        },
        selectedRecordRef: makeRecordRef(),
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const context = makeContext({ agentPort, runStore });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.type).toBe('record');
      expect(result.stepOutcome.stepId).toBe('trigger-1');
      expect(result.stepOutcome.stepIndex).toBe(0);
      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'An unexpected error occurred while processing this step.',
      );
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('agentPort.executeAction infra error', () => {
    it('returns error outcome for infrastructure errors (Branch B)', async () => {
      const agentPort = makeMockAgentPort();
      (agentPort.executeAction as jest.Mock).mockRejectedValue(new Error('Connection refused'));
      const mockModel = makeMockModel({
        actionName: 'Send Welcome Email',
        reasoning: 'test',
      });
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        stepDefinition: makeStep({ automaticExecution: true }),
      });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();
      expect(result.stepOutcome.status).toBe('error');
    });

    it('returns error outcome for infrastructure errors (Branch A)', async () => {
      const agentPort = makeMockAgentPort();
      (agentPort.executeAction as jest.Mock).mockRejectedValue(new Error('Connection refused'));
      const execution: TriggerRecordActionStepExecutionData = {
        type: 'trigger-action',
        stepIndex: 0,
        pendingData: {
          displayName: 'Send Welcome Email',
          name: 'send-welcome-email',
          userConfirmed: true,
        },
        selectedRecordRef: makeRecordRef(),
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const context = makeContext({ agentPort, runStore });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();
      expect(result.stepOutcome.status).toBe('error');
    });

    it('returns user message and logs cause when agentPort.executeAction throws an infra error', async () => {
      const logger = { info: jest.fn(), error: jest.fn() };
      const agentPort = makeMockAgentPort();
      (agentPort.executeAction as jest.Mock).mockRejectedValue(new Error('DB connection lost'));
      const mockModel = makeMockModel({
        actionName: 'Send Welcome Email',
        reasoning: 'User requested welcome email',
      });
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        logger,
        stepDefinition: makeStep({ automaticExecution: true }),
      });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'An error occurred while accessing your data. Please try again.',
      );
      expect(logger.error).toHaveBeenCalledWith(
        'Agent port "executeAction" failed: DB connection lost',
        expect.objectContaining({ cause: 'DB connection lost' }),
      );
    });
  });

  describe('displayName → name resolution', () => {
    it('calls executeAction with the technical name when AI returns a displayName', async () => {
      const agentPort = makeMockAgentPort();
      // AI returns displayName 'Archive Customer', technical name is 'archive'
      const mockModel = makeMockModel({
        actionName: 'Archive Customer',
        reasoning: 'User wants to archive',
      });
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        stepDefinition: makeStep({ automaticExecution: true }),
      });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(agentPort.executeAction).toHaveBeenCalledWith(
        { collection: 'customers', action: 'archive', id: [42] },
        expect.objectContaining({ id: 1 }),
      );
    });

    it('resolves action when AI returns technical name instead of displayName', async () => {
      const agentPort = makeMockAgentPort();
      // AI returns technical name 'archive' instead of display name 'Archive Customer'
      const mockModel = makeMockModel({
        actionName: 'archive',
        reasoning: 'fallback to technical name',
      });
      const schema = makeCollectionSchema({
        actions: [
          { name: 'archive', displayName: 'Archive Customer', endpoint: '/forest/actions/archive' },
        ],
      });
      const workflowPort = makeMockWorkflowPort({ customers: schema });
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        workflowPort,
        stepDefinition: makeStep({ automaticExecution: true }),
      });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(agentPort.executeAction).toHaveBeenCalledWith(
        { collection: 'customers', action: 'archive', id: [42] },
        expect.objectContaining({ id: 1 }),
      );
    });
  });

  describe('multi-record AI selection', () => {
    it('uses AI to select among multiple records then selects action', async () => {
      const baseRecordRef = makeRecordRef({ stepIndex: 1 });
      const relatedRecord = makeRecordRef({
        stepIndex: 2,
        recordId: [99],
        collectionName: 'orders',
      });

      const ordersSchema = makeCollectionSchema({
        collectionName: 'orders',
        collectionDisplayName: 'Orders',
        actions: [
          {
            name: 'cancel-order',
            displayName: 'Cancel Order',
            endpoint: '/forest/actions/cancel-order',
          },
        ],
      });

      // First call: select-record, second call: select-action
      const invoke = jest
        .fn()
        .mockResolvedValueOnce({
          tool_calls: [
            {
              name: 'select-record',
              args: { recordIdentifier: 'Step 2 - Orders #99' },
              id: 'call_1',
            },
          ],
        })
        .mockResolvedValueOnce({
          tool_calls: [
            {
              name: 'select-action',
              args: { actionName: 'Cancel Order', reasoning: 'Cancel the order' },
              id: 'call_2',
            },
          ],
        });
      const bindTools = jest.fn().mockReturnValue({ invoke });
      const model = { bindTools } as unknown as ExecutionContext['model'];

      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([
          {
            type: 'load-related-record',
            stepIndex: 2,
            executionResult: {
              relation: { name: 'order', displayName: 'Order' },
              record: relatedRecord,
            },
            selectedRecordRef: makeRecordRef(),
          },
        ]),
      });
      const workflowPort = makeMockWorkflowPort({
        customers: makeCollectionSchema(),
        orders: ordersSchema,
      });
      const agentPort = makeMockAgentPort();
      const context = makeContext({ baseRecordRef, model, runStore, workflowPort, agentPort });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('awaiting-input');
      expect(bindTools).toHaveBeenCalledTimes(2);

      const selectTool = bindTools.mock.calls[0][0][0];
      expect(selectTool.name).toBe('select-record');

      const actionTool = bindTools.mock.calls[1][0][0];
      expect(actionTool.name).toBe('select-action');

      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          pendingData: { displayName: 'Cancel Order', name: 'cancel-order' },
          selectedRecordRef: expect.objectContaining({
            recordId: [99],
            collectionName: 'orders',
          }),
        }),
      );
    });
  });

  describe('stepOutcome shape', () => {
    it('emits correct type, stepId and stepIndex in the outcome', async () => {
      const context = makeContext({ stepDefinition: makeStep({ automaticExecution: true }) });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome).toMatchObject({
        type: 'record',
        stepId: 'trigger-1',
        stepIndex: 0,
        status: 'success',
      });
    });
  });

  describe('schema caching', () => {
    it('fetches getCollectionSchema once per collection even when called twice (Branch B)', async () => {
      const workflowPort = makeMockWorkflowPort();
      const context = makeContext({
        workflowPort,
        stepDefinition: makeStep({ automaticExecution: true }),
      });
      const executor = new TriggerRecordActionStepExecutor(context);

      await executor.execute();

      expect(workflowPort.getCollectionSchema).toHaveBeenCalledTimes(1);
    });
  });

  describe('AI malformed/missing tool call', () => {
    it('returns error on malformed tool call', async () => {
      const invoke = jest.fn().mockResolvedValue({
        tool_calls: [],
        invalid_tool_calls: [
          { name: 'select-action', args: '{bad json', error: 'JSON parse error' },
        ],
      });
      const bindTools = jest.fn().mockReturnValue({ invoke });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: { bindTools } as unknown as ExecutionContext['model'],
        runStore,
      });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.type).toBe('record');
      expect(result.stepOutcome.stepId).toBe('trigger-1');
      expect(result.stepOutcome.stepIndex).toBe(0);
      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        "The AI returned an unexpected response. Try rephrasing the step's prompt.",
      );
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });

    it('returns error when AI returns no tool call', async () => {
      const invoke = jest.fn().mockResolvedValue({ tool_calls: [] });
      const bindTools = jest.fn().mockReturnValue({ invoke });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: { bindTools } as unknown as ExecutionContext['model'],
        runStore,
      });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.type).toBe('record');
      expect(result.stepOutcome.stepId).toBe('trigger-1');
      expect(result.stepOutcome.stepIndex).toBe(0);
      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        "The AI couldn't decide what to do. Try rephrasing the step's prompt.",
      );
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('RunStore error propagation', () => {
    it('returns error outcome when getStepExecutions fails (Branch A)', async () => {
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockRejectedValue(new Error('DB timeout')),
      });
      const context = makeContext({ runStore });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();
      expect(result.stepOutcome.status).toBe('error');
    });

    it('returns error outcome when saveStepExecution fails on user reject (Branch A)', async () => {
      const execution: TriggerRecordActionStepExecutionData = {
        type: 'trigger-action',
        stepIndex: 0,
        pendingData: {
          displayName: 'Send Welcome Email',
          name: 'send-welcome-email',
          userConfirmed: false,
        },
        selectedRecordRef: makeRecordRef(),
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
        saveStepExecution: jest.fn().mockRejectedValue(new Error('Disk full')),
      });
      const context = makeContext({ runStore });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();
      expect(result.stepOutcome.status).toBe('error');
    });

    it('returns error outcome when saveStepExecution fails saving awaiting-input (Branch C)', async () => {
      const runStore = makeMockRunStore({
        saveStepExecution: jest.fn().mockRejectedValue(new Error('Disk full')),
      });
      const context = makeContext({ runStore });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();
      expect(result.stepOutcome.status).toBe('error');
    });

    it('returns error outcome after successful executeAction when saveStepExecution fails (Branch B)', async () => {
      const runStore = makeMockRunStore({
        saveStepExecution: jest.fn().mockRejectedValue(new Error('Disk full')),
      });
      const context = makeContext({
        runStore,
        stepDefinition: makeStep({ automaticExecution: true }),
      });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe('The step result could not be saved. Please retry.');
    });

    it('returns error outcome after successful executeAction when saveStepExecution fails (Branch A confirmed)', async () => {
      const execution: TriggerRecordActionStepExecutionData = {
        type: 'trigger-action',
        stepIndex: 0,
        pendingData: {
          displayName: 'Send Welcome Email',
          name: 'send-welcome-email',
          userConfirmed: true,
        },
        selectedRecordRef: makeRecordRef(),
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
        saveStepExecution: jest.fn().mockRejectedValue(new Error('Disk full')),
      });
      const context = makeContext({ runStore });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe('The step result could not be saved. Please retry.');
    });
  });

  describe('default prompt', () => {
    it('uses default prompt when step.prompt is undefined', async () => {
      const mockModel = makeMockModel({
        actionName: 'Send Welcome Email',
        reasoning: 'test',
      });
      const context = makeContext({
        model: mockModel.model,
        stepDefinition: makeStep({ prompt: undefined }),
      });
      const executor = new TriggerRecordActionStepExecutor(context);

      await executor.execute();

      const messages = mockModel.invoke.mock.calls[mockModel.invoke.mock.calls.length - 1][0];
      const humanMessage = messages[messages.length - 1];
      expect(humanMessage.content).toBe('**Request**: Trigger the relevant action.');
    });
  });

  describe('previous steps context', () => {
    it('includes previous steps summary in select-action messages', async () => {
      const mockModel = makeMockModel({
        actionName: 'Send Welcome Email',
        reasoning: 'test',
      });
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([
          {
            type: 'condition',
            stepIndex: 0,
            executionParams: { answer: 'Yes', reasoning: 'Approved' },
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
              options: ['Yes', 'No'],
              prompt: 'Should we proceed?',
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
      const executor = new TriggerRecordActionStepExecutor({
        ...context,
        stepId: 'trigger-2',
        stepIndex: 1,
      });

      await executor.execute();

      const messages = mockModel.invoke.mock.calls[0][0];
      // previous steps message + system prompt + collection info + human message = 4
      expect(messages).toHaveLength(4);
      expect(messages[0].content).toContain('Should we proceed?');
      expect(messages[0].content).toContain('"answer":"Yes"');
      expect(messages[1].content).toContain('triggering an action');
    });
  });

  describe('pre-recorded args', () => {
    it('skips AI action selection when actionName is pre-recorded', async () => {
      const mockModel = makeMockModel();
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        runStore,
        stepDefinition: makeStep({
          automaticExecution: true,
          preRecordedArgs: { actionDisplayName: 'Send Welcome Email' },
        }),
      });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(mockModel.bindTools).not.toHaveBeenCalled();
      expect(context.agentPort.executeAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'send-welcome-email' }),
        context.user,
      );
    });

    it('still goes through awaiting-input when automaticExecution is false', async () => {
      const mockModel = makeMockModel();
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        runStore,
        stepDefinition: makeStep({
          preRecordedArgs: { actionDisplayName: 'Send Welcome Email' },
        }),
      });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('awaiting-input');
      expect(mockModel.bindTools).not.toHaveBeenCalled();
    });

    it('falls back to AI when no preRecordedArgs', async () => {
      const mockModel = makeMockModel({ actionName: 'Send Welcome Email', reasoning: 'r' });
      const context = makeContext({
        model: mockModel.model,
        stepDefinition: makeStep({ automaticExecution: true }),
      });
      const executor = new TriggerRecordActionStepExecutor(context);

      await executor.execute();

      expect(mockModel.bindTools).toHaveBeenCalledTimes(1);
    });
  });
});
