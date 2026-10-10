import type { ActivityLogPort } from '../../src/ports/activity-log-port';
import type { AgentPort } from '../../src/ports/agent-port';
import type { RunStore } from '../../src/ports/run-store';
import type { WorkflowPort } from '../../src/ports/workflow-port';
import type { ExecutionContext } from '../../src/types/execution-context';
import type { McpStepExecutionData } from '../../src/types/step-execution-data';
import type { McpStepDefinition } from '../../src/types/validated/step-definition';

import RemoteTool from '@forestadmin/ai-proxy/src/remote-tool';

import { OAuthReauthRequiredError, RunStorePortError, StepStateError } from '../../src/errors';
import ActivityLog from '../../src/executors/activity-log';
import AgentWithLog from '../../src/executors/agent-with-log';
import McpStepExecutor from '../../src/executors/mcp-step-executor';
import SchemaCache from '../../src/schema-cache';
import SchemaResolver from '../../src/schema-resolver';
import InMemoryStore from '../../src/stores/in-memory-store';
import { StepExecutionMode, StepType } from '../../src/types/validated/step-definition';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

class MockRemoteTool extends RemoteTool {
  constructor(options: {
    name: string;
    sourceId?: string;
    mcpServerId?: string;
    invoke?: jest.Mock;
  }) {
    const invokeFn = options.invoke ?? jest.fn().mockResolvedValue('tool-result');
    super({
      tool: {
        name: options.name,
        description: `${options.name} description`,
        schema: { parse: jest.fn(), _def: {} } as unknown as RemoteTool['base']['schema'],
        invoke: invokeFn,
      } as unknown as RemoteTool['base'],
      sourceId: options.sourceId ?? 'mcp-server-1',
      sourceType: 'mcp',
      mcpServerId: options.mcpServerId,
    });
  }
}

