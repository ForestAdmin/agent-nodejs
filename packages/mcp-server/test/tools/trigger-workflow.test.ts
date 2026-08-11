import type { ForestServerClient } from '../../src/http-client';
import type { Logger } from '../../src/server';
import type { RegisteredToolConfig } from '../helpers/registered-tool-config';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import { NotFoundError } from '@forestadmin/forestadmin-client';

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

    it('should not be annotated as read-only', () => {
      declareTriggerWorkflowTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: [],
      });

      expect(registeredToolConfig.annotations?.readOnlyHint).toBeUndefined();
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
      expect(() => schema.recordId.parse('42')).not.toThrow();
      expect(() => schema.recordId.parse(123)).toThrow();
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

    it('should record the activity log before triggering, labelled from the resolved workflow', async () => {
      await registeredToolHandler({ workflowId: 'wf-1', recordId: '42' }, mockExtra);

      expect(mockForestServerClient.createMcpActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'triggerWorkflow',
          type: 'write',
          collectionName: 'orders',
          recordId: '42',
          label: 'triggered the workflow "Refund order"',
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
      expect(mockForestServerClient.createMcpActivityLog).toHaveBeenCalled();
      expect(mockForestServerClient.updateActivityLogStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' }),
      );
    });

    it('should pass a 409 already-ongoing run through as an error and mark the log failed', async () => {
      mockForestServerClient.triggerMcpWorkflow.mockRejectedValue(
        new Error('A run is already ongoing on this record'),
      );

      const result = await registeredToolHandler({ workflowId: 'wf-1', recordId: '42' }, mockExtra);

      expect(result).toEqual({
        content: [
          { type: 'text', text: expect.stringContaining('already ongoing on this record') },
        ],
        isError: true,
      });
      expect(mockForestServerClient.createMcpActivityLog).toHaveBeenCalled();
      expect(mockForestServerClient.updateActivityLogStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' }),
      );
    });
  });
});
