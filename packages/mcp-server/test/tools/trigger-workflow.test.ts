import type { ForestServerClient } from '../../src/http-client';
import type { Logger } from '../../src/server';
import type { RegisteredToolConfig } from '../helpers/registered-tool-config';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import { ForbiddenError, HttpError, NotFoundError } from '@forestadmin/forestadmin-client';

import declareTriggerWorkflowTool from '../../src/tools/trigger-workflow';
import createMockForestServerClient from '../helpers/forest-server-client';

const mockLogger: Logger = jest.fn();

describe('declareTriggerWorkflowTool', () => {
  let mcpServer: McpServer;
  let mockForestServerClient: jest.Mocked<ForestServerClient>;
  let registeredToolHandler: (args: unknown, extra: unknown) => Promise<unknown>;
  let registeredToolConfig: RegisteredToolConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    mockForestServerClient = createMockForestServerClient();

    mcpServer = {
      registerTool: jest.fn((name, config, handler) => {
        registeredToolConfig = config;
        registeredToolHandler = handler;
      }),
    } as unknown as McpServer;
  });

  describe('tool registration', () => {
    it('should register a tool named "triggerWorkflow"', () => {
      declareTriggerWorkflowTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: [],
      });

      expect(mcpServer.registerTool).toHaveBeenCalledWith(
        'triggerWorkflow',
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should register tool with correct title and description', () => {
      declareTriggerWorkflowTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: [],
      });

      expect(registeredToolConfig.title).toBe('Trigger a workflow');
      expect(registeredToolConfig.description).toContain('getWorkflowRun');
    });

    it('should annotate the tool as a non-read-only, destructive, non-idempotent write', () => {
      declareTriggerWorkflowTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: [],
      });

      expect(registeredToolConfig.annotations).toEqual({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      });
    });

    it('should require string workflowId and recordId arguments', () => {
      declareTriggerWorkflowTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: [],
      });

      const schema = registeredToolConfig.inputSchema as Record<
        string,
        { parse: (value: unknown) => unknown }
      >;

      expect(() => schema.workflowId.parse('wf-1')).not.toThrow();
      expect(() => schema.workflowId.parse(undefined)).toThrow();
      expect(() => schema.workflowId.parse('')).toThrow();
      expect(() => schema.recordId.parse('42')).not.toThrow();
      expect(() => schema.recordId.parse(123)).toThrow();
      expect(() => schema.recordId.parse('')).toThrow();
    });
  });

  describe('tool execution', () => {
    const mockExtra = {
      authInfo: {
        token: 'test-token',
        extra: {
          forestServerToken: 'forest-token',
          renderingId: 123,
          environmentApiEndpoint: 'https://api.example.com',
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    beforeEach(() => {
      declareTriggerWorkflowTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: [],
      });
      mockForestServerClient.getMcpWorkflowById.mockResolvedValue({
        workflowId: 'wf-1',
        name: 'Refund order',
        collectionName: 'orders',
        mcpEnabled: true,
      });
      mockForestServerClient.triggerMcpWorkflow.mockResolvedValue({
        runId: '7',
        runState: 'loading',
      });
    });

    it('should resolve the workflow by id with the identity from the auth context', async () => {
      await registeredToolHandler({ workflowId: 'wf-1', recordId: '42' }, mockExtra);

      expect(mockForestServerClient.getMcpWorkflowById).toHaveBeenCalledWith({
        forestServerToken: 'forest-token',
        renderingId: '123',
        workflowId: 'wf-1',
      });
    });

    it('should trigger the workflow with the identity from the auth context and the args', async () => {
      await registeredToolHandler({ workflowId: 'wf-1', recordId: '42' }, mockExtra);

      expect(mockForestServerClient.triggerMcpWorkflow).toHaveBeenCalledWith({
        forestServerToken: 'forest-token',
        renderingId: '123',
        workflowId: 'wf-1',
        recordId: '42',
      });
    });

    it('should not list workflows before triggering', async () => {
      await registeredToolHandler({ workflowId: 'wf-1', recordId: '42' }, mockExtra);

      expect(mockForestServerClient.listMcpEnabledWorkflows).not.toHaveBeenCalled();
    });

    it('should return only the runId and runState as JSON text content', async () => {
      const result = await registeredToolHandler({ workflowId: 'wf-1', recordId: '42' }, mockExtra);

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify({ runId: '7', runState: 'loading' }) }],
      });
    });

    // "requested", not "triggered": the orchestrator writes a second row with the latter once the
    // run is committed. Aligning the two wordings — which an earlier round did — made one trigger
    // read as two identical events in Activity Logs, and since the orchestrator's row is
    // best-effort while this one is fail-closed, the number of rows per trigger is not even
    // stable. Do not "fix" this back to match its sibling.
    it('should record the activity log before triggering, labelled as a request', async () => {
      await registeredToolHandler({ workflowId: 'wf-1', recordId: '42' }, mockExtra);

      expect(mockForestServerClient.createMcpActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'triggerWorkflow',
          type: 'write',
          collectionName: 'orders',
          recordId: '42',
          label: 'requested the workflow "Refund order" via MCP',
        }),
      );

      const logOrder = mockForestServerClient.createMcpActivityLog.mock.invocationCallOrder[0];
      const triggerOrder = mockForestServerClient.triggerMcpWorkflow.mock.invocationCallOrder[0];
      expect(logOrder).toBeLessThan(triggerOrder);
    });

    it('should mark the activity log as completed after a successful trigger', async () => {
      await registeredToolHandler({ workflowId: 'wf-1', recordId: '42' }, mockExtra);

      expect(mockForestServerClient.updateActivityLogStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed' }),
      );
    });

    it('should not start the run when the pending activity log cannot be created (fail-closed)', async () => {
      mockForestServerClient.createMcpActivityLog.mockRejectedValue(new Error('audit down'));

      const result = await registeredToolHandler({ workflowId: 'wf-1', recordId: '42' }, mockExtra);

      expect(result).toEqual({
        content: [{ type: 'text', text: expect.stringContaining('audit down') }],
        isError: true,
      });
      expect(mockForestServerClient.triggerMcpWorkflow).not.toHaveBeenCalled();
    });

    it('should not start the run when the audit store returns a 200 with a null id (fail-closed)', async () => {
      mockForestServerClient.createMcpActivityLog.mockResolvedValue({
        id: null,
        attributes: {},
      } as never);

      const result = await registeredToolHandler({ workflowId: 'wf-1', recordId: '42' }, mockExtra);

      expect(result).toEqual({
        content: [
          { type: 'text', text: expect.stringContaining('the server returned no activity log id') },
        ],
        isError: true,
      });
      expect(mockForestServerClient.triggerMcpWorkflow).not.toHaveBeenCalled();
      expect(mockForestServerClient.updateActivityLogStatus).not.toHaveBeenCalled();
    });

    it('should return an error result when the auth context is missing the token', async () => {
      const extraWithoutToken = {
        authInfo: { extra: { renderingId: 123 } },
      } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

      const result = await registeredToolHandler(
        { workflowId: 'wf-1', recordId: '42' },
        extraWithoutToken,
      );

      expect(result).toEqual({
        content: [{ type: 'text', text: expect.stringContaining('forestServerToken') }],
        isError: true,
      });
      expect(mockForestServerClient.getMcpWorkflowById).not.toHaveBeenCalled();
      expect(mockForestServerClient.triggerMcpWorkflow).not.toHaveBeenCalled();
    });

    it('should reject an unknown workflow (lookup 404) without triggering or auditing', async () => {
      mockForestServerClient.getMcpWorkflowById.mockRejectedValue(
        new NotFoundError('Workflow not found'),
      );

      const result = await registeredToolHandler({ workflowId: 'wf-1', recordId: '42' }, mockExtra);

      expect(result).toEqual({
        content: [
          { type: 'text', text: expect.stringContaining('is not an MCP-enabled workflow') },
        ],
        isError: true,
      });
      expect(mockForestServerClient.triggerMcpWorkflow).not.toHaveBeenCalled();
      expect(mockForestServerClient.createMcpActivityLog).not.toHaveBeenCalled();
    });

    it('should reject a recordId longer than the server column, before any call', async () => {
      const schema = registeredToolConfig.inputSchema as {
        recordId: { safeParse: (value: unknown) => { success: boolean } };
      };

      expect(schema.recordId.safeParse('x'.repeat(255)).success).toBe(true);
      expect(schema.recordId.safeParse('x'.repeat(256)).success).toBe(false);
    });

    it('should tell the caller not to retry when the lookup 404s, so a missing route cannot loop', async () => {
      mockForestServerClient.getMcpWorkflowById.mockRejectedValue(
        new NotFoundError('Workflow not found'),
      );

      const result = await registeredToolHandler({ workflowId: 'wf-1', recordId: '42' }, mockExtra);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text:
              'Workflow "wf-1" is not an MCP-enabled workflow you can access. Use listWorkflows to ' +
              'discover triggerable workflows. If listWorkflows just returned this id, do not ' +
              'retry — report it to your Forest administrator instead.',
          },
        ],
        isError: true,
      });
    });

    it('should log the underlying lookup failure so an outage is visible to an operator', async () => {
      mockForestServerClient.getMcpWorkflowById.mockRejectedValue(
        new NotFoundError('Cannot GET /api/workflow-orchestrator/mcp-workflows/wf-1'),
      );

      await registeredToolHandler({ workflowId: 'wf-1', recordId: '42' }, mockExtra);

      expect(mockLogger).toHaveBeenCalledWith(
        'Error',
        'Failed to resolve workflow "wf-1" via getMcpWorkflowById: ' +
          'Cannot GET /api/workflow-orchestrator/mcp-workflows/wf-1',
      );
    });

    it('should not leak transport detail to the model when the lookup fails for any other reason', async () => {
      mockForestServerClient.getMcpWorkflowById.mockRejectedValue(
        new Error(
          'Failed to reach Forest: connect ECONNREFUSED 10.1.2.3:3310 ' +
            '(https://api.internal.forestadmin.com)',
        ),
      );

      const result = await registeredToolHandler({ workflowId: 'wf-1', recordId: '42' }, mockExtra);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text:
              'Workflow "wf-1" could not be resolved because Forest could not be reached. This is ' +
              'a temporary server-side failure, not a problem with the workflow id — retry later, ' +
              'and report it to your Forest administrator if it persists.',
          },
        ],
        isError: true,
      });
      // The detail stays operator-side.
      expect(JSON.stringify(result)).not.toContain('ECONNREFUSED');
      expect(JSON.stringify(result)).not.toContain('api.internal.forestadmin.com');
      expect(mockLogger).toHaveBeenCalledWith(
        'Error',
        expect.stringContaining('connect ECONNREFUSED 10.1.2.3:3310'),
      );
      expect(mockForestServerClient.createMcpActivityLog).not.toHaveBeenCalled();
      expect(mockForestServerClient.triggerMcpWorkflow).not.toHaveBeenCalled();
    });

    // The server validates workflowId as a UUID, the identity, and the workflow engine on every
    // lookup, so these fail identically on every attempt. Sending them down the "retry later" path
    // is what let a model loop forever on a request — typically a workflow *name* it guessed
    // instead of the id — that can never succeed. Each keeps Forest's own reason: unlike the 404,
    // none of them leaks whether the workflow exists.
    it.each([
      ['a non-UUID workflowId (400)', new HttpError('"workflowId" must be a valid GUID', 400)],
      ['an expired token (401)', new HttpError('Unauthorized', 401)],
      ['a refused identity (403)', new ForbiddenError('Forbidden')],
      [
        'a browser-engine environment (409)',
        new HttpError('This environment still runs workflows in the browser', 409),
      ],
    ])('should treat %s as terminal rather than retryable', async (_, error) => {
      mockForestServerClient.getMcpWorkflowById.mockRejectedValue(error);

      const result = await registeredToolHandler({ workflowId: 'wf-1', recordId: '42' }, mockExtra);
      const { text } = (result as { content: [{ text: string }] }).content[0];

      expect(result).toMatchObject({ isError: true });
      expect(text).toBe(
        `Workflow "wf-1" could not be resolved — ${error.message.replace(/\.$/, '')}. Retrying ` +
          'will not help: fix the request, or report it to your Forest administrator.',
      );
      expect(text).not.toContain('retry later');
      expect(mockForestServerClient.triggerMcpWorkflow).not.toHaveBeenCalled();
    });

    // The 404 is the one that must stay uniform: it covers unknown, MCP-disabled and
    // out-of-rendering alike, so a caller cannot use it to probe which workflows exist.
    it('should keep the uniform wording on a 404 so it cannot be used to probe', async () => {
      mockForestServerClient.getMcpWorkflowById.mockRejectedValue(
        new NotFoundError('Workflow 3f7c not found in rendering 42'),
      );

      const result = await registeredToolHandler({ workflowId: 'wf-1', recordId: '42' }, mockExtra);
      const { text } = (result as { content: [{ text: string }] }).content[0];

      expect(text).toBe(
        'Workflow "wf-1" is not an MCP-enabled workflow you can access. Use listWorkflows to ' +
          'discover triggerable workflows. If listWorkflows just returned this id, do not retry ' +
          '— report it to your Forest administrator instead.',
      );
      expect(text).not.toContain('rendering 42');
    });

    it('should still tell the caller to retry when the lookup fails with a 5xx', async () => {
      mockForestServerClient.getMcpWorkflowById.mockRejectedValue(
        new HttpError('Internal Server Error', 503),
      );

      const result = await registeredToolHandler({ workflowId: 'wf-1', recordId: '42' }, mockExtra);

      expect((result as { content: [{ text: string }] }).content[0].text).toContain('retry later');
    });

    // The lookup's guard is one call early: the start itself goes through withActivityLog, which
    // rethrows the parsed message as-is.
    it('should keep transport detail out of the model when the trigger call itself fails', async () => {
      mockForestServerClient.triggerMcpWorkflow.mockRejectedValue(
        new Error('connect ECONNREFUSED 10.0.4.17:3310'),
      );

      const result = await registeredToolHandler({ workflowId: 'wf-1', recordId: '42' }, mockExtra);
      const { text } = (result as { content: [{ text: string }] }).content[0];

      expect(result).toMatchObject({ isError: true });
      expect(text).toBe(
        'Workflow "wf-1" could not be triggered because Forest could not be reached. The run may ' +
          'or may not have started — do not retry blindly; report it to your Forest administrator.',
      );
      expect(text).not.toContain('ECONNREFUSED');
      expect(mockLogger).toHaveBeenCalledWith(
        'Error',
        'Failed to trigger workflow "wf-1": connect ECONNREFUSED 10.0.4.17:3310',
      );
      // The audit row was written before the trigger and must still be closed out.
      expect(mockForestServerClient.updateActivityLogStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' }),
      );
    });

    it('should reject an MCP-disabled workflow without triggering or auditing', async () => {
      mockForestServerClient.getMcpWorkflowById.mockResolvedValue({
        workflowId: 'wf-1',
        name: 'Refund order',
        collectionName: 'orders',
        mcpEnabled: false,
      });

      const result = await registeredToolHandler({ workflowId: 'wf-1', recordId: '42' }, mockExtra);

      expect(result).toEqual({
        content: [
          { type: 'text', text: expect.stringContaining('is not an MCP-enabled workflow') },
        ],
        isError: true,
      });
      expect(mockForestServerClient.triggerMcpWorkflow).not.toHaveBeenCalled();
      expect(mockForestServerClient.createMcpActivityLog).not.toHaveBeenCalled();
    });

    it('should reject a workflow whose collection is unavailable without auditing or triggering', async () => {
      mockForestServerClient.getMcpWorkflowById.mockResolvedValue({
        workflowId: 'wf-1',
        name: 'Refund order',
        collectionName: null,
        mcpEnabled: true,
      });

      const result = await registeredToolHandler({ workflowId: 'wf-1', recordId: '42' }, mockExtra);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text:
              'Workflow "wf-1" cannot be triggered via MCP because its collection is unavailable. ' +
              "Check the workflow's configuration in Forest.",
          },
        ],
        isError: true,
      });
      expect(mockForestServerClient.createMcpActivityLog).not.toHaveBeenCalled();
      expect(mockForestServerClient.triggerMcpWorkflow).not.toHaveBeenCalled();
      expect(mockForestServerClient.updateActivityLogStatus).not.toHaveBeenCalled();
    });

    it('should map a trigger-time 404 race to the friendly error and mark the log failed', async () => {
      mockForestServerClient.triggerMcpWorkflow.mockRejectedValue(
        new NotFoundError('Workflow MCP trigger not found or disabled'),
      );

      const result = await registeredToolHandler({ workflowId: 'wf-1', recordId: '42' }, mockExtra);

      expect(result).toEqual({
        content: [
          { type: 'text', text: expect.stringContaining('is not an MCP-enabled workflow') },
        ],
        isError: true,
      });
      expect(mockForestServerClient.createMcpActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'triggerWorkflow',
          collectionName: 'orders',
          recordId: '42',
          label: 'requested the workflow "Refund order" via MCP',
        }),
      );
      expect(mockForestServerClient.updateActivityLogStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' }),
      );
    });

    it('should pass a 409 already-ongoing run through as an error and mark the log failed', async () => {
      // An HttpError, not a bare Error: ServerUtils maps a 409 carrying a JSON:API detail to
      // `new HttpError(detail, 409)`. The distinction is load-bearing — a bare Error is what a raw
      // transport failure looks like, and those are the ones whose message must not reach a model.
      mockForestServerClient.triggerMcpWorkflow.mockRejectedValue(
        new HttpError('A run is already ongoing on this record', 409),
      );

      const result = await registeredToolHandler({ workflowId: 'wf-1', recordId: '42' }, mockExtra);

      expect(result).toEqual({
        content: [
          { type: 'text', text: expect.stringContaining('already ongoing on this record') },
        ],
        isError: true,
      });
      expect(mockForestServerClient.createMcpActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'triggerWorkflow',
          collectionName: 'orders',
          recordId: '42',
          label: 'requested the workflow "Refund order" via MCP',
        }),
      );
      expect(mockForestServerClient.updateActivityLogStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' }),
      );
    });
  });
});
