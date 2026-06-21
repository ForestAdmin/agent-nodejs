import type { ActivityLogPort } from '../../src/ports/activity-log-port';
import type { AgentPort } from '../../src/ports/agent-port';
import type { RunStore } from '../../src/ports/run-store';
import type { WorkflowPort } from '../../src/ports/workflow-port';
import type { ExecutionContext } from '../../src/types/execution-context';
import type { TriggerRecordActionStepExecutionData } from '../../src/types/step-execution-data';
import type { CollectionSchema, RecordRef } from '../../src/types/validated/collection';
import type { Step } from '../../src/types/validated/execution';
import type { TriggerActionStepDefinition } from '../../src/types/validated/step-definition';

import { AgentPortError, RunStorePortError, StepStateError } from '../../src/errors';
import ActivityLog from '../../src/executors/activity-log';
import AgentWithLog from '../../src/executors/agent-with-log';
import TriggerRecordActionStepExecutor from '../../src/executors/trigger-record-action-step-executor';
import SchemaCache from '../../src/schema-cache';
import SchemaResolver from '../../src/schema-resolver';
import { StepExecutionMode, StepType } from '../../src/types/validated/step-definition';

function makeStep(
  overrides: Partial<TriggerActionStepDefinition> = {},
): TriggerActionStepDefinition {
  return {
    type: StepType.TriggerAction,
    executionType: StepExecutionMode.AutomatedWithConfirmation,
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
    getActionFormInfo: jest.fn().mockResolvedValue({ hasForm: false }),
    // Default: a formless action (no fields) — matches the pre-PRD-511 behavior of most tests.
    getActionForm: jest
      .fn()
      .mockResolvedValue({ fields: [], canExecute: true, requiredFields: [], skippedFields: [] }),
  } as unknown as AgentPort;
}

function makeCollectionSchema(overrides: Partial<CollectionSchema> = {}): CollectionSchema {
  return {
    collectionName: 'customers',
    collectionId: 'col-customers',
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
    getAvailableRuns: jest.fn().mockResolvedValue({ pending: [], malformed: [] }),
    getAvailableRun: jest.fn().mockResolvedValue(null),
    updateStepExecution: jest.fn().mockResolvedValue(undefined),
    getCollectionSchema: jest
      .fn()
      .mockImplementation((name: string) =>
        Promise.resolve(
          schemasByCollection[name] ?? makeCollectionSchema({ collectionName: name }),
        ),
      ),
    getMcpServerConfigs: jest.fn().mockResolvedValue({}),
    hasRunAccess: jest.fn().mockResolvedValue(true),
    reportExecutorMetadata: jest.fn().mockResolvedValue(undefined),
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
  overrides: Partial<ExecutionContext<TriggerActionStepDefinition>> & {
    agentPort?: AgentPort;
    activityLogPort?: ActivityLogPort;
    activityLog?: ActivityLog;
    workflowPort?: WorkflowPort;
  } = {},
): ExecutionContext<TriggerActionStepDefinition> {
  const runId = overrides.runId ?? 'run-1';
  const workflowPort = overrides.workflowPort ?? makeMockWorkflowPort();
  const schemaCache = new SchemaCache();

  const base: Omit<ExecutionContext<TriggerActionStepDefinition>, 'agent' | 'activityLog'> = {
    runId,
    stepId: 'trigger-1',
    stepIndex: 0,
    collectionId: 'col-1',
    baseRecordRef: makeRecordRef(),
    stepDefinition: makeStep(),
    model: makeMockModel({
      actionName: 'Send Welcome Email',
      reasoning: 'User requested welcome email',
    }).model,
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
        agentPort: overrides.agentPort ?? makeMockAgentPort(),
        schemaResolver: base.schemaResolver,
        user: base.user,
        activityLog,
      }),
  };
}

function makeLoadRelatedPreviousStep(stepIndex: number, originalStepIndex?: number): Step {
  return {
    stepDefinition: {
      type: StepType.LoadRelatedRecord,
      executionType: StepExecutionMode.FullyAutomated,
      prompt: 'Load the order',
    },
    stepOutcome: {
      type: 'record',
      stepId: `load-${stepIndex}`,
      stepIndex,
      status: 'success',
    },
    ...(originalStepIndex !== undefined && { originalStepIndex }),
  };
}

