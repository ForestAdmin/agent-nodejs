import type { ActivityLogPort } from '../../src/ports/activity-log-port';
import type { AgentPort } from '../../src/ports/agent-port';
import type { RunStore } from '../../src/ports/run-store';
import type { WorkflowPort } from '../../src/ports/workflow-port';
import type { ExecutionContext } from '../../src/types/execution-context';
import type { McpStepExecutionData } from '../../src/types/step-execution-data';
import type { McpStepDefinition } from '../../src/types/validated/step-definition';

import RemoteTool from '@forestadmin/ai-proxy/src/remote-tool';

import { RunStorePortError, StepStateError } from '../../src/errors';
import ActivityLogger from '../../src/executors/activity-logger';
import AgentWithLog from '../../src/executors/agent-with-log';
import McpStepExecutor from '../../src/executors/mcp-step-executor';
import SchemaCache from '../../src/schema-cache';
import SchemaResolver from '../../src/schema-resolver';
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
  };
}

function makeMockModel(toolName: string, toolArgs: Record<string, unknown>) {
  const invoke = jest.fn().mockResolvedValue({
    tool_calls: [{ name: toolName, args: toolArgs, id: 'call_1' }],
  });
  const bindTools = jest.fn().mockReturnValue({ invoke });
  const model = { bindTools } as unknown as ExecutionContext['model'];

  return { model, bindTools, invoke };
}