function makeStep(overrides: Partial<McpStepDefinition> = {}): McpStepDefinition {
  return {
    type: StepType.Mcp,
    prompt: 'Send a notification to the user',
    executionType: StepExecutionMode.AutomatedWithConfirmation,
    mcpServerId: 'default-mcp-id',
    ...overrides,
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

function makeMockWorkflowPort(): WorkflowPort {
  return {
    getAvailableRuns: jest.fn().mockResolvedValue({ pending: [], malformed: [] }),
    getAvailableRun: jest.fn().mockResolvedValue(null),
    updateStepExecution: jest.fn().mockResolvedValue(undefined),
    getCollectionSchema: jest.fn().mockResolvedValue({
      collectionName: 'customers',
      collectionDisplayName: 'Customers',
      primaryKeyFields: ['id'],
      fields: [],
      actions: [],
    }),
    getMcpServerConfigs: jest.fn().mockResolvedValue({}),
    hasRunAccess: jest.fn().mockResolvedValue(true),
    reportExecutorMetadata: jest.fn().mockResolvedValue(undefined),
  };
}

const COMPLETE_STEP = 'complete-step';
const CALL_LIMIT_ERROR =
  "The AI needed more than 10 tool calls to complete this step. Try narrowing the step's prompt.";

function toolCallResponse(name: string, args: Record<string, unknown>) {
  return { tool_calls: [{ name, args, id: `call_${name}` }] };
}

// Proposes each call in turn, then completes the step with `summary`.
function makeLoopModel(calls: Array<[string, Record<string, unknown>]>, summary = 'Done.') {
  const invoke = jest.fn();
  calls.forEach(([name, args]) => invoke.mockResolvedValueOnce(toolCallResponse(name, args)));
  invoke.mockResolvedValue(toolCallResponse(COMPLETE_STEP, { summary }));
  const bindTools = jest.fn().mockReturnValue({ invoke });
  const model = { bindTools } as unknown as ExecutionContext['model'];

  return { model, bindTools, invoke };
}

function makeMockModel(toolName: string, toolArgs: Record<string, unknown>) {
  return makeLoopModel([[toolName, toolArgs]]);
}

// Never completes: proposes the same call on every decision.
function makeEndlessModel(toolName: string, toolArgs: Record<string, unknown>) {
  const invoke = jest.fn().mockResolvedValue(toolCallResponse(toolName, toolArgs));
  const model = { bindTools: jest.fn().mockReturnValue({ invoke }) };

  return { model: model as unknown as ExecutionContext['model'], invoke };
}

function requestSentOnDecision(modelInvoke: jest.Mock, decision: number): string {
  const messages = modelInvoke.mock.calls[decision][0] as Array<{ content: string }>;

  return messages[messages.length - 1].content;
}

function makeActivityLogPort() {
  return {
    createPending: jest.fn().mockResolvedValue({ id: 'log-1', index: '0' }),
    markSucceeded: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
  };
}

function executedCall(name: string, input: Record<string, unknown>, result: unknown) {
  return { name, sourceId: 'mcp-server-1', input, result };
}

function makeContext(
  overrides: Partial<ExecutionContext<McpStepDefinition>> & {
    agentPort?: AgentPort;
    activityLogPort?: ActivityLogPort;
    activityLog?: ActivityLog;
    workflowPort?: WorkflowPort;
  } = {},
): ExecutionContext<McpStepDefinition> {
  const runId = overrides.runId ?? 'run-1';
  const workflowPort = overrides.workflowPort ?? makeMockWorkflowPort();
  const schemaCache = new SchemaCache();

  const base: Omit<ExecutionContext<McpStepDefinition>, 'agent' | 'activityLog'> = {
    runId,
    stepId: 'mcp-1',
    stepIndex: 0,
    collectionId: 'col-1',
    baseRecordRef: { collectionName: 'customers', recordId: [42], stepIndex: 0 },
    stepDefinition: makeStep(),
    model: makeMockModel('send_notification', { message: 'Hello' }).model,
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
    timezone: 'UTC',
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
        agentPort:
          overrides.agentPort ??
          ({
            getRecord: jest.fn(),
            updateRecord: jest.fn(),
            getRelatedData: jest.fn(),
            executeAction: jest.fn(),
          } as unknown as AgentPort),
        schemaResolver: base.schemaResolver,
        user: base.user,
        activityLog,
      }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('McpStepExecutor', () => {
  describe('executionType=FullyAutomated: direct execution (Branch B)', () => {
    it('invokes the tool and returns success', async () => {
      const invokeFn = jest.fn().mockResolvedValue({ result: 'notification sent' });
      const tool = new MockRemoteTool({
        name: 'send_notification',
        sourceId: 'mcp-server-1',
        invoke: invokeFn,
      });
      const { model, invoke: modelInvoke } = makeMockModel('send_notification', {
        message: 'Hello',
      });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model,
        runStore,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
      const executor = new McpStepExecutor(context, [tool]);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(invokeFn).toHaveBeenCalledWith({ message: 'Hello' });
      expect(runStore.saveStepExecution).toHaveBeenLastCalledWith('run-1', {
        type: 'mcp',
        stepIndex: 0,
        toolCalls: [
          executedCall('send_notification', { message: 'Hello' }, { result: 'notification sent' }),
        ],
        executionParams: {
          name: 'send_notification',
          sourceId: 'mcp-server-1',
          input: { message: 'Hello' },
        },
        executionResult: {
          success: true,
          toolResult: { result: 'notification sent' },
          formattedResponse: 'Done.',
        },
        idempotencyPhase: 'done',
      });
      // Model is invoked twice: once to call the tool, once to complete the step
      expect(modelInvoke).toHaveBeenCalledTimes(2);
    });

    it('runs several tool calls in sequence, each AI decision seeing the previous results', async () => {
      const searchInvoke = jest.fn().mockResolvedValue({ pageId: 'p1' });
      const getInvoke = jest.fn().mockResolvedValue('Quarterly target: 42');
      const tools = [
        new MockRemoteTool({ name: 'search_pages', invoke: searchInvoke }),
        new MockRemoteTool({ name: 'get_page', invoke: getInvoke }),
      ];
      const { model, invoke: modelInvoke } = makeLoopModel(
        [
          ['search_pages', { query: 'targets' }],
          ['get_page', { pageId: 'p1' }],
        ],
        'The quarterly target is 42.',
      );
      const runStore = makeMockRunStore();
      const context = makeContext({
        model,
        runStore,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });

      const result = await new McpStepExecutor(context, tools).execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(searchInvoke).toHaveBeenCalledWith({ query: 'targets' });
      expect(getInvoke).toHaveBeenCalledWith({ pageId: 'p1' });
      expect(modelInvoke).toHaveBeenCalledTimes(3);
      expect(requestSentOnDecision(modelInvoke, 0)).not.toContain('search_pages');
      expect(requestSentOnDecision(modelInvoke, 1)).toContain('search_pages');
      expect(requestSentOnDecision(modelInvoke, 1)).toContain('{"query":"targets"}');
      expect(requestSentOnDecision(modelInvoke, 1)).toContain('{"pageId":"p1"}');
      expect(requestSentOnDecision(modelInvoke, 2)).toContain('Quarterly target: 42');
      expect(runStore.saveStepExecution).toHaveBeenLastCalledWith('run-1', {
        type: 'mcp',
        stepIndex: 0,
        toolCalls: [
          executedCall('search_pages', { query: 'targets' }, { pageId: 'p1' }),
          executedCall('get_page', { pageId: 'p1' }, 'Quarterly target: 42'),
        ],
        executionParams: { name: 'get_page', sourceId: 'mcp-server-1', input: { pageId: 'p1' } },
        executionResult: {
          success: true,
          toolResult: 'Quarterly target: 42',
          formattedResponse: 'The quarterly target is 42.',
        },
        idempotencyPhase: 'done',
      });
    });

    it('binds the complete-step tool alongside the tools of the step', async () => {
      const { model, bindTools } = makeMockModel('send_notification', {});
      const context = makeContext({
        model,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });

      await new McpStepExecutor(context, [
        new MockRemoteTool({ name: 'send_notification' }),
      ]).execute();

      const boundTools = bindTools.mock.calls[0][0] as Array<{ name: string }>;
      expect(boundTools.map(t => t.name)).toEqual(['send_notification', COMPLETE_STEP]);
    });

    it('fails the step without running an 11th call when the AI asks for more than 10', async () => {
      const invokeFn = jest.fn().mockResolvedValue('sent');
      const { model, invoke: modelInvoke } = makeEndlessModel('send_notification', {});
      const context = makeContext({
        model,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });

      const result = await new McpStepExecutor(context, [
        new MockRemoteTool({ name: 'send_notification', invoke: invokeFn }),
      ]).execute();

      expect(result.stepOutcome).toEqual({
        type: 'mcp',
        stepId: 'mcp-1',
        stepIndex: 0,
        status: 'error',
        error: CALL_LIMIT_ERROR,
      });
      expect(invokeFn).toHaveBeenCalledTimes(10);
      expect(modelInvoke).toHaveBeenCalledTimes(11);
    });

    describe('once the step has timed out', () => {
      const settle = (ms: number) =>
        new Promise(resolve => {
          setTimeout(resolve, ms);
        });

      it('asks the AI for nothing more and never marks the step done after a call outlived it', async () => {
        const searchInvoke = jest.fn(async () => {
          await settle(100);

          return 'p1';
        });
        const getInvoke = jest.fn();
        const { model, invoke: modelInvoke } = makeLoopModel([
          ['search_pages', {}],
          ['get_page', {}],
        ]);
        const runStore = makeMockRunStore();
        const context = makeContext({
          model,
          runStore,
          stepTimeoutS: 0.05,
          stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
        });

        const result = await new McpStepExecutor(context, [
          new MockRemoteTool({ name: 'search_pages', invoke: searchInvoke }),
          new MockRemoteTool({ name: 'get_page', invoke: getInvoke }),
        ]).execute();
        await settle(200);

        expect(result.stepOutcome.status).toBe('error');
        expect(searchInvoke).toHaveBeenCalledTimes(1);
        expect(modelInvoke).toHaveBeenCalledTimes(1);
        expect(getInvoke).not.toHaveBeenCalled();
        expect(runStore.saveStepExecution).not.toHaveBeenCalledWith(
          'run-1',
          expect.objectContaining({ idempotencyPhase: 'done' }),
        );
      });

      it('runs no tool call the AI chose after the step timed out', async () => {
        const invokeFn = jest.fn();
        const modelInvoke = jest.fn(async () => {
          await settle(100);

          return toolCallResponse('send_notification', {});
        });
        const model = {
          bindTools: jest.fn().mockReturnValue({ invoke: modelInvoke }),
        } as unknown as ExecutionContext['model'];
        const context = makeContext({
          model,
          stepTimeoutS: 0.05,
          stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
        });

        const result = await new McpStepExecutor(context, [
          new MockRemoteTool({ name: 'send_notification', invoke: invokeFn }),
        ]).execute();
        await settle(200);

        expect(result.stepOutcome.status).toBe('error');
        expect(invokeFn).not.toHaveBeenCalled();
      });
    });

    it('succeeds with the AI answer without calling any tool when the AI completes first', async () => {
      const invokeFn = jest.fn();
      const activityLogPort = makeActivityLogPort();
      const { model } = makeLoopModel([], 'The previous step already holds the address.');
      const runStore = makeMockRunStore();
      const context = makeContext({
        model,
        runStore,
        activityLogPort,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });

      const result = await new McpStepExecutor(context, [
        new MockRemoteTool({ name: 'send_notification', invoke: invokeFn }),
      ]).execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(invokeFn).not.toHaveBeenCalled();
      expect(activityLogPort.createPending).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).toHaveBeenCalledTimes(1);
      expect(runStore.saveStepExecution).toHaveBeenCalledWith('run-1', {
        type: 'mcp',
        stepIndex: 0,
        toolCalls: [],
        executionResult: {
          success: true,
          toolResult: null,
          formattedResponse: 'The previous step already holds the address.',
        },
        idempotencyPhase: 'done',
      });
    });

    it('leaves formattedResponse out when the AI completes with an empty answer', async () => {
      const { model } = makeLoopModel([['send_notification', {}]], '');
      const runStore = makeMockRunStore();
      const context = makeContext({
        model,
        runStore,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });

      const result = await new McpStepExecutor(context, [
        new MockRemoteTool({
          name: 'send_notification',
          invoke: jest.fn().mockResolvedValue('ok'),
        }),
      ]).execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(runStore.saveStepExecution).toHaveBeenLastCalledWith(
        'run-1',
        expect.objectContaining({
          executionResult: { success: true, toolResult: 'ok' },
          idempotencyPhase: 'done',
        }),
      );
    });

    it('fails the step, still marked executing, when the AI cannot decide after a tool ran', async () => {
      const modelInvoke = jest
        .fn()
        .mockResolvedValueOnce(toolCallResponse('send_notification', { message: 'Hi' }))
        .mockResolvedValueOnce({ tool_calls: [] });
      const model = {
        bindTools: jest.fn().mockReturnValue({ invoke: modelInvoke }),
      } as unknown as ExecutionContext['model'];
      const runStore = makeMockRunStore();
      const context = makeContext({
        model,
        runStore,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });

      const result = await new McpStepExecutor(context, [
        new MockRemoteTool({
          name: 'send_notification',
          invoke: jest.fn().mockResolvedValue('ok'),
        }),
      ]).execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        "The AI couldn't decide what to do. Try rephrasing the step's prompt.",
      );
      expect(runStore.saveStepExecution).toHaveBeenLastCalledWith('run-1', {
        type: 'mcp',
        stepIndex: 0,
        toolCalls: [executedCall('send_notification', { message: 'Hi' }, 'ok')],
        idempotencyPhase: 'executing',
      });
      expect(runStore.saveStepExecution).not.toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({ idempotencyPhase: 'done' }),
      );
    });

    it('records a null tool result and still completes with the AI answer', async () => {
      const { model, invoke: modelInvoke } = makeMockModel('send_notification', { message: 'Hi' });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model,
        runStore,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });

      const result = await new McpStepExecutor(context, [
        new MockRemoteTool({
          name: 'send_notification',
          invoke: jest.fn().mockResolvedValue(null),
        }),
      ]).execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(modelInvoke).toHaveBeenCalledTimes(2);
      expect(runStore.saveStepExecution).toHaveBeenLastCalledWith(
        'run-1',
        expect.objectContaining({
          toolCalls: [executedCall('send_notification', { message: 'Hi' }, null)],
          executionResult: { success: true, toolResult: null, formattedResponse: 'Done.' },
        }),
      );
    });

    it('truncates a tool result over 20,000 characters before showing it to the AI', async () => {
      const longResult = `${'a'.repeat(20_000)}TAIL`;
      const { model, invoke: modelInvoke } = makeMockModel('get_page', {});
      const context = makeContext({
        model,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });

      await new McpStepExecutor(context, [
        new MockRemoteTool({ name: 'get_page', invoke: jest.fn().mockResolvedValue(longResult) }),
      ]).execute();

      const request = requestSentOnDecision(modelInvoke, 1);
      expect(request).toContain(`${'a'.repeat(20_000)}\n... [truncated]`);
      expect(request).not.toContain('TAIL');
    });
  });

  describe('without executionType=FullyAutomated: awaiting-input (Branch C)', () => {
    it('saves pendingData and returns awaiting-input', async () => {
      const { model } = makeMockModel('send_notification', { message: 'Hello' });
      const runStore = makeMockRunStore();
      const tool = new MockRemoteTool({ name: 'send_notification', sourceId: 'mcp-server-1' });
      const context = makeContext({ model, runStore });
      const executor = new McpStepExecutor(context, [tool]);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('awaiting-input');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith('run-1', {
        type: 'mcp',
        stepIndex: 0,
        toolCalls: [],
        pendingData: {
          name: 'send_notification',
          sourceId: 'mcp-server-1',
          input: { message: 'Hello' },
        },
      });
    });

    it('completes without asking for confirmation when the AI answers before proposing a call', async () => {
      const invokeFn = jest.fn();
      const { model } = makeLoopModel([], 'Nothing to send.');
      const runStore = makeMockRunStore();
      const context = makeContext({ model, runStore });

      const result = await new McpStepExecutor(context, [
        new MockRemoteTool({ name: 'send_notification', invoke: invokeFn }),
      ]).execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(invokeFn).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).toHaveBeenCalledTimes(1);
      expect(runStore.saveStepExecution).toHaveBeenCalledWith('run-1', {
        type: 'mcp',
        stepIndex: 0,
        toolCalls: [],
        executionResult: { success: true, toolResult: null, formattedResponse: 'Nothing to send.' },
        idempotencyPhase: 'done',
      });
    });

    it('returns error when saveStepExecution fails (Branch C)', async () => {
      const { model } = makeMockModel('send_notification', { message: 'Hello' });
      const logger = jest.fn();
      const runStore = makeMockRunStore({
        saveStepExecution: jest
          .fn()
          .mockRejectedValue(
            new RunStorePortError('saveStepExecution', new Error('DB unavailable')),
          ),
      });
      const tool = new MockRemoteTool({ name: 'send_notification', sourceId: 'mcp-server-1' });
      const context = makeContext({ model, runStore, logger });
      const executor = new McpStepExecutor(context, [tool]);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe('The step state could not be accessed. Please retry.');
      expect(logger).toHaveBeenCalledWith(
        'Error',
        'Run store "saveStepExecution" failed: DB unavailable',
        expect.objectContaining({ cause: 'DB unavailable', stepId: 'mcp-1' }),
      );
    });
  });

  describe('confirmation accepted (Branch A)', () => {
    it('loads pendingData, invokes the tool, and persists the result', async () => {
      const invokeFn = jest.fn().mockResolvedValue('email sent');
      const tool = new MockRemoteTool({
        name: 'send_notification',
        sourceId: 'mcp-server-1',
        invoke: invokeFn,
      });
      const execution: McpStepExecutionData = {
        type: 'mcp',
        stepIndex: 0,
        pendingData: {
          name: 'send_notification',
          sourceId: 'mcp-server-1',
          input: { message: 'Hello' },
        },
        userConfirmation: { userConfirmed: true },
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const { model } = makeLoopModel([], 'Email sent.');
      const context = makeContext({ model, runStore });
      const executor = new McpStepExecutor(context, [tool]);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(invokeFn).toHaveBeenCalledWith({ message: 'Hello' });
      expect(runStore.saveStepExecution).toHaveBeenLastCalledWith('run-1', {
        type: 'mcp',
        stepIndex: 0,
        toolCalls: [executedCall('send_notification', { message: 'Hello' }, 'email sent')],
        executionParams: {
          name: 'send_notification',
          sourceId: 'mcp-server-1',
          input: { message: 'Hello' },
        },
        executionResult: {
          success: true,
          toolResult: 'email sent',
          formattedResponse: 'Email sent.',
        },
        pendingData: {
          name: 'send_notification',
          sourceId: 'mcp-server-1',
          input: { message: 'Hello' },
        },
        userConfirmation: { userConfirmed: true },
        idempotencyPhase: 'done',
      });
    });

    it('pauses for the next call the AI proposes, keeping the completed calls and clearing the confirmation', async () => {
      const searchInvoke = jest.fn().mockResolvedValue({ pageId: 'p1' });
      const deleteInvoke = jest.fn();
      const execution: McpStepExecutionData = {
        type: 'mcp',
        stepIndex: 0,
        toolCalls: [],
        pendingData: { name: 'search_pages', sourceId: 'mcp-server-1', input: { query: 'q' } },
        userConfirmation: { userConfirmed: true },
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const { model } = makeLoopModel([['delete_page', { pageId: 'p1' }]]);
      const context = makeContext({ model, runStore });

      const result = await new McpStepExecutor(context, [
        new MockRemoteTool({ name: 'search_pages', invoke: searchInvoke }),
        new MockRemoteTool({ name: 'delete_page', invoke: deleteInvoke }),
      ]).execute();

      expect(result.stepOutcome).toEqual({
        type: 'mcp',
        stepId: 'mcp-1',
        stepIndex: 0,
        status: 'awaiting-input',
      });
      expect(searchInvoke).toHaveBeenCalledWith({ query: 'q' });
      expect(deleteInvoke).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).toHaveBeenLastCalledWith('run-1', {
        type: 'mcp',
        stepIndex: 0,
        toolCalls: [executedCall('search_pages', { query: 'q' }, { pageId: 'p1' })],
        pendingData: { name: 'delete_page', sourceId: 'mcp-server-1', input: { pageId: 'p1' } },
      });
    });

    it('continues from the calls already made when a later call is accepted', async () => {
      const getInvoke = jest.fn().mockResolvedValue('page body');
      const execution: McpStepExecutionData = {
        type: 'mcp',
        stepIndex: 0,
        toolCalls: [executedCall('search_pages', { query: 'q' }, { pageId: 'p1' })],
        pendingData: { name: 'get_page', sourceId: 'mcp-server-1', input: { pageId: 'p1' } },
        userConfirmation: { userConfirmed: true },
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const { model, invoke: modelInvoke } = makeLoopModel([], 'Read the page.');
      const context = makeContext({ model, runStore });

      const result = await new McpStepExecutor(context, [
        new MockRemoteTool({ name: 'search_pages' }),
        new MockRemoteTool({ name: 'get_page', invoke: getInvoke }),
      ]).execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(getInvoke).toHaveBeenCalledWith({ pageId: 'p1' });
      expect(requestSentOnDecision(modelInvoke, 0)).toContain('{"pageId":"p1"}');
      expect(requestSentOnDecision(modelInvoke, 0)).toContain('page body');
      expect(runStore.saveStepExecution).toHaveBeenLastCalledWith(
        'run-1',
        expect.objectContaining({
          toolCalls: [
            executedCall('search_pages', { query: 'q' }, { pageId: 'p1' }),
            executedCall('get_page', { pageId: 'p1' }, 'page body'),
          ],
          executionResult: {
            success: true,
            toolResult: 'page body',
            formattedResponse: 'Read the page.',
          },
          idempotencyPhase: 'done',
        }),
      );
    });

    it('fails the step when the AI proposes an 11th call after the 10th is accepted', async () => {
      const invokeFn = jest.fn().mockResolvedValue('sent');
      const execution: McpStepExecutionData = {
        type: 'mcp',
        stepIndex: 0,
        toolCalls: Array.from({ length: 9 }, () => executedCall('send_notification', {}, 'sent')),
        pendingData: { name: 'send_notification', sourceId: 'mcp-server-1', input: {} },
        userConfirmation: { userConfirmed: true },
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const { model } = makeEndlessModel('send_notification', {});
      const context = makeContext({ model, runStore });

      const result = await new McpStepExecutor(context, [
        new MockRemoteTool({ name: 'send_notification', invoke: invokeFn }),
      ]).execute();

      expect(result.stepOutcome).toMatchObject({ status: 'error', error: CALL_LIMIT_ERROR });
      expect(invokeFn).toHaveBeenCalledTimes(1);
      // The last save records the 10th call: the step never paused for an 11th.
      const saves = (runStore.saveStepExecution as jest.Mock).mock.calls;
      const lastSaved = saves[saves.length - 1][1] as McpStepExecutionData;
      expect(lastSaved.toolCalls).toHaveLength(10);
      expect(lastSaved.idempotencyPhase).toBe('executing');
    });
  });

  describe('confirmation rejected (Branch A)', () => {
    it('saves skipped result and returns success without invoking the tool', async () => {
      const invokeFn = jest.fn();
      const tool = new MockRemoteTool({
        name: 'send_notification',
        sourceId: 'mcp-server-1',
        invoke: invokeFn,
      });
      const execution: McpStepExecutionData = {
        type: 'mcp',
        stepIndex: 0,
        pendingData: {
          name: 'send_notification',
          sourceId: 'mcp-server-1',
          input: { message: 'Hello' },
        },
        userConfirmation: { userConfirmed: false },
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const context = makeContext({ runStore });
      const executor = new McpStepExecutor(context, [tool]);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(invokeFn).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionResult: { skipped: true },
          pendingData: {
            name: 'send_notification',
            sourceId: 'mcp-server-1',
            input: { message: 'Hello' },
          },
        }),
      );
    });

    it('keeps the completed calls when a later call is rejected', async () => {
      const deleteInvoke = jest.fn();
      const completed = [executedCall('search_pages', { query: 'q' }, { pageId: 'p1' })];
      const execution: McpStepExecutionData = {
        type: 'mcp',
        stepIndex: 0,
        toolCalls: completed,
        pendingData: { name: 'delete_page', sourceId: 'mcp-server-1', input: { pageId: 'p1' } },
        userConfirmation: { userConfirmed: false },
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const context = makeContext({ runStore });

      const result = await new McpStepExecutor(context, [
        new MockRemoteTool({ name: 'delete_page', invoke: deleteInvoke }),
      ]).execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(deleteInvoke).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).toHaveBeenCalledWith('run-1', {
        ...execution,
        toolCalls: completed,
        executionResult: { skipped: true },
      });
    });
  });

  describe('forwards all provided remoteTools to the AI', () => {
    // Tools are pre-scoped upstream — the executor must not re-filter by mcpServerId. Mixing
    // divergent mcpServerId values in the input asserts the executor passes every tool through,
    // even ones that wouldn't match the step's mcpServerId on their own.
    it.each([
      ['absent', undefined],
      ['null', null],
      ['empty', []],
    ])('binds every tool it receives when allowedTools is %s', async (_label, allowedTools) => {
      const toolA = new MockRemoteTool({ name: 'tool_a' });
      const toolB = new MockRemoteTool({ name: 'tool_b' });
      const { model, bindTools } = makeMockModel('tool_a', {});
      const context = makeContext({
        model,
        stepDefinition: makeStep({
          executionType: StepExecutionMode.FullyAutomated,
          allowedTools: allowedTools as McpStepDefinition['allowedTools'],
        }),
      });
      const executor = new McpStepExecutor(context, [toolA, toolB]);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      const boundTools = bindTools.mock.calls[0][0] as Array<{ name: string }>;
      expect(boundTools.map(t => t.name)).toEqual(['tool_a', 'tool_b', COMPLETE_STEP]);
    });

    it('binds every tool it receives, including ones whose mcpServerId differs from the step', async () => {
      const matchingTool = new MockRemoteTool({ name: 'tool_a', mcpServerId: 'id-A' });
      const offTargetTool = new MockRemoteTool({ name: 'tool_b', mcpServerId: 'id-B' });
      const { model, bindTools } = makeMockModel('tool_a', {});
      const context = makeContext({
        model,
        stepDefinition: makeStep({
          mcpServerId: 'id-A',
          executionType: StepExecutionMode.FullyAutomated,
        }),
      });
      const executor = new McpStepExecutor(context, [matchingTool, offTargetTool]);

      await executor.execute();

      const boundTools = bindTools.mock.calls[0][0] as Array<{ name: string }>;
      expect(boundTools.map(t => t.name)).toEqual(expect.arrayContaining(['tool_a', 'tool_b']));
    });

    it('resolves a Forest-connector-backed tool end-to-end', async () => {
      const invokeFn = jest.fn().mockResolvedValue('done');
      const forestTool = new MockRemoteTool({
        name: 'zendesk_get_tickets',
        sourceId: 'zendesk',
        mcpServerId: 'forest-connector-42',
        invoke: invokeFn,
      });
      const { model, bindTools } = makeMockModel('zendesk_get_tickets', {});
      const context = makeContext({
        model,
        stepDefinition: makeStep({
          mcpServerId: 'forest-connector-42',
          executionType: StepExecutionMode.FullyAutomated,
        }),
      });
      const executor = new McpStepExecutor(context, [forestTool]);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      const boundTools = bindTools.mock.calls[0][0] as Array<{ name: string }>;
      expect(boundTools.map(t => t.name)).toEqual(['zendesk_get_tickets', COMPLETE_STEP]);
      expect(invokeFn).toHaveBeenCalled();
    });
  });

  describe('allowedTools', () => {
    it('binds only the allowed tools to the AI', async () => {
      const searchInvoke = jest.fn().mockResolvedValue('found');
      const sendInvoke = jest.fn();
      const tools = [
        new MockRemoteTool({ name: 'search_pages', invoke: searchInvoke }),
        new MockRemoteTool({ name: 'send_email', invoke: sendInvoke }),
        new MockRemoteTool({ name: 'get_page' }),
      ];
      const { model, bindTools } = makeMockModel('search_pages', { query: 'q' });
      const context = makeContext({
        model,
        stepDefinition: makeStep({
          executionType: StepExecutionMode.FullyAutomated,
          allowedTools: ['search_pages', 'get_page'],
        }),
      });

      const result = await new McpStepExecutor(context, tools).execute();

      expect(result.stepOutcome.status).toBe('success');
      const boundTools = bindTools.mock.calls[0][0] as Array<{ name: string }>;
      expect(boundTools.map(t => t.name)).toEqual(['search_pages', 'get_page', COMPLETE_STEP]);
      expect(searchInvoke).toHaveBeenCalledWith({ query: 'q' });
      expect(sendInvoke).not.toHaveBeenCalled();
    });

    it('matches an allow-list entry against the sanitized tool name', async () => {
      const invokeFn = jest.fn().mockResolvedValue('sent');
      const tools = [
        new MockRemoteTool({ name: 'notion.search', invoke: invokeFn }),
        new MockRemoteTool({ name: 'notion.delete' }),
      ];
      const { model, bindTools } = makeMockModel('notion.search', { query: 'q' });
      const context = makeContext({
        model,
        stepDefinition: makeStep({
          executionType: StepExecutionMode.FullyAutomated,
          allowedTools: ['notion_search'],
        }),
      });

      const result = await new McpStepExecutor(context, tools).execute();

      expect(result.stepOutcome.status).toBe('success');
      const boundTools = bindTools.mock.calls[0][0] as Array<{ name: string }>;
      expect(boundTools.map(t => t.name)).toEqual(['notion.search', COMPLETE_STEP]);
      expect(invokeFn).toHaveBeenCalledWith({ query: 'q' });
    });

    it('runs on the matched tools and logs one Warn naming the unmatched entries on a partial match', async () => {
      const logger = jest.fn();
      const invokeFn = jest.fn().mockResolvedValue('found');
      const tools = [
        new MockRemoteTool({ name: 'search_pages', invoke: invokeFn }),
        new MockRemoteTool({ name: 'send_email' }),
      ];
      const { model, bindTools } = makeMockModel('search_pages', { query: 'q' });
      const context = makeContext({
        logger,
        model,
        stepDefinition: makeStep({
          mcpServerId: 'notion-1',
          executionType: StepExecutionMode.FullyAutomated,
          allowedTools: ['search_pages', 'renamed_tool', 'dropped_tool'],
        }),
      });

      const result = await new McpStepExecutor(context, tools).execute();

      expect(result.stepOutcome).toEqual({
        type: 'mcp',
        stepId: 'mcp-1',
        stepIndex: 0,
        status: 'success',
      });
      const boundTools = bindTools.mock.calls[0][0] as Array<{ name: string }>;
      expect(boundTools.map(t => t.name)).toEqual(['search_pages', COMPLETE_STEP]);
      expect(invokeFn).toHaveBeenCalledWith({ query: 'q' });
      const warnCalls = logger.mock.calls.filter(([level]) => level === 'Warn');
      expect(warnCalls).toEqual([
        [
          'Warn',
          'MCP step allow-list names tools that match no single loaded tool',
          expect.objectContaining({
            runId: 'run-1',
            stepIndex: 0,
            mcpServerId: 'notion-1',
            unmatchedAllowedTools: ['renamed_tool', 'dropped_tool'],
          }),
        ],
      ]);
    });

    it('binds neither tool when one allow-list entry is the sanitized name of two loaded tools', async () => {
      const logger = jest.fn();
      const deleteSlash = jest.fn();
      const deleteColon = jest.fn();
      const tools = [
        new MockRemoteTool({ name: 'delete/user', invoke: deleteSlash }),
        new MockRemoteTool({ name: 'delete:user', invoke: deleteColon }),
        new MockRemoteTool({ name: 'search_pages' }),
      ];
      const { model, bindTools } = makeMockModel('search_pages', {});
      const context = makeContext({
        logger,
        model,
        stepDefinition: makeStep({
          mcpServerId: 'notion-1',
          executionType: StepExecutionMode.FullyAutomated,
          allowedTools: ['delete_user', 'search_pages'],
        }),
      });

      const result = await new McpStepExecutor(context, tools).execute();

      expect(result.stepOutcome.status).toBe('success');
      const boundTools = bindTools.mock.calls[0][0] as Array<{ name: string }>;
      expect(boundTools.map(t => t.name)).toEqual(['search_pages', COMPLETE_STEP]);
      expect(deleteSlash).not.toHaveBeenCalled();
      expect(deleteColon).not.toHaveBeenCalled();
      expect(logger).toHaveBeenCalledWith(
        'Warn',
        'MCP step allow-list names tools that match no single loaded tool',
        expect.objectContaining({
          mcpServerId: 'notion-1',
          unmatchedAllowedTools: ['delete_user'],
        }),
      );
    });

    it('logs no Warn when every allow-list entry matches a loaded tool', async () => {
      const logger = jest.fn();
      const tools = [
        new MockRemoteTool({ name: 'search_pages' }),
        new MockRemoteTool({ name: 'send_email' }),
      ];
      const { model } = makeMockModel('search_pages', {});
      const context = makeContext({
        logger,
        model,
        stepDefinition: makeStep({
          executionType: StepExecutionMode.FullyAutomated,
          allowedTools: ['search_pages'],
        }),
      });

      const result = await new McpStepExecutor(context, tools).execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(logger).not.toHaveBeenCalledWith('Warn', expect.anything(), expect.anything());
    });
  });

  describe('McpToolsNotAllowedError', () => {
    it('returns a configuration error naming the missing tools when no loaded tool is allowed', async () => {
      const invokeFn = jest.fn();
      const { model, bindTools } = makeMockModel('send_email', {});
      const context = makeContext({
        model,
        stepDefinition: makeStep({
          mcpServerId: 'notion-1',
          executionType: StepExecutionMode.FullyAutomated,
          allowedTools: ['search_pages', 'get_page'],
        }),
      });
      const executor = new McpStepExecutor(context, [
        new MockRemoteTool({ name: 'send_email', invoke: invokeFn }),
      ]);

      const result = await executor.execute();

      expect(result.stepOutcome).toEqual({
        type: 'mcp',
        stepId: 'mcp-1',
        stepIndex: 0,
        status: 'error',
        errorKind: 'configuration',
        error:
          'None of the tools this step is allowed to use are available on its server: search_pages, get_page.',
      });
      expect(bindTools).not.toHaveBeenCalled();
      expect(invokeFn).not.toHaveBeenCalled();
    });

    it('logs the technical message with the mcpServerId and the missing tools', async () => {
      const logger = jest.fn();
      const context = makeContext({
        logger,
        stepDefinition: makeStep({ mcpServerId: 'notion-1', allowedTools: ['search_pages'] }),
      });
      const executor = new McpStepExecutor(context, [new MockRemoteTool({ name: 'send_email' })]);

      await executor.execute();

      expect(logger).toHaveBeenCalledWith(
        'Error',
        'No loaded MCP tool is allowed for mcpServerId="notion-1": search_pages',
        expect.objectContaining({ runId: 'run-1', stepIndex: 0, mcpServerId: 'notion-1' }),
      );
    });

    it('returns a configuration error when the only allow-list entry is the sanitized name of two loaded tools', async () => {
      const deleteSlash = jest.fn();
      const context = makeContext({
        stepDefinition: makeStep({
          executionType: StepExecutionMode.FullyAutomated,
          allowedTools: ['delete_user'],
        }),
      });
      const executor = new McpStepExecutor(context, [
        new MockRemoteTool({ name: 'delete/user', invoke: deleteSlash }),
        new MockRemoteTool({ name: 'delete:user' }),
      ]);

      const result = await executor.execute();

      expect(result.stepOutcome).toMatchObject({ status: 'error', errorKind: 'configuration' });
      expect(deleteSlash).not.toHaveBeenCalled();
    });

    it('still reports NoMcpToolsError when the server loaded no tools, whatever the allow-list', async () => {
      const context = makeContext({
        stepDefinition: makeStep({ allowedTools: ['search_pages'] }),
      });
      const executor = new McpStepExecutor(context, []);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toMatch(
        /^Tools could not be loaded for the targeted server\./,
      );
      expect(result.stepOutcome.errorKind).toBeUndefined();
    });
  });

  describe('NoMcpToolsError', () => {
    it('returns error when remoteTools is empty', async () => {
      const context = makeContext();
      const executor = new McpStepExecutor(context, []);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toMatch(
        /^Tools could not be loaded for the targeted server\./,
      );
    });

    it('keeps the user-facing error message free of internal ids', async () => {
      const context = makeContext({ stepDefinition: makeStep({ mcpServerId: 'id-B' }) });
      const executor = new McpStepExecutor(context, []);

      const result = await executor.execute();

      expect(result.stepOutcome.error).toMatch(
        /^Tools could not be loaded for the targeted server\./,
      );
      expect(result.stepOutcome.error).not.toMatch(/id-B/);
    });

    it('logs the technical message with the requested mcpServerId when tools are empty', async () => {
      const logger = jest.fn();
      const context = makeContext({
        logger,
        stepDefinition: makeStep({ mcpServerId: 'id-missing' }),
      });
      const executor = new McpStepExecutor(context, []);

      await executor.execute();

      // BaseStepExecutor catches NoMcpToolsError and logs error.message (which encodes the
      // requested mcpServerId) along with the step correlation context.
      expect(logger).toHaveBeenCalledWith(
        'Error',
        'No MCP tools available for mcpServerId="id-missing"',
        expect.objectContaining({
          runId: expect.any(String),
          stepId: expect.any(String),
          stepIndex: expect.any(Number),
        }),
      );
    });
  });

  describe('McpToolNotFoundError', () => {
    it('returns error when tool from pendingData no longer exists (Branch A)', async () => {
      const execution: McpStepExecutionData = {
        type: 'mcp',
        stepIndex: 0,
        pendingData: {
          name: 'deleted_tool',
          sourceId: 'mcp-server-1',
          input: {},
        },
        userConfirmation: { userConfirmed: true },
      };
      const tool = new MockRemoteTool({ name: 'other_tool', sourceId: 'mcp-server-1' });
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const context = makeContext({ runStore });
      const executor = new McpStepExecutor(context, [tool]);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        "The AI selected a tool that doesn't exist. Try rephrasing the step's prompt.",
      );
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });

    it('returns error without invoking it when the tool from pendingData is loaded but not allowed (Branch A)', async () => {
      const execution: McpStepExecutionData = {
        type: 'mcp',
        stepIndex: 0,
        pendingData: { name: 'send_email', sourceId: 'mcp-server-1', input: {} },
        userConfirmation: { userConfirmed: true },
      };
      const sendInvoke = jest.fn();
      const tools = [
        new MockRemoteTool({ name: 'search_pages', sourceId: 'mcp-server-1' }),
        new MockRemoteTool({ name: 'send_email', sourceId: 'mcp-server-1', invoke: sendInvoke }),
      ];
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const context = makeContext({
        runStore,
        stepDefinition: makeStep({ allowedTools: ['search_pages'] }),
      });

      const result = await new McpStepExecutor(context, tools).execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        "The AI selected a tool that doesn't exist. Try rephrasing the step's prompt.",
      );
      expect(sendInvoke).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('RunStorePortError propagation', () => {
    it('returns error and logs cause when saveStepExecution fails after tool invocation (Branch B)', async () => {
      const invokeFn = jest.fn().mockResolvedValue('ok');
      const tool = new MockRemoteTool({
        name: 'send_notification',
        sourceId: 'mcp-server-1',
        invoke: invokeFn,
      });
      const { model } = makeMockModel('send_notification', { message: 'Hello' });
      const logger = jest.fn();
      const runStore = makeMockRunStore({
        saveStepExecution: jest
          .fn()
          .mockRejectedValue(new RunStorePortError('saveStepExecution', new Error('Disk full'))),
      });
      const context = makeContext({
        model,
        runStore,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
        logger,
      });
      const executor = new McpStepExecutor(context, [tool]);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe('The step state could not be accessed. Please retry.');
      expect(logger).toHaveBeenCalledWith(
        'Error',
        'Run store "saveStepExecution" failed: Disk full',
        expect.objectContaining({ cause: 'Disk full', stepId: 'mcp-1' }),
      );
    });

    it('returns error and logs cause when saveStepExecution fails after tool invocation (Branch A)', async () => {
      const invokeFn = jest.fn().mockResolvedValue('ok');
      const tool = new MockRemoteTool({
        name: 'send_notification',
        sourceId: 'mcp-server-1',
        invoke: invokeFn,
      });
      const execution: McpStepExecutionData = {
        type: 'mcp',
        stepIndex: 0,
        pendingData: {
          name: 'send_notification',
          sourceId: 'mcp-server-1',
          input: { message: 'Hello' },
        },
        userConfirmation: { userConfirmed: true },
      };
      const logger = jest.fn();
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
        saveStepExecution: jest
          .fn()
          .mockRejectedValue(new RunStorePortError('saveStepExecution', new Error('Disk full'))),
      });
      const context = makeContext({ runStore, logger });
      const executor = new McpStepExecutor(context, [tool]);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe('The step state could not be accessed. Please retry.');
      expect(logger).toHaveBeenCalledWith(
        'Error',
        'Run store "saveStepExecution" failed: Disk full',
        expect.objectContaining({ cause: 'Disk full', stepId: 'mcp-1' }),
      );
    });
  });

  describe('stepOutcome shape', () => {
    it('emits correct type, stepId and stepIndex', async () => {
      const tool = new MockRemoteTool({ name: 'send_notification', sourceId: 'mcp-server-1' });
      const { model } = makeMockModel('send_notification', {});
      const context = makeContext({
        model,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
      const executor = new McpStepExecutor(context, [tool]);

      const result = await executor.execute();

      expect(result.stepOutcome).toMatchObject({
        type: 'mcp',
        stepId: 'mcp-1',
        stepIndex: 0,
        status: 'success',
      });
    });
  });

  describe('no pending data in confirmation flow (Branch A)', () => {
    it('falls through to first-call path when no execution record is found', async () => {
      const runStore = makeMockRunStore({
        init: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
        getStepExecutions: jest.fn().mockResolvedValue([]),
      });
      const context = makeContext({ runStore });
      const executor = new McpStepExecutor(context, []);

      await expect(executor.execute()).resolves.toMatchObject({
        stepOutcome: {
          status: 'error',
          error: expect.stringMatching(/^Tools could not be loaded for the targeted server\./),
        },
      });
    });

    it('returns error when execution exists but pendingData is absent', async () => {
      const execution: McpStepExecutionData = {
        type: 'mcp',
        stepIndex: 0,
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const context = makeContext({ runStore });
      const executor = new McpStepExecutor(context, []);

      await expect(executor.execute()).resolves.toMatchObject({
        stepOutcome: {
          status: 'error',
          error: 'An unexpected error occurred while processing this step.',
        },
      });
    });
  });

  describe('tool.base.invoke error', () => {
    it('returns error when tool invocation throws a WorkflowExecutorError', async () => {
      const invokeFn = jest.fn().mockRejectedValue(new StepStateError('Tool failed'));
      const tool = new MockRemoteTool({
        name: 'send_notification',
        sourceId: 'mcp-server-1',
        invoke: invokeFn,
      });
      const { model } = makeMockModel('send_notification', {});
      const mockRunStore = makeMockRunStore();
      const context = makeContext({
        model,
        runStore: mockRunStore,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
      const executor = new McpStepExecutor(context, [tool]);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(mockRunStore.saveStepExecution).toHaveBeenCalledTimes(1);
      expect(mockRunStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({ idempotencyPhase: 'executing' }),
      );
    });

    it('returns error and logs when tool invocation throws an infrastructure error', async () => {
      const invokeFn = jest.fn().mockRejectedValue(new Error('Connection refused'));
      const tool = new MockRemoteTool({
        name: 'send_notification',
        sourceId: 'mcp-server-1',
        invoke: invokeFn,
      });
      const { model } = makeMockModel('send_notification', {});
      const logger = jest.fn();
      const context = makeContext({
        model,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
        logger,
      });
      const executor = new McpStepExecutor(context, [tool]);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'The tool failed to execute. Please try again or contact your administrator.',
      );
      expect(logger).toHaveBeenCalledWith(
        'Error',
        'MCP tool "send_notification" invocation failed: Connection refused',
        expect.objectContaining({ cause: 'Connection refused' }),
      );
    });
  });

  describe('selectTool AI errors', () => {
    it('returns error when AI returns a malformed tool call (MalformedToolCallError)', async () => {
      const model = {
        bindTools: jest.fn().mockReturnValue({
          invoke: jest.fn().mockResolvedValue({
            tool_calls: [{ name: 'send_notification', args: null, id: 'call_1' }],
          }),
        }),
      } as unknown as ExecutionContext['model'];
      const tool = new MockRemoteTool({ name: 'send_notification' });
      const context = makeContext({ model });
      const executor = new McpStepExecutor(context, [tool]);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        "The AI returned an unexpected response. Try rephrasing the step's prompt.",
      );
    });

    it('returns error when AI returns no tool call (MissingToolCallError)', async () => {
      const model = {
        bindTools: jest.fn().mockReturnValue({
          invoke: jest.fn().mockResolvedValue({ tool_calls: [] }),
        }),
      } as unknown as ExecutionContext['model'];
      const tool = new MockRemoteTool({ name: 'send_notification' });
      const context = makeContext({ model });
      const executor = new McpStepExecutor(context, [tool]);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        "The AI couldn't decide what to do. Try rephrasing the step's prompt.",
      );
    });
  });

  describe('default prompt', () => {
    it('uses default prompt when step.prompt is undefined', async () => {
      const { model, invoke: modelInvoke } = makeMockModel('send_notification', {});
      const tool = new MockRemoteTool({ name: 'send_notification', sourceId: 'mcp-server-1' });
      const context = makeContext({
        model,
        stepDefinition: makeStep({ prompt: undefined }),
      });
      const executor = new McpStepExecutor(context, [tool]);

      await executor.execute();

      const messages = modelInvoke.mock.calls[0][0];
      const humanMessage = messages[messages.length - 1];
      expect(humanMessage.content).toBe('**Request**: Execute the relevant tool.');
    });
  });

  describe('previous steps context', () => {
    it('includes previous steps summary in selectTool messages', async () => {
      const { model, invoke: modelInvoke } = makeMockModel('send_notification', {});
      const tool = new MockRemoteTool({ name: 'send_notification', sourceId: 'mcp-server-1' });
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
        model,
        runStore,
        previousSteps: [
          {
            stepDefinition: {
              type: StepType.Condition,
              executionType: StepExecutionMode.Manual,
              options: ['Yes', 'No'],
              prompt: 'Should we send a notification?',
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
      const executor = new McpStepExecutor({ ...context, stepId: 'mcp-2', stepIndex: 1 }, [tool]);

      await executor.execute();

      const messages = modelInvoke.mock.calls[0][0];
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toContain('Step executed by');
      expect(messages[0].content).toContain('Should we send a notification?');
    });
  });

  describe('idempotency', () => {
    it('returns success without re-executing or emitting activity log when idempotencyPhase is done', async () => {
      const toolInvoke = jest.fn().mockResolvedValue('tool-result');
      const tool = new MockRemoteTool({ name: 'send_notification', invoke: toolInvoke });
      const activityLogPort = {
        createPending: jest.fn().mockResolvedValue({ id: 'log-1', index: '0' }),
        markSucceeded: jest.fn().mockResolvedValue(undefined),
        markFailed: jest.fn().mockResolvedValue(undefined),
      };
      const doneExecution: McpStepExecutionData = {
        type: 'mcp',
        stepIndex: 0,
        executionParams: { name: 'send_notification', sourceId: 'mcp-server-1', input: {} },
        executionResult: { success: true, toolResult: 'tool-result' },
        idempotencyPhase: 'done',
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([doneExecution]),
      });
      const context = makeContext({ runStore, activityLogPort });
      const executor = new McpStepExecutor(context, [tool]);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(toolInvoke).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
      expect(activityLogPort.createPending).not.toHaveBeenCalled();
    });

    it('returns error without activity log when idempotencyPhase is executing', async () => {
      const toolInvoke = jest.fn().mockResolvedValue('tool-result');
      const tool = new MockRemoteTool({ name: 'send_notification', invoke: toolInvoke });
      const activityLogPort = {
        createPending: jest.fn().mockResolvedValue({ id: 'log-1', index: '0' }),
        markSucceeded: jest.fn().mockResolvedValue(undefined),
        markFailed: jest.fn().mockResolvedValue(undefined),
      };
      const executingExecution: McpStepExecutionData = {
        type: 'mcp',
        stepIndex: 0,
        idempotencyPhase: 'executing',
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([executingExecution]),
      });
      const context = makeContext({ runStore, activityLogPort });
      const executor = new McpStepExecutor(context, [tool]);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        'An unexpected error occurred while processing this step.',
      );
      expect(toolInvoke).not.toHaveBeenCalled();
      expect(activityLogPort.createPending).not.toHaveBeenCalled();
    });

    it('keeps the step marked executing from the first call until the final answer, marking it done only with that answer', async () => {
      const tools = [
        new MockRemoteTool({ name: 'search_pages', invoke: jest.fn().mockResolvedValue('p1') }),
        new MockRemoteTool({ name: 'get_page', invoke: jest.fn().mockResolvedValue('body') }),
      ];
      const { model } = makeLoopModel([
        ['search_pages', {}],
        ['get_page', {}],
      ]);
      const runStore = makeMockRunStore();
      const context = makeContext({
        model,
        runStore,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });

      await new McpStepExecutor(context, tools).execute();

      const saved = (runStore.saveStepExecution as jest.Mock).mock.calls.map(
        ([, execution]) => execution as McpStepExecutionData,
      );
      // Before call 1, after call 1, before call 2, after call 2, final answer.
      expect(saved.map(e => e.idempotencyPhase)).toEqual([
        'executing',
        'executing',
        'executing',
        'executing',
        'done',
      ]);
      expect(saved.map(e => e.toolCalls?.length)).toEqual([0, 1, 1, 2, 2]);
      expect(saved.slice(0, 4).every(e => e.executionResult === undefined)).toBe(true);
      expect(saved[4].executionResult).toEqual({
        success: true,
        toolResult: 'body',
        formattedResponse: 'Done.',
      });
    });

    it('reports the step as interrupted when re-dispatched after failing between two calls', async () => {
      const store = new InMemoryStore();
      const searchInvoke = jest.fn().mockResolvedValue('p1');
      const tools = [new MockRemoteTool({ name: 'search_pages', invoke: searchInvoke })];
      const failingModelInvoke = jest
        .fn()
        .mockResolvedValueOnce(toolCallResponse('search_pages', {}))
        .mockRejectedValueOnce(new Error('connection reset'));
      const failingModel = {
        bindTools: jest.fn().mockReturnValue({ invoke: failingModelInvoke }),
      } as unknown as ExecutionContext['model'];
      const stepDefinition = makeStep({ executionType: StepExecutionMode.FullyAutomated });

      const first = await new McpStepExecutor(
        makeContext({ runStore: store, model: failingModel, stepDefinition }),
        tools,
      ).execute();
      const { model } = makeLoopModel([['search_pages', {}]]);
      const second = await new McpStepExecutor(
        makeContext({ runStore: store, model, stepDefinition }),
        tools,
      ).execute();

      expect(first.stepOutcome.status).toBe('error');
      expect(second.stepOutcome).toMatchObject({
        status: 'error',
        error: 'An unexpected error occurred while processing this step.',
      });
      expect(searchInvoke).toHaveBeenCalledTimes(1);
    });

    it('runs each call once the user accepts it, pausing again for the next', async () => {
      const store = new InMemoryStore();
      const searchInvoke = jest.fn().mockResolvedValue({ pageId: 'p1' });
      const getInvoke = jest.fn().mockResolvedValue('page body');
      const tools = [
        new MockRemoteTool({ name: 'search_pages', invoke: searchInvoke }),
        new MockRemoteTool({ name: 'get_page', invoke: getInvoke }),
      ];
      const { model } = makeLoopModel(
        [
          ['search_pages', { query: 'q' }],
          ['get_page', { pageId: 'p1' }],
        ],
        'Read the page.',
      );
      const run = (incomingPendingData?: unknown) =>
        new McpStepExecutor(makeContext({ runStore: store, model, incomingPendingData }), tools)
          .execute()
          .then(r => r.stepOutcome.status);

      const statuses = [
        await run(),
        await run({ userConfirmed: true }),
        await run({ userConfirmed: true }),
      ];

      expect(statuses).toEqual(['awaiting-input', 'awaiting-input', 'success']);
      expect(searchInvoke).toHaveBeenCalledTimes(1);
      expect(getInvoke).toHaveBeenCalledTimes(1);
      const [persisted] = (await store.getStepExecutions('run-1')) as McpStepExecutionData[];
      expect(persisted).toMatchObject({
        toolCalls: [
          executedCall('search_pages', { query: 'q' }, { pageId: 'p1' }),
          executedCall('get_page', { pageId: 'p1' }, 'page body'),
        ],
        executionResult: {
          success: true,
          toolResult: 'page body',
          formattedResponse: 'Read the page.',
        },
        idempotencyPhase: 'done',
      });
    });

    it('re-emits awaiting-input without running the next call when re-dispatched before the user answers', async () => {
      const store = new InMemoryStore();
      const searchInvoke = jest.fn().mockResolvedValue('p1');
      const getInvoke = jest.fn();
      const tools = [
        new MockRemoteTool({ name: 'search_pages', invoke: searchInvoke }),
        new MockRemoteTool({ name: 'get_page', invoke: getInvoke }),
      ];
      const { model } = makeLoopModel([
        ['search_pages', {}],
        ['get_page', {}],
      ]);
      const run = (incomingPendingData?: unknown) =>
        new McpStepExecutor(makeContext({ runStore: store, model, incomingPendingData }), tools)
          .execute()
          .then(r => r.stepOutcome.status);

      await run();
      await run({ userConfirmed: true });
      const redispatched = await run();

      expect(redispatched).toBe('awaiting-input');
      expect(getInvoke).not.toHaveBeenCalled();
    });
  });

  describe('activity log', () => {
    it('opens one activity-log entry per executed call', async () => {
      const activityLogPort = makeActivityLogPort();
      const tools = [
        new MockRemoteTool({ name: 'search_pages' }),
        new MockRemoteTool({ name: 'get_page' }),
      ];
      const { model } = makeLoopModel([
        ['search_pages', {}],
        ['get_page', {}],
      ]);
      const context = makeContext({
        model,
        activityLogPort,
        stepDefinition: makeStep({
          executionType: StepExecutionMode.FullyAutomated,
          mcpServerId: 'my-mcp-server',
        }),
      });

      await new McpStepExecutor(context, tools).execute();

      expect(activityLogPort.createPending.mock.calls).toEqual([
        [expect.objectContaining({ label: 'my-mcp-server', type: 'write' })],
        [expect.objectContaining({ label: 'my-mcp-server', type: 'write' })],
      ]);
      expect(activityLogPort.markSucceeded).toHaveBeenCalledTimes(2);
    });

    it('logs against the run base record with collectionId, renderingId, action, type and mcpServerId as label', async () => {
      const tool = new MockRemoteTool({ name: 'send_notification', sourceId: 'mcp-server-1' });
      const { model } = makeMockModel('send_notification', { message: 'Hello' });
      const activityLogPort = {
        createPending: jest.fn().mockResolvedValue({ id: 'log-1', index: '0' }),
        markSucceeded: jest.fn().mockResolvedValue(undefined),
        markFailed: jest.fn().mockResolvedValue(undefined),
      };
      const context = makeContext({
        model,
        collectionId: 'col-1',
        stepDefinition: makeStep({
          executionType: StepExecutionMode.FullyAutomated,
          mcpServerId: 'my-mcp-server',
        }),
        activityLogPort,
      });
      const executor = new McpStepExecutor(context, [tool]);

      await executor.execute();

      expect(activityLogPort.createPending).toHaveBeenCalledWith({
        renderingId: 1,
        action: 'action',
        type: 'write',
        collectionId: 'col-1',
        recordId: [42],
        label: 'my-mcp-server',
      });
    });
  });

  describe('log context', () => {
    it('includes mcpServerId and mcpServerName in the start and completion log lines', async () => {
      const tool = new MockRemoteTool({ name: 'send_notification', sourceId: 'mcp-server-1' });
      const { model } = makeMockModel('send_notification', { message: 'Hello' });
      const logger = jest.fn();
      const context = makeContext({
        model,
        logger,
        stepDefinition: makeStep({
          executionType: StepExecutionMode.FullyAutomated,
          mcpServerId: 'my-mcp-server',
        }),
      });
      const executor = new McpStepExecutor(context, [tool], 'Production Slack');

      await executor.execute();

      expect(logger).toHaveBeenCalledWith(
        'Info',
        'Step execution started',
        expect.objectContaining({
          mcpServerId: 'my-mcp-server',
          mcpServerName: 'Production Slack',
        }),
      );
      expect(logger).toHaveBeenCalledWith(
        'Info',
        'Step execution completed',
        expect.objectContaining({
          mcpServerId: 'my-mcp-server',
          mcpServerName: 'Production Slack',
        }),
      );
    });

    it('logs mcpServerName as undefined when no server name was resolved', async () => {
      const logger = jest.fn();
      const context = makeContext({
        logger,
        stepDefinition: makeStep({ mcpServerId: 'id-missing' }),
      });
      const executor = new McpStepExecutor(context, []);

      await executor.execute();

      expect(logger).toHaveBeenCalledWith(
        'Error',
        'No MCP tools available for mcpServerId="id-missing"',
        expect.objectContaining({ mcpServerId: 'id-missing', mcpServerName: undefined }),
      );
    });
  });
});

// The executor's OAuth responsibility is the tool-call 401 retry and the re-auth pause mapping.
// authType identification, the credential lookup, list-tools retry and Bearer injection live in
// RemoteToolFetcher / StepExecutorFactory and are covered by their own suites.
describe('McpStepExecutor — OAuth2 tool-call re-authentication', () => {
  const authError = () => new Error('Request failed with status 401');

  function makeAutomated(invoke: jest.Mock) {
    const tool = new MockRemoteTool({
      name: 'send_notification',
      sourceId: 'mcp-server-1',
      invoke,
    });
    const { model } = makeMockModel('send_notification', { message: 'Hello' });
    const context = makeContext({
      model,
      stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
    });

    return { tool, context };
  }

  it('force-refreshes, rebuilds the tool, and retries once when the call returns 401', async () => {
    const { tool, context } = makeAutomated(jest.fn().mockRejectedValue(authError()));
    const freshInvoke = jest.fn().mockResolvedValue('ok-after-refresh');
    const freshTool = new MockRemoteTool({
      name: 'send_notification',
      sourceId: 'mcp-server-1',
      invoke: freshInvoke,
    });
    const reloadWithFreshAuth = jest.fn().mockResolvedValue([freshTool]);

    const result = await new McpStepExecutor(context, [tool], 'srv', reloadWithFreshAuth).execute();

    expect(result.stepOutcome.status).toBe('success');
    expect(reloadWithFreshAuth).toHaveBeenCalledTimes(1);
    expect(freshInvoke).toHaveBeenCalledWith({ message: 'Hello' });
  });

  it('retries the allowed tool after a 401 when the step carries an allow-list', async () => {
    const tools = [
      new MockRemoteTool({
        name: 'send_notification',
        invoke: jest.fn().mockRejectedValue(authError()),
      }),
      new MockRemoteTool({ name: 'delete_channel' }),
    ];
    const freshInvoke = jest.fn().mockResolvedValue('ok-after-refresh');
    const freshDeleteInvoke = jest.fn();
    const reloadWithFreshAuth = jest
      .fn()
      .mockResolvedValue([
        new MockRemoteTool({ name: 'send_notification', invoke: freshInvoke }),
        new MockRemoteTool({ name: 'delete_channel', invoke: freshDeleteInvoke }),
      ]);
    const { model, bindTools } = makeMockModel('send_notification', { message: 'Hello' });
    const context = makeContext({
      model,
      stepDefinition: makeStep({
        executionType: StepExecutionMode.FullyAutomated,
        allowedTools: ['send_notification'],
      }),
    });

    const result = await new McpStepExecutor(context, tools, 'srv', reloadWithFreshAuth).execute();

    expect(result.stepOutcome.status).toBe('success');
    const boundTools = bindTools.mock.calls[0][0] as Array<{ name: string }>;
    expect(boundTools.map(t => t.name)).toEqual(['send_notification', COMPLETE_STEP]);
    expect(freshInvoke).toHaveBeenCalledWith({ message: 'Hello' });
    expect(freshDeleteInvoke).not.toHaveBeenCalled();
  });

  it("pauses with awaiting-input/'needs-oauth-reauth' when the credential can no longer be refreshed", async () => {
    const { tool, context } = makeAutomated(jest.fn().mockRejectedValue(authError()));
    const reloadWithFreshAuth = jest.fn().mockRejectedValue(new OAuthReauthRequiredError('srv'));

    const result = await new McpStepExecutor(context, [tool], 'srv', reloadWithFreshAuth).execute();

    expect(result.stepOutcome).toMatchObject({
      status: 'awaiting-input',
      awaitingInputReason: 'needs-oauth-reauth',
    });
  });

  it("pauses with 'needs-oauth-reauth' when the retried call still returns 401", async () => {
    const { tool, context } = makeAutomated(jest.fn().mockRejectedValue(authError()));
    const freshTool = new MockRemoteTool({
      name: 'send_notification',
      sourceId: 'mcp-server-1',
      invoke: jest.fn().mockRejectedValue(authError()),
    });
    const reloadWithFreshAuth = jest.fn().mockResolvedValue([freshTool]);

    const result = await new McpStepExecutor(context, [tool], 'srv', reloadWithFreshAuth).execute();

    expect(result.stepOutcome).toMatchObject({
      status: 'awaiting-input',
      awaitingInputReason: 'needs-oauth-reauth',
    });
    expect(reloadWithFreshAuth).toHaveBeenCalledTimes(1);
  });

  it('does not refresh for a non-auth tool error — surfaces it as a step error', async () => {
    const { tool, context } = makeAutomated(jest.fn().mockRejectedValue(new Error('boom')));
    const reloadWithFreshAuth = jest.fn();

    const result = await new McpStepExecutor(context, [tool], 'srv', reloadWithFreshAuth).execute();

    expect(result.stepOutcome.status).toBe('error');
    expect(reloadWithFreshAuth).not.toHaveBeenCalled();
  });

  it('does not refresh on a 401 for a bearer/none step (no reload hook)', async () => {
    const { tool, context } = makeAutomated(jest.fn().mockRejectedValue(authError()));

    const result = await new McpStepExecutor(context, [tool], 'srv').execute();

    expect(result.stepOutcome.status).toBe('error');
  });

  it('surfaces a non-auth error from the retried call as a step error (not a reauth pause)', async () => {
    const { tool, context } = makeAutomated(jest.fn().mockRejectedValue(authError()));
    const freshTool = new MockRemoteTool({
      name: 'send_notification',
      sourceId: 'mcp-server-1',
      invoke: jest.fn().mockRejectedValue(new Error('downstream 500')),
    });
    const reloadWithFreshAuth = jest.fn().mockResolvedValue([freshTool]);

    const result = await new McpStepExecutor(context, [tool], 'srv', reloadWithFreshAuth).execute();

    expect(result.stepOutcome.status).toBe('error');
  });

  it('errors when the refreshed tool set no longer contains the selected tool', async () => {
    const { tool, context } = makeAutomated(jest.fn().mockRejectedValue(authError()));
    const reloadWithFreshAuth = jest.fn().mockResolvedValue([]);

    const result = await new McpStepExecutor(context, [tool], 'srv', reloadWithFreshAuth).execute();

    expect(result.stepOutcome.status).toBe('error');
  });
});

// On a re-auth pause the executor clears the 'executing' write-ahead marker so the resumed step is
// not rejected as interrupted; the failed tool call still surfaces as a failed audit-log entry.
describe('McpStepExecutor — re-auth pause hardening', () => {
  const authError = () => new Error('Request failed with status 401');

  // A FullyAutomated step whose tool call 401s and whose refresh cannot recover → re-auth pause.
  function pauseFor(runStore: ReturnType<typeof makeMockRunStore> | InMemoryStore) {
    const tool = new MockRemoteTool({
      name: 'send_notification',
      sourceId: 'mcp-server-1',
      invoke: jest.fn().mockRejectedValue(authError()),
    });
    const reloadWithFreshAuth = jest.fn().mockRejectedValue(new OAuthReauthRequiredError('srv'));
    const context = makeContext({
      runStore: runStore as RunStore,
      stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
    });

    return new McpStepExecutor(context, [tool], 'srv', reloadWithFreshAuth);
  }

  describe('idempotency phase cleared on the re-auth pause path', () => {
    it('does not leave the step execution marked executing after pausing for re-auth', async () => {
      // GIVEN a real store so the persisted write-ahead marker is observable.
      const store = new InMemoryStore();

      // WHEN the step pauses for re-authentication.
      const result = await pauseFor(store).execute();

      // THEN it pauses, and the 'executing' marker written by beforeCall must not survive — else
      // a resume would read a stale marker.
      expect(result.stepOutcome.status).toBe('awaiting-input');
      const persisted = await store.getStepExecutions('run-1');
      const mcpExecution = persisted.find(execution => execution.stepIndex === 0) as
        | McpStepExecutionData
        | undefined;
      expect(mcpExecution?.idempotencyPhase).not.toBe('executing');
    });

    it('resumes to success after a re-auth pause instead of failing as interrupted', async () => {
      // GIVEN a step that paused for re-auth, persisting its state in a shared store.
      const store = new InMemoryStore();
      const pause = await pauseFor(store).execute();
      expect(pause.stepOutcome.status).toBe('awaiting-input');

      // WHEN the user reconnects and the step is re-dispatched against the same store, with the
      // tool now succeeding.
      const reconnectedTool = new MockRemoteTool({
        name: 'send_notification',
        sourceId: 'mcp-server-1',
        invoke: jest.fn().mockResolvedValue('ok-after-reconnect'),
      });
      const resumeContext = makeContext({
        runStore: store,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });

      const resumed = await new McpStepExecutor(resumeContext, [reconnectedTool], 'srv').execute();

      // THEN checkIdempotency must not throw StepStateError on the stale 'executing' marker; the
      // step runs to success.
      expect(resumed.stepOutcome.status).toBe('success');
    });

    it('preserves the approved pendingData on a confirmation-flow re-auth pause so resume replays it', async () => {
      // GIVEN a confirmation-flow step with a user-approved tool call already persisted.
      const store = new InMemoryStore();
      await store.saveStepExecution('run-1', {
        type: 'mcp',
        stepIndex: 0,
        pendingData: {
          name: 'send_notification',
          sourceId: 'mcp-server-1',
          input: { message: 'Hello' },
        },
        userConfirmation: { userConfirmed: true },
      } as McpStepExecutionData);
      const tool = new MockRemoteTool({
        name: 'send_notification',
        sourceId: 'mcp-server-1',
        invoke: jest.fn().mockRejectedValue(authError()),
      });
      const reloadWithFreshAuth = jest.fn().mockRejectedValue(new OAuthReauthRequiredError('srv'));
      const context = makeContext({ runStore: store });

      // WHEN the approved call 401s and cannot re-auth.
      const result = await new McpStepExecutor(
        context,
        [tool],
        'srv',
        reloadWithFreshAuth,
      ).execute();

      // THEN the marker is cleared but the approved call is kept, so a resume replays it rather than
      // re-selecting a tool.
      expect(result.stepOutcome.status).toBe('awaiting-input');
      const persisted = (await store.getStepExecutions('run-1')).find(e => e.stepIndex === 0) as
        | McpStepExecutionData
        | undefined;
      expect(persisted?.idempotencyPhase).not.toBe('executing');
      expect(persisted?.pendingData).toEqual({
        name: 'send_notification',
        sourceId: 'mcp-server-1',
        input: { message: 'Hello' },
      });
    });

    it('keeps the completed calls on a re-auth pause after a call ran, and resumes from them after reconnecting', async () => {
      // GIVEN a FullyAutomated loop whose first call succeeds and whose second call 401s with a
      // credential that can no longer be refreshed.
      const store = new InMemoryStore();
      const searchInvoke = jest.fn().mockResolvedValue({ pageId: 'p1' });
      const stepDefinition = makeStep({ executionType: StepExecutionMode.FullyAutomated });
      const { model: pausingModel } = makeLoopModel([
        ['search_pages', { query: 'q' }],
        ['get_page', { pageId: 'p1' }],
      ]);
      const pause = await new McpStepExecutor(
        makeContext({ runStore: store, model: pausingModel, stepDefinition }),
        [
          new MockRemoteTool({ name: 'search_pages', invoke: searchInvoke }),
          new MockRemoteTool({
            name: 'get_page',
            invoke: jest.fn().mockRejectedValue(authError()),
          }),
        ],
        'srv',
        jest.fn().mockRejectedValue(new OAuthReauthRequiredError('srv')),
      ).execute();

      // THEN the step pauses, keeping the completed call without the write-ahead marker.
      expect(pause.stepOutcome).toMatchObject({
        status: 'awaiting-input',
        awaitingInputReason: 'needs-oauth-reauth',
      });
      const [paused] = (await store.getStepExecutions('run-1')) as McpStepExecutionData[];
      expect(paused.toolCalls).toEqual([
        executedCall('search_pages', { query: 'q' }, { pageId: 'p1' }),
      ]);
      expect(paused.idempotencyPhase).toBeUndefined();

      // WHEN the user reconnects and the step is re-dispatched.
      const getInvoke = jest.fn().mockResolvedValue('page body');
      const { model: resumedModel, invoke: resumedModelInvoke } = makeLoopModel([
        ['get_page', { pageId: 'p1' }],
      ]);
      const resumed = await new McpStepExecutor(
        makeContext({ runStore: store, model: resumedModel, stepDefinition }),
        [
          new MockRemoteTool({ name: 'search_pages', invoke: searchInvoke }),
          new MockRemoteTool({ name: 'get_page', invoke: getInvoke }),
        ],
        'srv',
      ).execute();

      // THEN the AI continues from the completed call, which never runs twice.
      expect(resumed.stepOutcome.status).toBe('success');
      expect(searchInvoke).toHaveBeenCalledTimes(1);
      expect(getInvoke).toHaveBeenCalledWith({ pageId: 'p1' });
      expect(requestSentOnDecision(resumedModelInvoke, 0)).toContain('{"pageId":"p1"}');
      const [finished] = (await store.getStepExecutions('run-1')) as McpStepExecutionData[];
      expect(finished.toolCalls).toEqual([
        executedCall('search_pages', { query: 'q' }, { pageId: 'p1' }),
        executedCall('get_page', { pageId: 'p1' }, 'page body'),
      ]);
      expect(finished.idempotencyPhase).toBe('done');
    });

    it('surfaces a store error from the re-auth cleanup as a step error, not a stuck pause', async () => {
      // GIVEN cleanup that fails — a left-behind 'executing' marker would make the pause
      // non-resumable, so the failure must surface as an error rather than a stuck awaiting-input.
      const store = new InMemoryStore();
      jest
        .spyOn(store, 'deleteStepExecution')
        .mockRejectedValue(new RunStorePortError('deleteStepExecution', new Error('store down')));

      // WHEN a FullyAutomated step pauses for re-auth (no pendingData → cleanup goes via delete).
      const result = await pauseFor(store).execute();

      // THEN the store failure propagates to a step error instead of a non-resumable pause.
      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe('The step state could not be accessed. Please retry.');
    });

    it('clears the executing marker when the refresh fails with a non-auth error, leaving the step retryable', async () => {
      // GIVEN a 401 that triggers a refresh which then fails with a non-auth error (e.g. the token
      // endpoint is unreachable): nothing executed, so the step must stay retryable, not wedged.
      const store = new InMemoryStore();
      const tool = new MockRemoteTool({
        name: 'send_notification',
        sourceId: 'mcp-server-1',
        invoke: jest.fn().mockRejectedValue(authError()),
      });
      const reloadWithFreshAuth = jest
        .fn()
        .mockRejectedValue(new Error('token endpoint unreachable'));
      const context = makeContext({
        runStore: store,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });

      // WHEN the refresh path fails with a non-auth error.
      const result = await new McpStepExecutor(
        context,
        [tool],
        'srv',
        reloadWithFreshAuth,
      ).execute();

      // THEN it surfaces as a step error (not a re-auth pause), and the 'executing' marker is gone so
      // a retry is not rejected as interrupted.
      expect(result.stepOutcome.status).toBe('error');
      const persisted = (await store.getStepExecutions('run-1')).find(e => e.stepIndex === 0) as
        | McpStepExecutionData
        | undefined;
      expect(persisted?.idempotencyPhase).not.toBe('executing');
    });

    it('clears the executing marker when the reload yields no matching tool, leaving the step retryable', async () => {
      // The reload succeeds but returns no tool (empty on a connection failure); the 401 first call
      // never ran, so the step must stay retryable rather than wedged as interrupted.
      const store = new InMemoryStore();
      const tool = new MockRemoteTool({
        name: 'send_notification',
        sourceId: 'mcp-server-1',
        invoke: jest.fn().mockRejectedValue(authError()),
      });
      const reloadWithFreshAuth = jest.fn().mockResolvedValue([]);
      const context = makeContext({
        runStore: store,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });

      const result = await new McpStepExecutor(
        context,
        [tool],
        'srv',
        reloadWithFreshAuth,
      ).execute();

      expect(result.stepOutcome.status).toBe('error');
      const persisted = (await store.getStepExecutions('run-1')).find(e => e.stepIndex === 0) as
        | McpStepExecutionData
        | undefined;
      expect(persisted?.idempotencyPhase).not.toBe('executing');
    });
  });

  describe('re-auth pause surfaces the tool-call failure in the audit log', () => {
    it('marks the activity-log entry failed while the step pauses for re-auth', async () => {
      // GIVEN an activity-log port we can inspect.
      const activityLogPort = {
        createPending: jest.fn().mockResolvedValue({ id: 'log-1', index: '0' }),
        markSucceeded: jest.fn().mockResolvedValue(undefined),
        markFailed: jest.fn().mockResolvedValue(undefined),
      };
      const tool = new MockRemoteTool({
        name: 'send_notification',
        sourceId: 'mcp-server-1',
        invoke: jest.fn().mockRejectedValue(authError()),
      });
      const reloadWithFreshAuth = jest.fn().mockRejectedValue(new OAuthReauthRequiredError('srv'));
      const context = makeContext({
        activityLogPort,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });

      // WHEN the step pauses for re-authentication.
      const result = await new McpStepExecutor(
        context,
        [tool],
        'srv',
        reloadWithFreshAuth,
      ).execute();

      // THEN the failed tool call is audited as failed, while the step itself pauses (not errors).
      expect(result.stepOutcome.status).toBe('awaiting-input');
      expect(activityLogPort.createPending).toHaveBeenCalledTimes(1);
      expect(activityLogPort.markFailed).toHaveBeenCalledTimes(1);
      expect(activityLogPort.markSucceeded).not.toHaveBeenCalled();
    });
  });
});