describe('TriggerRecordActionStepExecutor', () => {
  describe('executionType=FullyAutomated: trigger direct (Branch B)', () => {
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
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
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

  describe('operation activity log (PRD-442 #1)', () => {
    it('logs the action against the acted record and its collection, not the trigger', async () => {
      const agentPort = makeMockAgentPort();
      (agentPort.executeAction as jest.Mock).mockResolvedValue({ ok: true });
      const activityLogPort = {
        createPending: jest.fn().mockResolvedValue({ id: 'log-1', index: '0' }),
        markSucceeded: jest.fn().mockResolvedValue(undefined),
        markFailed: jest.fn().mockResolvedValue(undefined),
      };
      const context = makeContext({
        agentPort,
        activityLogPort,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });

      await new TriggerRecordActionStepExecutor(context).execute();

      expect(activityLogPort.createPending).toHaveBeenCalledWith({
        renderingId: 1,
        action: 'action',
        type: 'write',
        collectionId: 'col-customers',
        recordId: [42],
        label: 'triggered the action "send-welcome-email"',
      });
    });

    it('logs against a related record in another collection (cross-collection)', async () => {
      const baseRecordRef = makeRecordRef({ stepIndex: 1 });
      const relatedRecord = makeRecordRef({
        stepIndex: 2,
        recordId: [99],
        collectionName: 'orders',
      });
      const ordersSchema = makeCollectionSchema({
        collectionName: 'orders',
        collectionId: 'col-orders',
        collectionDisplayName: 'Orders',
        actions: [
          {
            name: 'cancel-order',
            displayName: 'Cancel Order',
            endpoint: '/forest/actions/cancel-order',
          },
        ],
      });

      const invoke = jest
        .fn()
        .mockResolvedValueOnce({
          tool_calls: [
            { name: 'select-record', args: { recordIdentifier: 'Step 2 - Orders #99' }, id: 'c1' },
          ],
        })
        .mockResolvedValueOnce({
          tool_calls: [
            {
              name: 'select-action',
              args: { actionName: 'Cancel Order', reasoning: 'r' },
              id: 'c2',
            },
          ],
        });
      const model = {
        bindTools: jest.fn().mockReturnValue({ invoke }),
      } as unknown as ExecutionContext['model'];

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
      const agentPort = makeMockAgentPort();
      (agentPort.executeAction as jest.Mock).mockResolvedValue({ ok: true });
      const activityLogPort = {
        createPending: jest.fn().mockResolvedValue({ id: 'log-1', index: '0' }),
        markSucceeded: jest.fn().mockResolvedValue(undefined),
        markFailed: jest.fn().mockResolvedValue(undefined),
      };
      const context = makeContext({
        baseRecordRef,
        model,
        runStore,
        agentPort,
        activityLogPort,
        workflowPort: makeMockWorkflowPort({
          customers: makeCollectionSchema(),
          orders: ordersSchema,
        }),
        previousSteps: [makeLoadRelatedPreviousStep(2)],
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });

      await new TriggerRecordActionStepExecutor(context).execute();

      expect(activityLogPort.createPending).toHaveBeenCalledWith({
        renderingId: 1,
        action: 'action',
        type: 'write',
        collectionId: 'col-orders',
        recordId: [99],
        label: 'triggered the action "cancel-order"',
      });
    });
  });

  describe('without executionType=FullyAutomated: awaiting-input (Branch C)', () => {
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

    it('does NOT create an activity log (the frontend logs on its side)', async () => {
      const mockModel = makeMockModel({
        actionName: 'Send Welcome Email',
        reasoning: 'User requested welcome email',
      });
      const activityLogPort = {
        createPending: jest.fn().mockResolvedValue({ id: 'log-1', index: '0' }),
        markSucceeded: jest.fn().mockResolvedValue(undefined),
        markFailed: jest.fn().mockResolvedValue(undefined),
      };
      const context = makeContext({
        model: mockModel.model,
        activityLogPort,
        stepDefinition: makeStep({
          executionType: StepExecutionMode.AutomatedWithConfirmation,
        }),
      });
      const executor = new TriggerRecordActionStepExecutor(context);

      await executor.execute();

      expect(activityLogPort.createPending).not.toHaveBeenCalled();
      expect(activityLogPort.markSucceeded).not.toHaveBeenCalled();
      expect(activityLogPort.markFailed).not.toHaveBeenCalled();
    });
  });

  describe('confirmation accepted (Branch A)', () => {
    it('saves the frontend-provided actionResult without re-executing the action', async () => {
      const agentPort = makeMockAgentPort();
      const execution: TriggerRecordActionStepExecutionData = {
        type: 'trigger-action',
        stepIndex: 0,
        pendingData: {
          displayName: 'Send Welcome Email',
          name: 'send-welcome-email',
        },
        userConfirmation: {
          userConfirmed: true,
          actionResult: { success: 'ok', html: '<p>Email queued</p>' },
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
      expect(agentPort.getActionFormInfo).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          type: 'trigger-action',
          executionParams: {
            displayName: 'Send Welcome Email',
            name: 'send-welcome-email',
          },
          executionResult: {
            success: true,
            actionResult: { success: 'ok', html: '<p>Email queued</p>' },
            submissionOutcome: 'executed',
          },
          pendingData: {
            displayName: 'Send Welcome Email',
            name: 'send-welcome-email',
          },
        }),
      );
    });

    it('persists actionResult:null as a legitimate void-action result', async () => {
      const agentPort = makeMockAgentPort();
      const execution: TriggerRecordActionStepExecutionData = {
        type: 'trigger-action',
        stepIndex: 0,
        pendingData: {
          displayName: 'Send Welcome Email',
          name: 'send-welcome-email',
        },
        userConfirmation: {
          userConfirmed: true,
          actionResult: null,
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
          executionResult: { success: true, actionResult: null, submissionOutcome: 'executed' },
        }),
      );
    });

    it('returns error when the frontend confirmed without providing actionResult', async () => {
      const agentPort = makeMockAgentPort();
      const execution: TriggerRecordActionStepExecutionData = {
        type: 'trigger-action',
        stepIndex: 0,
        pendingData: {
          displayName: 'Send Welcome Email',
          name: 'send-welcome-email',
        },
        userConfirmation: { userConfirmed: true },
        selectedRecordRef: makeRecordRef(),
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const context = makeContext({ agentPort, runStore });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'An unexpected error occurred while processing this step.',
      );
      expect(agentPort.executeAction).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
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
        userConfirmation: { userConfirmed: false },
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

  describe('UnsupportedActionFormError (form detection)', () => {
    it('throws when the action has a form and executionType is FullyAutomated (PRD-512 not yet)', async () => {
      const agentPort = makeMockAgentPort();
      (agentPort.getActionForm as jest.Mock).mockResolvedValue({
        fields: [{ name: 'reason', type: 'String', isRequired: true }],
        canExecute: false,
        requiredFields: ['reason'],
        skippedFields: [],
      });
      const mockModel = makeMockModel({
        actionName: 'Send Welcome Email',
        reasoning: 'r',
      });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        runStore,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'This action requires user input via a form, which is not yet supported in workflows.',
      );
      // Form detection uses the resolved technical name, not the AI display name —
      // passing "Send Welcome Email" would 404 against the agent.
      expect(agentPort.getActionForm).toHaveBeenCalledWith(
        { collection: 'customers', action: 'send-welcome-email', id: [42] },
        expect.objectContaining({ id: 1 }),
      );
      expect(agentPort.executeAction).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });

    it('supports form-bearing actions when executionType is not FullyAutomated (frontend handles the form)', async () => {
      const agentPort = makeMockAgentPort();
      // hasForm would return true if called — but it should not be called in this branch.
      (agentPort.getActionFormInfo as jest.Mock).mockResolvedValue({ hasForm: true });
      const mockModel = makeMockModel({
        actionName: 'Send Welcome Email',
        reasoning: 'r',
      });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        runStore,
      });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('awaiting-input');
      // Form check is skipped when not automatic — the frontend will handle the form.
      expect(agentPort.getActionFormInfo).not.toHaveBeenCalled();
      expect(agentPort.executeAction).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          type: 'trigger-action',
          pendingData: { displayName: 'Send Welcome Email', name: 'send-welcome-email' },
        }),
      );
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
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
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
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
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
      expect(runStore.saveStepExecution).toHaveBeenCalledTimes(1);
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({ idempotencyPhase: 'executing' }),
      );
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
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();
      expect(result.stepOutcome.status).toBe('error');
    });

    it('returns user message and logs cause when agentPort.executeAction throws an infra error', async () => {
      const logger = jest.fn();
      const agentPort = makeMockAgentPort();
      (agentPort.executeAction as jest.Mock).mockRejectedValue(
        new AgentPortError('executeAction', new Error('DB connection lost')),
      );
      const mockModel = makeMockModel({
        actionName: 'Send Welcome Email',
        reasoning: 'User requested welcome email',
      });
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        logger,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'An error occurred while accessing your data. Please try again.',
      );
      expect(logger).toHaveBeenCalledWith(
        'Error',
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
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
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
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
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
      const context = makeContext({
        baseRecordRef,
        model,
        runStore,
        workflowPort,
        agentPort,
        previousSteps: [makeLoadRelatedPreviousStep(2)],
      });
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
      const context = makeContext({
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
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
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
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
        },
        userConfirmation: { userConfirmed: false },
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
        saveStepExecution: jest
          .fn()
          .mockRejectedValue(new RunStorePortError('saveStepExecution', new Error('Disk full'))),
      });
      const context = makeContext({
        runStore,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe('The step state could not be accessed. Please retry.');
    });

    it('returns error outcome when saveStepExecution fails saving the frontend result (Branch A confirmed)', async () => {
      const execution: TriggerRecordActionStepExecutionData = {
        type: 'trigger-action',
        stepIndex: 0,
        pendingData: {
          displayName: 'Send Welcome Email',
          name: 'send-welcome-email',
        },
        userConfirmation: {
          userConfirmed: true,
          actionResult: { success: 'ok' },
        },
        selectedRecordRef: makeRecordRef(),
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
        saveStepExecution: jest
          .fn()
          .mockRejectedValue(new RunStorePortError('saveStepExecution', new Error('Disk full'))),
      });
      const context = makeContext({ runStore });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe('The step state could not be accessed. Please retry.');
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
              executionType: StepExecutionMode.FullyAutomated,
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
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toContain('Step executed by');
      expect(messages[0].content).toContain('Should we proceed?');
      expect(messages[0].content).toContain('"answer":"Yes"');
      expect(messages[0].content).toContain('triggering an action');
    });
  });

  describe('pre-recorded args', () => {
    it('skips AI action selection when actionName is pre-recorded', async () => {
      const mockModel = makeMockModel();
      const runStore = makeMockRunStore();
      const agentPort = makeMockAgentPort();
      const context = makeContext({
        model: mockModel.model,
        runStore,
        agentPort,
        stepDefinition: makeStep({
          executionType: StepExecutionMode.FullyAutomated,
          preRecordedArgs: { actionName: 'send-welcome-email' },
        }),
      });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(mockModel.bindTools).not.toHaveBeenCalled();
      expect(agentPort.executeAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'send-welcome-email' }),
        context.user,
      );
      // Pre-recorded reference is the technical name; the persisted displayName is resolved
      // from the schema, not received on the wire.
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionParams: { displayName: 'Send Welcome Email', name: 'send-welcome-email' },
        }),
      );
    });

    it('still goes through awaiting-input when executionType is not FullyAutomated', async () => {
      const mockModel = makeMockModel();
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        runStore,
        stepDefinition: makeStep({
          preRecordedArgs: { actionName: 'send-welcome-email' },
        }),
      });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('awaiting-input');
      expect(mockModel.bindTools).not.toHaveBeenCalled();
      // displayName is resolved from the schema even though only the technical name was sent.
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          pendingData: { displayName: 'Send Welcome Email', name: 'send-welcome-email' },
        }),
      );
    });

    it('returns error when a pre-recorded actionName does not resolve', async () => {
      const context = makeContext({
        stepDefinition: makeStep({
          executionType: StepExecutionMode.FullyAutomated,
          preRecordedArgs: { actionName: 'does-not-exist' },
        }),
      });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
    });

    it('resolves a pre-recorded technical actionName to its own action, not another whose displayName collides', async () => {
      const runStore = makeMockRunStore();
      // Action B's displayName ('archive') equals action A's technical name ('archive').
      const workflowPort = makeMockWorkflowPort({
        customers: makeCollectionSchema({
          actions: [
            {
              name: 'archive',
              displayName: 'Send Welcome Email',
              endpoint: '/forest/actions/archive',
            },
            { name: 'send', displayName: 'archive', endpoint: '/forest/actions/send' },
          ],
        }),
      });
      const agentPort = makeMockAgentPort();
      const context = makeContext({
        runStore,
        workflowPort,
        agentPort,
        stepDefinition: makeStep({
          executionType: StepExecutionMode.FullyAutomated,
          preRecordedArgs: { actionName: 'archive' },
        }),
      });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      // Triggers action A ('archive'), not action B ('send' / displayName 'archive').
      expect(agentPort.executeAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'archive' }),
        context.user,
      );
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionParams: { displayName: 'Send Welcome Email', name: 'archive' },
        }),
      );
    });

    it('Manual mode on a form action pauses WITHOUT any AI pre-fill (PRD-511)', async () => {
      const agentPort = makeMockAgentPort();
      (agentPort.getActionForm as jest.Mock).mockResolvedValue({
        fields: [{ name: 'reason', type: 'String', isRequired: true }],
        canExecute: false,
        requiredFields: ['reason'],
        skippedFields: [],
      });
      const mockModel = makeMockModel();
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        runStore,
        stepDefinition: makeStep({
          executionType: StepExecutionMode.Manual,
          preRecordedArgs: {
            selectedRecordStepId: 'workflow-start',
            actionName: 'send-welcome-email',
          },
        }),
      });

      const result = await new TriggerRecordActionStepExecutor(context).execute();

      expect(result.stepOutcome.status).toBe('awaiting-input');
      // Manual = no AI involvement at all.
      expect(mockModel.bindTools).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          pendingData: expect.objectContaining({
            form: {
              fields: [{ name: 'reason', type: 'String', isRequired: true }],
              aiFilledValues: [],
            },
          }),
        }),
      );
    });

    it('AI-assisted mode pre-fills the form (ordered) and pauses for review (PRD-511)', async () => {
      const agentPort = makeMockAgentPort();
      (agentPort.getActionForm as jest.Mock).mockResolvedValue({
        fields: [
          { name: 'amount', type: 'Number', isRequired: true },
          { name: 'reason', type: 'String', isRequired: false },
        ],
        canExecute: true,
        requiredFields: [],
        skippedFields: [],
      });
      // AI fills amount but leaves `reason` out (no context) — must stay empty.
      const mockModel = makeMockModel({ values: { amount: 50 } }, 'fill_action_form');
      const runStore = makeMockRunStore();
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        runStore,
        stepDefinition: makeStep({
          executionType: StepExecutionMode.AutomatedWithConfirmation,
          preRecordedArgs: {
            selectedRecordStepId: 'workflow-start',
            actionName: 'send-welcome-email',
          },
        }),
      });

      const result = await new TriggerRecordActionStepExecutor(context).execute();

      expect(result.stepOutcome.status).toBe('awaiting-input');
      expect(mockModel.bindTools).toHaveBeenCalled();
      expect(agentPort.executeAction).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          pendingData: expect.objectContaining({
            form: expect.objectContaining({ aiFilledValues: [{ field: 'amount', value: 50 }] }),
          }),
        }),
      );
    });

    it('persists a pending-approval submission without an actionResult (PRD-511/520)', async () => {
      const agentPort = makeMockAgentPort();
      const execution: TriggerRecordActionStepExecutionData = {
        type: 'trigger-action',
        stepIndex: 0,
        pendingData: {
          displayName: 'Process Refund',
          name: 'process-refund',
          form: { fields: [], aiFilledValues: [{ field: 'amount', value: 50 }] },
        },
        userConfirmation: {
          userConfirmed: true,
          submissionOutcome: 'pending-approval',
          submittedValues: { amount: 50 },
        },
        selectedRecordRef: makeRecordRef(),
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const context = makeContext({ agentPort, runStore });

      const result = await new TriggerRecordActionStepExecutor(context).execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(agentPort.executeAction).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionResult: {
            success: true,
            submissionOutcome: 'pending-approval',
            submittedValues: { amount: 50 },
            aiFilledValues: [{ field: 'amount', value: 50 }],
          },
        }),
      );
    });

    it('falls back to AI when no preRecordedArgs', async () => {
      const mockModel = makeMockModel({ actionName: 'Send Welcome Email', reasoning: 'r' });
      const context = makeContext({
        model: mockModel.model,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
      const executor = new TriggerRecordActionStepExecutor(context);

      await executor.execute();

      expect(mockModel.bindTools).toHaveBeenCalledTimes(1);
    });

    it('pins the source record from selectedRecordStepId=workflow-start without AI (PRD-469)', async () => {
      const mockModel = makeMockModel();
      const agentPort = makeMockAgentPort();
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        stepDefinition: makeStep({
          executionType: StepExecutionMode.FullyAutomated,
          preRecordedArgs: {
            selectedRecordStepId: 'workflow-start',
            actionName: 'send-welcome-email',
          },
        }),
      });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      // Neither record nor action selection invoked the AI.
      expect(mockModel.bindTools).not.toHaveBeenCalled();
      // Action runs on the workflow-start (base) record, recordId [42].
      expect(agentPort.executeAction).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'customers',
          action: 'send-welcome-email',
          id: [42],
        }),
        context.user,
      );
    });

    it('errors when the pinned source step (a Load Related Record) loaded no record (PRD-469)', async () => {
      const agentPort = makeMockAgentPort();
      // The source Load Related Record step is on the live path but has no execution record stored
      // (it loaded nothing) → SourceRecordMissingError, no action triggered.
      const runStore = makeMockRunStore({ getStepExecutions: jest.fn().mockResolvedValue([]) });
      const context = makeContext({
        agentPort,
        runStore,
        previousSteps: [makeLoadRelatedPreviousStep(2)],
        stepDefinition: makeStep({
          executionType: StepExecutionMode.FullyAutomated,
          preRecordedArgs: { selectedRecordStepId: 'load-2', actionName: 'send-welcome-email' },
        }),
      });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toContain("didn't load any record");
      expect(agentPort.executeAction).not.toHaveBeenCalled();
    });
  });

  describe('idempotency', () => {
    it('returns success without re-executing or emitting activity log when idempotencyPhase is done', async () => {
      const agentPort = makeMockAgentPort();
      const activityLogPort = {
        createPending: jest.fn().mockResolvedValue({ id: 'log-1', index: '0' }),
        markSucceeded: jest.fn().mockResolvedValue(undefined),
        markFailed: jest.fn().mockResolvedValue(undefined),
      };
      const doneExecution: TriggerRecordActionStepExecutionData = {
        type: 'trigger-action',
        stepIndex: 0,
        executionParams: { displayName: 'Send Welcome Email', name: 'send-welcome-email' },
        executionResult: { success: true, actionResult: undefined },
        selectedRecordRef: makeRecordRef(),
        idempotencyPhase: 'done',
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([doneExecution]),
      });
      const context = makeContext({ agentPort, runStore, activityLogPort });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(agentPort.executeAction).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
      expect(activityLogPort.createPending).not.toHaveBeenCalled();
    });

    it('returns error without activity log when idempotencyPhase is executing', async () => {
      const agentPort = makeMockAgentPort();
      const activityLogPort = {
        createPending: jest.fn().mockResolvedValue({ id: 'log-1', index: '0' }),
        markSucceeded: jest.fn().mockResolvedValue(undefined),
        markFailed: jest.fn().mockResolvedValue(undefined),
      };
      const executingExecution: TriggerRecordActionStepExecutionData = {
        type: 'trigger-action',
        stepIndex: 0,
        selectedRecordRef: makeRecordRef(),
        idempotencyPhase: 'executing',
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([executingExecution]),
      });
      const context = makeContext({ agentPort, runStore, activityLogPort });
      const executor = new TriggerRecordActionStepExecutor(context);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'An unexpected error occurred while processing this step.',
      );
      expect(agentPort.executeAction).not.toHaveBeenCalled();
      expect(activityLogPort.createPending).not.toHaveBeenCalled();
    });

    it('saves executing marker before side effect and done marker with executionResult after', async () => {
      const agentPort = makeMockAgentPort();
      const runStore = makeMockRunStore();
      const mockModel = makeMockModel({
        actionName: 'Send Welcome Email',
        reasoning: 'test',
      });
      const context = makeContext({
        model: mockModel.model,
        agentPort,
        runStore,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
      const executor = new TriggerRecordActionStepExecutor(context);

      await executor.execute();

      const { calls } = (runStore.saveStepExecution as jest.Mock).mock;
      expect(calls).toHaveLength(2);
      expect(calls[0][1]).toMatchObject({
        type: 'trigger-action',
        stepIndex: 0,
        idempotencyPhase: 'executing',
      });
      expect(calls[0][1]).not.toHaveProperty('executionResult');
      expect(calls[1][1]).toMatchObject({
        type: 'trigger-action',
        stepIndex: 0,
        idempotencyPhase: 'done',
        executionResult: { success: true },
      });
    });
  });
});