function makeContext(
  overrides: Partial<ExecutionContext<McpStepDefinition>> & {
    agentPort?: AgentPort;
    activityLogPort?: ActivityLogPort;
    activityLogger?: ActivityLogger;
    workflowPort?: WorkflowPort;
  } = {},
): ExecutionContext<McpStepDefinition> {
  const runId = overrides.runId ?? 'run-1';
  const workflowPort = overrides.workflowPort ?? makeMockWorkflowPort();
  const schemaCache = new SchemaCache();

  const base: Omit<ExecutionContext<McpStepDefinition>, 'agent' | 'activityLogger'> = {
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
    schemaResolver: new SchemaResolver(schemaCache, workflowPort, runId),
    previousSteps: [],
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    ...overrides,
  };

  const activityLogger =
    overrides.activityLogger ??
    new ActivityLogger(
      overrides.activityLogPort ?? {
        createPending: jest.fn().mockResolvedValue({ id: 'log-1', index: '0' }),
        markSucceeded: jest.fn().mockResolvedValue(undefined),
        markFailed: jest.fn().mockResolvedValue(undefined),
      },
      base.user,
    );

  return {
    ...base,
    activityLogger,
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
        activityLogger,
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
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          type: 'mcp',
          stepIndex: 0,
          executionParams: {
            name: 'send_notification',
            sourceId: 'mcp-server-1',
            input: { message: 'Hello' },
          },
          executionResult: { success: true, toolResult: { result: 'notification sent' } },
        }),
      );
      // Model is invoked twice: once for tool selection, once for AI formatting
      expect(modelInvoke).toHaveBeenCalledTimes(2);
    });

    it('persists formattedResponse when AI formatting succeeds', async () => {
      const toolResult = { result: 'notification sent' };
      const invokeFn = jest.fn().mockResolvedValue(toolResult);
      const tool = new MockRemoteTool({
        name: 'send_notification',
        sourceId: 'mcp-server-1',
        invoke: invokeFn,
      });
      const { model, invoke: modelInvoke } = makeMockModel('send_notification', {
        message: 'Hello',
      });
      // Second model call (formatting) returns a summary
      modelInvoke
        .mockResolvedValueOnce({
          tool_calls: [{ name: 'send_notification', args: { message: 'Hello' }, id: 'call_1' }],
        })
        .mockResolvedValueOnce({
          tool_calls: [
            { name: 'summarize-result', args: { summary: 'Found 3 results.' }, id: 'call_2' },
          ],
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
      expect(modelInvoke).toHaveBeenCalledTimes(2);
      // First save: executing marker (before tool call)
      expect(runStore.saveStepExecution).toHaveBeenNthCalledWith(
        1,
        'run-1',
        expect.objectContaining({ idempotencyPhase: 'executing' }),
      );
      // Second save: raw result with done marker
      expect(runStore.saveStepExecution).toHaveBeenNthCalledWith(
        2,
        'run-1',
        expect.objectContaining({
          executionResult: { success: true, toolResult },
          idempotencyPhase: 'done',
        }),
      );
      // Third save: raw result + formattedResponse
      expect(runStore.saveStepExecution).toHaveBeenNthCalledWith(
        3,
        'run-1',
        expect.objectContaining({
          executionResult: { success: true, toolResult, formattedResponse: 'Found 3 results.' },
        }),
      );
    });

    it('returns success and logs when AI formatting throws', async () => {
      const invokeFn = jest.fn().mockResolvedValue({ result: 'ok' });
      const tool = new MockRemoteTool({
        name: 'send_notification',
        sourceId: 'mcp-server-1',
        invoke: invokeFn,
      });
      const { model, invoke: modelInvoke } = makeMockModel('send_notification', { message: 'Hi' });
      // Second call (formatting) returns no tool calls → MissingToolCallError
      modelInvoke
        .mockResolvedValueOnce({
          tool_calls: [{ name: 'send_notification', args: { message: 'Hi' }, id: 'call_1' }],
        })
        .mockResolvedValueOnce({ tool_calls: [] });
      const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
      const runStore = makeMockRunStore();
      const context = makeContext({
        model,
        runStore,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
        logger,
      });
      const executor = new McpStepExecutor(context, [tool]);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      // Two saves: executing marker, then raw result with done marker (no third save since formatting failed)
      expect(runStore.saveStepExecution).toHaveBeenCalledTimes(2);
      expect(runStore.saveStepExecution).toHaveBeenNthCalledWith(
        2,
        'run-1',
        expect.objectContaining({
          executionResult: { success: true, toolResult: { result: 'ok' } },
        }),
      );
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to format MCP tool result, persisting raw result without summary',
        expect.objectContaining({ toolName: 'send_notification' }),
      );
    });

    it('does not call AI formatting when toolResult is null', async () => {
      const invokeFn = jest.fn().mockResolvedValue(null);
      const tool = new MockRemoteTool({
        name: 'send_notification',
        sourceId: 'mcp-server-1',
        invoke: invokeFn,
      });
      const { model, invoke: modelInvoke } = makeMockModel('send_notification', { message: 'Hi' });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model,
        runStore,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
      const executor = new McpStepExecutor(context, [tool]);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      // Model called only once (tool selection) — no formatting call for null result
      expect(modelInvoke).toHaveBeenCalledTimes(1);
      // Two saves: executing marker, then raw result with done marker
      expect(runStore.saveStepExecution).toHaveBeenCalledTimes(2);
      expect(runStore.saveStepExecution).toHaveBeenNthCalledWith(
        2,
        'run-1',
        expect.objectContaining({
          executionResult: { success: true, toolResult: null },
        }),
      );
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
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          type: 'mcp',
          stepIndex: 0,
          pendingData: {
            name: 'send_notification',
            sourceId: 'mcp-server-1',
            input: { message: 'Hello' },
          },
        }),
      );
    });

    it('returns error when saveStepExecution fails (Branch C)', async () => {
      const { model } = makeMockModel('send_notification', { message: 'Hello' });
      const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
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
      expect(logger.error).toHaveBeenCalledWith(
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
      const context = makeContext({ runStore });
      const executor = new McpStepExecutor(context, [tool]);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(invokeFn).toHaveBeenCalledWith({ message: 'Hello' });
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          type: 'mcp',
          executionParams: {
            name: 'send_notification',
            sourceId: 'mcp-server-1',
            input: { message: 'Hello' },
          },
          executionResult: { success: true, toolResult: 'email sent' },
          pendingData: {
            name: 'send_notification',
            sourceId: 'mcp-server-1',
            input: { message: 'Hello' },
          },
        }),
      );
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
  });

  describe('forwards all provided remoteTools to the AI', () => {
    // Tools are pre-scoped upstream — the executor must not re-filter. Mixing divergent
    // mcpServerId values in the input asserts the executor passes every tool through, even
    // ones that wouldn't match the step's mcpServerId on their own.
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
      expect(boundTools.map(t => t.name)).toEqual(['zendesk_get_tickets']);
      expect(invokeFn).toHaveBeenCalled();
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
      const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
      const context = makeContext({
        logger,
        stepDefinition: makeStep({ mcpServerId: 'id-missing' }),
      });
      const executor = new McpStepExecutor(context, []);

      await executor.execute();

      // BaseStepExecutor catches NoMcpToolsError and logs error.message (which encodes the
      // requested mcpServerId) along with the step correlation context.
      expect(logger.error).toHaveBeenCalledWith(
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
      const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
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
      expect(logger.error).toHaveBeenCalledWith(
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
      const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
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
      expect(logger.error).toHaveBeenCalledWith(
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
      const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
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
      expect(logger.error).toHaveBeenCalledWith(
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

    it('saves executing marker before side effect and done marker with executionResult after', async () => {
      const toolInvoke = jest.fn().mockResolvedValue('tool-result');
      const tool = new MockRemoteTool({ name: 'send_notification', invoke: toolInvoke });
      const { model } = makeMockModel('send_notification', { message: 'Hello' });
      const runStore = makeMockRunStore();
      const context = makeContext({
        model,
        runStore,
        stepDefinition: makeStep({ executionType: StepExecutionMode.FullyAutomated }),
      });
      const executor = new McpStepExecutor(context, [tool]);

      await executor.execute();

      const { calls } = (runStore.saveStepExecution as jest.Mock).mock;
      // First: 'executing'; Second: 'done' with executionResult (no formattedResponse model call)
      expect(calls[0][1]).toMatchObject({
        type: 'mcp',
        stepIndex: 0,
        idempotencyPhase: 'executing',
      });
      expect(calls[0][1]).not.toHaveProperty('executionResult');
      expect(calls[1][1]).toMatchObject({
        type: 'mcp',
        stepIndex: 0,
        idempotencyPhase: 'done',
        executionResult: { success: true, toolResult: 'tool-result' },
      });
    });
  });

  describe('activity log', () => {
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
      const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
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

      expect(logger.info).toHaveBeenCalledWith(
        'Step execution started',
        expect.objectContaining({
          mcpServerId: 'my-mcp-server',
          mcpServerName: 'Production Slack',
        }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Step execution completed',
        expect.objectContaining({
          mcpServerId: 'my-mcp-server',
          mcpServerName: 'Production Slack',
        }),
      );
    });

    it('logs mcpServerName as undefined when no server name was resolved', async () => {
      const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
      const context = makeContext({
        logger,
        stepDefinition: makeStep({ mcpServerId: 'id-missing' }),
      });
      const executor = new McpStepExecutor(context, []);

      await executor.execute();

      expect(logger.error).toHaveBeenCalledWith(
        'No MCP tools available for mcpServerId="id-missing"',
        expect.objectContaining({ mcpServerId: 'id-missing', mcpServerName: undefined }),
      );
    });
  });
});
