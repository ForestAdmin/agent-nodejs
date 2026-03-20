import type { AgentPort } from '../../src/ports/agent-port';
import type { RunStore } from '../../src/ports/run-store';
import type { WorkflowPort } from '../../src/ports/workflow-port';
import type { ExecutionContext } from '../../src/types/execution';
import type { CollectionSchema, RecordRef } from '../../src/types/record';
import type { RecordTaskStepDefinition } from '../../src/types/step-definition';
import type { TriggerRecordActionStepExecutionData } from '../../src/types/step-execution-data';

import { WorkflowExecutorError } from '../../src/errors';
import TriggerRecordActionStepExecutor from '../../src/executors/trigger-record-action-step-executor';
import { StepType } from '../../src/types/step-definition';

function makeStep(overrides: Partial<RecordTaskStepDefinition> = {}): RecordTaskStepDefinition {
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
      { name: 'send-welcome-email', displayName: 'Send Welcome Email' },
      { name: 'archive', displayName: 'Archive Customer' },
    ],
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

function makeMockWorkflowPort(
  schemasByCollection: Record<string, CollectionSchema> = {
    customers: makeCollectionSchema(),
  },
): WorkflowPort {
  return {
    getPendingStepExecutions: jest.fn().mockResolvedValue([]),
    updateStepExecution: jest.fn().mockResolvedValue(undefined),
    getCollectionSchema: jest
      .fn()
      .mockImplementation((name: string) =>
        Promise.resolve(
          schemasByCollection[name] ?? makeCollectionSchema({ collectionName: name }),
        ),
      ),
    getMcpServerConfigs: jest.fn().mockResolvedValue([]),
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
  overrides: Partial<ExecutionContext<RecordTaskStepDefinition>> = {},
): ExecutionContext<RecordTaskStepDefinition> {
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
    previousSteps: [],
    remoteTools: [],
    ...overrides,
  };
}

