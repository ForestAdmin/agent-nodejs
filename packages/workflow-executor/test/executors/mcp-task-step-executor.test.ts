import type { RunStore } from '../../src/ports/run-store';
import type { WorkflowPort } from '../../src/ports/workflow-port';
import type { ExecutionContext } from '../../src/types/execution';
import type { McpTaskStepDefinition } from '../../src/types/step-definition';
import type { McpTaskStepExecutionData } from '../../src/types/step-execution-data';

import RemoteTool from '@forestadmin/ai-proxy/src/remote-tool';

import { StepStateError } from '../../src/errors';
import McpTaskStepExecutor from '../../src/executors/mcp-task-step-executor';
import { StepType } from '../../src/types/step-definition';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

class MockRemoteTool extends RemoteTool {
  constructor(options: { name: string; sourceId?: string; invoke?: jest.Mock }) {
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
    });
  }
}

function makeStep(overrides: Partial<McpTaskStepDefinition> = {}): McpTaskStepDefinition {
  return {
    type: StepType.McpTask,
    prompt: 'Send a notification to the user',
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
    getPendingStepExecutions: jest.fn().mockResolvedValue([]),
    getPendingStepExecutionsForRun: jest.fn().mockResolvedValue(null),
    updateStepExecution: jest.fn().mockResolvedValue(undefined),
    getCollectionSchema: jest.fn().mockResolvedValue({
      collectionName: 'customers',
      collectionDisplayName: 'Customers',
      primaryKeyFields: ['id'],
      fields: [],
      actions: [],
    }),
    getMcpServerConfigs: jest.fn().mockResolvedValue([]),
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
  overrides: Partial<ExecutionContext<McpTaskStepDefinition>> = {},
): ExecutionContext<McpTaskStepDefinition> {
  return {
    runId: 'run-1',
    stepId: 'mcp-1',
    stepIndex: 0,
    baseRecordRef: { collectionName: 'customers', recordId: [42], stepIndex: 0 },
    stepDefinition: makeStep(),
    model: makeMockModel('send_notification', { message: 'Hello' }).model,
    agentPort: {
      getRecord: jest.fn(),
      updateRecord: jest.fn(),
      getRelatedData: jest.fn(),
      executeAction: jest.fn(),
    } as unknown as ExecutionContext['agentPort'],
    workflowPort: makeMockWorkflowPort(),
    runStore: makeMockRunStore(),
    schemaCache: new Map(),
    previousSteps: [],
    logger: { error: jest.fn() },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('McpTaskStepExecutor', () => {
  describe('automaticExecution: direct execution (Branch B)', () => {
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
        stepDefinition: makeStep({ automaticExecution: true }),
      });
      const executor = new McpTaskStepExecutor(context, [tool]);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(invokeFn).toHaveBeenCalledWith({ message: 'Hello' });
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          type: 'mcp-task',
          stepIndex: 0,
          executionParams: { name: 'send_notification', input: { message: 'Hello' } },
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
        stepDefinition: makeStep({ automaticExecution: true }),
      });
      const executor = new McpTaskStepExecutor(context, [tool]);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(modelInvoke).toHaveBeenCalledTimes(2);
      // First save: raw result only
      expect(runStore.saveStepExecution).toHaveBeenNthCalledWith(
        1,
        'run-1',
        expect.objectContaining({
          executionResult: { success: true, toolResult },
        }),
      );
      // Second save: raw result + formattedResponse
      expect(runStore.saveStepExecution).toHaveBeenNthCalledWith(
        2,
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
      const logger = { error: jest.fn() };
      const runStore = makeMockRunStore();
      const context = makeContext({
        model,
        runStore,
        stepDefinition: makeStep({ automaticExecution: true }),
        logger,
      });
      const executor = new McpTaskStepExecutor(context, [tool]);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      // Only the first save (raw result) — no second save since formatting failed
      expect(runStore.saveStepExecution).toHaveBeenCalledTimes(1);
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionResult: { success: true, toolResult: { result: 'ok' } },
        }),
      );
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to format MCP tool result, using generic fallback',
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
        stepDefinition: makeStep({ automaticExecution: true }),
      });
      const executor = new McpTaskStepExecutor(context, [tool]);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      // Model called only once (tool selection) — no formatting call for null result
      expect(modelInvoke).toHaveBeenCalledTimes(1);
      expect(runStore.saveStepExecution).toHaveBeenCalledTimes(1);
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionResult: { success: true, toolResult: null },
        }),
      );
    });
  });

  describe('without automaticExecution: awaiting-input (Branch C)', () => {
    it('saves pendingData and returns awaiting-input', async () => {
      const { model } = makeMockModel('send_notification', { message: 'Hello' });
      const runStore = makeMockRunStore();
      const tool = new MockRemoteTool({ name: 'send_notification', sourceId: 'mcp-server-1' });
      const context = makeContext({ model, runStore });
      const executor = new McpTaskStepExecutor(context, [tool]);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('awaiting-input');
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          type: 'mcp-task',
          stepIndex: 0,
          pendingData: { name: 'send_notification', input: { message: 'Hello' } },
        }),
      );
    });

    it('returns error when saveStepExecution fails (Branch C)', async () => {
      const { model } = makeMockModel('send_notification', { message: 'Hello' });
      const logger = { error: jest.fn() };
      const runStore = makeMockRunStore({
        saveStepExecution: jest.fn().mockRejectedValue(new Error('DB unavailable')),
      });
      const tool = new MockRemoteTool({ name: 'send_notification', sourceId: 'mcp-server-1' });
      const context = makeContext({ model, runStore, logger });
      const executor = new McpTaskStepExecutor(context, [tool]);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe('The step result could not be saved. Please retry.');
      expect(logger.error).toHaveBeenCalledWith(
        'MCP task step state could not be persisted (run "run-1", step 0)',
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
      const execution: McpTaskStepExecutionData = {
        type: 'mcp-task',
        stepIndex: 0,
        pendingData: {
          name: 'send_notification',
          input: { message: 'Hello' },
          userConfirmed: true,
        },
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const context = makeContext({ runStore });
      const executor = new McpTaskStepExecutor(context, [tool]);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(invokeFn).toHaveBeenCalledWith({ message: 'Hello' });
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          type: 'mcp-task',
          executionParams: { name: 'send_notification', input: { message: 'Hello' } },
          executionResult: { success: true, toolResult: 'email sent' },
          pendingData: {
            name: 'send_notification',
            input: { message: 'Hello' },
            userConfirmed: true,
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
      const execution: McpTaskStepExecutionData = {
        type: 'mcp-task',
        stepIndex: 0,
        pendingData: {
          name: 'send_notification',
          input: { message: 'Hello' },
          userConfirmed: false,
        },
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const context = makeContext({ runStore });
      const executor = new McpTaskStepExecutor(context, [tool]);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('success');
      expect(invokeFn).not.toHaveBeenCalled();
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          executionResult: { skipped: true },
          pendingData: {
            name: 'send_notification',
            input: { message: 'Hello' },
            userConfirmed: false,
          },
        }),
      );
    });
  });

  describe('mcpServerId filter', () => {
    it('passes only tools from the specified server to the AI', async () => {
      const toolA = new MockRemoteTool({ name: 'tool_a', sourceId: 'server-A' });
      const toolB = new MockRemoteTool({ name: 'tool_b', sourceId: 'server-B' });
      const invokeFn = jest.fn().mockResolvedValue('ok');
      const toolB2 = new MockRemoteTool({
        name: 'tool_b2',
        sourceId: 'server-B',
        invoke: invokeFn,
      });

      const { model, bindTools } = makeMockModel('tool_b', {});
      const runStore = makeMockRunStore();
      const context = makeContext({
        model,
        runStore,
        stepDefinition: makeStep({ mcpServerId: 'server-B', automaticExecution: true }),
      });
      const executor = new McpTaskStepExecutor(context, [toolA, toolB, toolB2]);

      await executor.execute();

      // bindTools should only receive server-B tools
      const boundTools = bindTools.mock.calls[0][0] as Array<{ name: string }>;
      const boundNames = boundTools.map(t => t.name);
      expect(boundNames).not.toContain('tool_a');
      expect(boundNames).toContain('tool_b');
      expect(boundNames).toContain('tool_b2');
    });
  });

  describe('NoMcpToolsError', () => {
    it('returns error when remoteTools is empty', async () => {
      const context = makeContext();
      const executor = new McpTaskStepExecutor(context, []);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe('No tools are available to execute this step.');
    });

    it('returns error when mcpServerId filter yields no tools', async () => {
      const tool = new MockRemoteTool({ name: 'tool_a', sourceId: 'server-A' });
      const context = makeContext({
        stepDefinition: makeStep({ mcpServerId: 'server-B' }),
      });
      const executor = new McpTaskStepExecutor(context, [tool]);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe('No tools are available to execute this step.');
    });
  });

  describe('McpToolNotFoundError', () => {
    it('returns error when tool from pendingData no longer exists (Branch A)', async () => {
      const execution: McpTaskStepExecutionData = {
        type: 'mcp-task',
        stepIndex: 0,
        pendingData: { name: 'deleted_tool', input: {}, userConfirmed: true },
      };
      const tool = new MockRemoteTool({ name: 'other_tool', sourceId: 'mcp-server-1' });
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const context = makeContext({ runStore });
      const executor = new McpTaskStepExecutor(context, [tool]);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe(
        "The AI selected a tool that doesn't exist. Try rephrasing the step's prompt.",
      );
      expect(runStore.saveStepExecution).not.toHaveBeenCalled();
    });
  });

  describe('StepPersistenceError', () => {
    it('returns error and logs cause when saveStepExecution fails after tool invocation (Branch B)', async () => {
      const invokeFn = jest.fn().mockResolvedValue('ok');
      const tool = new MockRemoteTool({
        name: 'send_notification',
        sourceId: 'mcp-server-1',
        invoke: invokeFn,
      });
      const { model } = makeMockModel('send_notification', { message: 'Hello' });
      const logger = { error: jest.fn() };
      const runStore = makeMockRunStore({
        saveStepExecution: jest.fn().mockRejectedValue(new Error('Disk full')),
      });
      const context = makeContext({
        model,
        runStore,
        stepDefinition: makeStep({ automaticExecution: true }),
        logger,
      });
      const executor = new McpTaskStepExecutor(context, [tool]);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe('The step result could not be saved. Please retry.');
      expect(logger.error).toHaveBeenCalledWith(
        'MCP tool "send_notification" executed but step state could not be persisted (run "run-1", step 0)',
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
      const execution: McpTaskStepExecutionData = {
        type: 'mcp-task',
        stepIndex: 0,
        pendingData: {
          name: 'send_notification',
          input: { message: 'Hello' },
          userConfirmed: true,
        },
      };
      const logger = { error: jest.fn() };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
        saveStepExecution: jest.fn().mockRejectedValue(new Error('Disk full')),
      });
      const context = makeContext({ runStore, logger });
      const executor = new McpTaskStepExecutor(context, [tool]);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(result.stepOutcome.error).toBe('The step result could not be saved. Please retry.');
      expect(logger.error).toHaveBeenCalledWith(
        'MCP tool "send_notification" executed but step state could not be persisted (run "run-1", step 0)',
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
        stepDefinition: makeStep({ automaticExecution: true }),
      });
      const executor = new McpTaskStepExecutor(context, [tool]);

      const result = await executor.execute();

      expect(result.stepOutcome).toMatchObject({
        type: 'mcp-task',
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
      const executor = new McpTaskStepExecutor(context, []);

      await expect(executor.execute()).resolves.toMatchObject({
        stepOutcome: {
          status: 'error',
          error: 'No tools are available to execute this step.',
        },
      });
    });

    it('returns error when execution exists but pendingData is absent', async () => {
      const execution: McpTaskStepExecutionData = {
        type: 'mcp-task',
        stepIndex: 0,
      };
      const runStore = makeMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([execution]),
      });
      const context = makeContext({ runStore });
      const executor = new McpTaskStepExecutor(context, []);

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
        stepDefinition: makeStep({ automaticExecution: true }),
      });
      const executor = new McpTaskStepExecutor(context, [tool]);

      const result = await executor.execute();

      expect(result.stepOutcome.status).toBe('error');
      expect(mockRunStore.saveStepExecution).not.toHaveBeenCalled();
    });

    it('returns error and logs when tool invocation throws an infrastructure error', async () => {
      const invokeFn = jest.fn().mockRejectedValue(new Error('Connection refused'));
      const tool = new MockRemoteTool({
        name: 'send_notification',
        sourceId: 'mcp-server-1',
        invoke: invokeFn,
      });
      const { model } = makeMockModel('send_notification', {});
      const logger = { error: jest.fn() };
      const context = makeContext({
        model,
        stepDefinition: makeStep({ automaticExecution: true }),
        logger,
      });
      const executor = new McpTaskStepExecutor(context, [tool]);

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
      const executor = new McpTaskStepExecutor(context, [tool]);

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
      const executor = new McpTaskStepExecutor(context, [tool]);

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
      const executor = new McpTaskStepExecutor(context, [tool]);

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
      const executor = new McpTaskStepExecutor({ ...context, stepId: 'mcp-2', stepIndex: 1 }, [
        tool,
      ]);

      await executor.execute();

      const messages = modelInvoke.mock.calls[0][0];
      // previous steps message + system prompt + human message = 3
      expect(messages).toHaveLength(3);
      expect(messages[0].content).toContain('Should we send a notification?');
    });
  });
});