describe('TriggerRecordActionStepExecutor', () => {
  describe('automaticExecution: trigger direct (Branch B)', () => {
    it('triggers the action and returns success', async () => {
      const agentPort = makeMockAgentPort();
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
      expect(agentPort.executeAction).toHaveBeenCalledWith('customers', 'send-welcome-email', [
        [42],
      ]);
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          type: 'trigger-action',
          stepIndex: 0,
          executionParams: {
            displayName: 'Send Welcome Email',
            name: 'send-welcome-email',
          },
          executionResult: { success: true },
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
      const execution: TriggerRecordActionStepExecutionData = {
        type: 'trigger-action',
        stepIndex: 0,
        pendingData: {
          displayName: 'Send Welcome Email',
          name: 'send-welcome-email',
        },
        selectedRecordRef: makeRecordRef(),
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const userConfirmed = true;
      const context = makeContext({ agentPort, runStore, userConfirmed });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(agentPort.executeAction).toHaveBeenCalledWith('customers', 'send-welcome-email', [
        [42],
      ]);
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          type: 'trigger-action',
          executionParams: {
            displayName: 'Send Welcome Email',
            name: 'send-welcome-email',
          },
          executionResult: { success: true },
          pendingData: {
            displayName: 'Send Welcome Email',
            name: 'send-welcome-email',
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
        },
        selectedRecordRef: makeRecordRef(),
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const userConfirmed = false;
      const context = makeContext({ agentPort, runStore, userConfirmed });
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
          },
        }),
      );
    });
  });

  describe('no pending action in confirmation flow (Branch A)', () => {
    it('returns error outcome when no pending action is found', async () => {
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([]),
      });
      const userConfirmed = true;
      const context = makeContext({ runStore, userConfirmed });
      const executor = new TriggerRecordActionStepExecutor(context);

      await expect(executor.execute()).resolves.toMatchObject({
        stepOutcome: {
          type: 'record-task',
          stepId: 'trigger-1',
          stepIndex: 0,
          status: 'error',
          error: 'No execution record found for step at index 0',
        },
      });
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });

    it('returns error outcome when execution exists but stepIndex does not match', async () => {
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
      const userConfirmed = true;
      const context = makeContext({ runStore, userConfirmed });
      const executor = new TriggerRecordActionStepExecutor(context);

      await expect(executor.execute()).resolves.toMatchObject({
        stepOutcome: {
          type: 'record-task',
          stepId: 'trigger-1',
          stepIndex: 0,
          status: 'error',
          error: 'No execution record found for step at index 0',
        },
      });
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
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
      const userConfirmed = true;
      const context = makeContext({ runStore, userConfirmed });
      const executor = new TriggerRecordActionStepExecutor(context);

      await expect(executor.execute()).resolves.toMatchObject({
        stepOutcome: {
          type: 'record-task',
          stepId: 'trigger-1',
          stepIndex: 0,
          status: 'error',
          error: 'Step at index 0 has no pending data',
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
      expect(result.stepOutcome.error).toBe('No actions available on collection "customers"');
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
        actions: [{ name: 'archive', displayName: 'Archive Customer' }],
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
        'Action "NonExistentAction" not found in collection "customers"',
      );
      expect(agentPort.executeAction).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('agentPort.executeAction WorkflowExecutorError (Branch B)', () => {
    it('returns error when executeAction throws WorkflowExecutorError', async () => {
      const agentPort = makeMockAgentPort();
      (agentPort.executeAction as jest.Mock).mockRejectedValue(
        new WorkflowExecutorError('Action not permitted'),
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

      expect(result.stepOutcome.type).toBe('record-task');
      expect(result.stepOutcome.stepId).toBe('trigger-1');
      expect(result.stepOutcome.stepIndex).toBe(0);
      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe('Action not permitted');
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('agentPort.executeAction WorkflowExecutorError (Branch A)', () => {
    it('returns error when executeAction throws WorkflowExecutorError during confirmation', async () => {
      const agentPort = makeMockAgentPort();
      (agentPort.executeAction as jest.Mock).mockRejectedValue(
        new WorkflowExecutorError('Action not permitted'),
      );
      const execution: TriggerRecordActionStepExecutionData = {
        type: 'trigger-action',
        stepIndex: 0,
        pendingData: {
          displayName: 'Send Welcome Email',
          name: 'send-welcome-email',
        },
        selectedRecordRef: makeRecordRef(),
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const userConfirmed = true;
      const context = makeContext({ agentPort, runStore, userConfirmed });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.type).toBe('record-task');
      expect(result.stepOutcome.stepId).toBe('trigger-1');
      expect(result.stepOutcome.stepIndex).toBe(0);
      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe('Action not permitted');
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('agentPort.executeAction infra error', () => {
    it('lets infrastructure errors propagate (Branch B)', async () => {
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

      await expect(executor.execute()).rejects.toThrow('Connection refused');
    });

    it('lets infrastructure errors propagate (Branch A)', async () => {
      const agentPort = makeMockAgentPort();
      (agentPort.executeAction as jest.Mock).mockRejectedValue(new Error('Connection refused'));
      const execution: TriggerRecordActionStepExecutionData = {
        type: 'trigger-action',
        stepIndex: 0,
        pendingData: {
          displayName: 'Send Welcome Email',
          name: 'send-welcome-email',
        },
        selectedRecordRef: makeRecordRef(),
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const userConfirmed = true;
      const context = makeContext({ agentPort, runStore, userConfirmed });
      const executor = new TriggerRecordActionStepExecutor(context);

      await expect(executor.execute()).rejects.toThrow('Connection refused');
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
      expect(agentPort.executeAction).toHaveBeenCalledWith('customers', 'archive', [[42]]);
    });

    it('resolves action when AI returns technical name instead of displayName', async () => {
      const agentPort = makeMockAgentPort();
      // AI returns technical name 'archive' instead of display name 'Archive Customer'
      const mockModel = makeMockModel({
        actionName: 'archive',
        reasoning: 'fallback to technical name',
      });
      const schema = makeCollectionSchema({
        actions: [{ name: 'archive', displayName: 'Archive Customer' }],
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
      expect(agentPort.executeAction).toHaveBeenCalledWith('customers', 'archive', [[42]]);
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
        actions: [{ name: 'cancel-order', displayName: 'Cancel Order' }],
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
        getStepExecutions: jest
          .fn()
          .mockResolvedValue([
            { type: 'load-related-record', stepIndex: 2, record: relatedRecord },
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
        type: 'record-task',
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

      expect(result.stepOutcome.type).toBe('record-task');
      expect(result.stepOutcome.stepId).toBe('trigger-1');
      expect(result.stepOutcome.stepIndex).toBe(0);
      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'AI returned a malformed tool call for "select-action": JSON parse error',
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

      expect(result.stepOutcome.type).toBe('record-task');
      expect(result.stepOutcome.stepId).toBe('trigger-1');
      expect(result.stepOutcome.stepIndex).toBe(0);
      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe('AI did not return a tool call');
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('RunStore error propagation', () => {
    it('lets getStepExecutions errors propagate (Branch A)', async () => {
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockRejectedValue(new Error('DB timeout')),
      });
      const userConfirmed = true;
      const context = makeContext({ runStore, userConfirmed });
      const executor = new TriggerRecordActionStepExecutor(context);

      await expect(executor.execute()).rejects.toThrow('DB timeout');
    });

    it('lets saveStepExecution errors propagate when user rejects (Branch A)', async () => {
      const execution: TriggerRecordActionStepExecutionData = {
        type: 'trigger-action',
        stepIndex: 0,
        pendingData: {
          displayName: 'Send Welcome Email',
          name: 'send-welcome-email',
        },
        selectedRecordRef: makeRecordRef(),
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
        saveStepExecution: jest.fn().mockRejectedValue(new Error('Disk full')),
      });
      const userConfirmed = false;
      const context = makeContext({ runStore, userConfirmed });
      const executor = new TriggerRecordActionStepExecutor(context);

      await expect(executor.execute()).rejects.toThrow('Disk full');
    });

    it('lets saveStepExecution errors propagate when saving awaiting-input (Branch C)', async () => {
      const runStore = makeMockRunStore({
        saveStepExecution: jest.fn().mockRejectedValue(new Error('Disk full')),
      });
      const context = makeContext({ runStore });
      const executor = new TriggerRecordActionStepExecutor(context);

      await expect(executor.execute()).rejects.toThrow('Disk full');
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
      expect(result.stepOutcome.error).toContain(
        'Action "send-welcome-email" executed but step state could not be persisted',
      );
    });

    it('returns error outcome after successful executeAction when saveStepExecution fails (Branch A confirmed)', async () => {
      const execution: TriggerRecordActionStepExecutionData = {
        type: 'trigger-action',
        stepIndex: 0,
        pendingData: {
          displayName: 'Send Welcome Email',
          name: 'send-welcome-email',
        },
        selectedRecordRef: makeRecordRef(),
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
        saveStepExecution: jest.fn().mockRejectedValue(new Error('Disk full')),
      });
      const userConfirmed = true;
      const context = makeContext({ runStore, userConfirmed });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toContain(
        'Action "send-welcome-email" executed but step state could not be persisted',
      );
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
});
