import type { ForestServerClient } from '../../src/http-client';
import type { Logger } from '../../src/server';
import type { RegisteredToolConfig } from '../helpers/registered-tool-config';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import { NotFoundError } from '@forestadmin/forestadmin-client';

import declareTriggerWorkflowTool from '../../src/tools/trigger-workflow';
import withActivityLog from '../../src/utils/with-activity-log';
import createMockForestServerClient from '../helpers/forest-server-client';

jest.mock('../../src/utils/with-activity-log');

const mockLogger: Logger = jest.fn();
const mockWithActivityLog = withActivityLog as jest.MockedFunction<typeof withActivityLog>;

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

    // By default, withActivityLog executes the operation and returns its result
    mockWithActivityLog.mockImplementation(async options => options.operation());
  });

  describe('tool registration', () => {
    it('should register a tool named "triggerWorkflow"', () => {
      declareTriggerWorkflowTool(mcpServer, mockForestServerClient, mockLogger);

      expect(mcpServer.registerTool).toHaveBeenCalledWith(
        'triggerWorkflow',
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should register tool with correct title and description', () => {
      declareTriggerWorkflowTool(mcpServer, mockForestServerClient, mockLogger);

      expect(registeredToolConfig.title).toBe('Trigger a workflow');
      expect(registeredToolConfig.description).toContain('getWorkflowRun');
    });

    it('should not be annotated as read-only', () => {
      declareTriggerWorkflowTool(mcpServer, mockForestServerClient, mockLogger);

      expect(registeredToolConfig.annotations?.readOnlyHint).toBeUndefined();
    });

    it('should require string workflowId and recordId arguments', () => {
      declareTriggerWorkflowTool(mcpServer, mockForestServerClient, mockLogger);

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
      declareTriggerWorkflowTool(mcpServer, mockForestServerClient, mockLogger);
      mockForestServerClient.triggerWorkflow.mockResolvedValue({ runId: 7, runState: 'loading' });
    });

    it('should call triggerWorkflow with the identity from the auth context and the args', async () => {
      await registeredToolHandler({ workflowId: 'wf-1', recordId: '42' }, mockExtra);

      expect(mockForestServerClient.triggerWorkflow).toHaveBeenCalledWith({
        forestServerToken: 'forest-token',
        renderingId: '123',
        workflowId: 'wf-1',
        recordId: '42',
      });
    });

    it('should return the runId and runState as JSON text content', async () => {
      const result = await registeredToolHandler({ workflowId: 'wf-1', recordId: '42' }, mockExtra);

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify({ runId: 7, runState: 'loading' }) }],
      });
    });

    it('should wrap the trigger in an activity log for the triggerWorkflow action', async () => {
      await registeredToolHandler({ workflowId: 'wf-1', recordId: '42' }, mockExtra);

      expect(mockWithActivityLog).toHaveBeenCalledWith({
        forestServerClient: mockForestServerClient,
        request: mockExtra,
        action: 'triggerWorkflow',
        context: {
          recordId: '42',
          label: 'triggered the workflow "wf-1"',
        },
        logger: mockLogger,
        operation: expect.any(Function),
      });
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
      expect(mockForestServerClient.triggerWorkflow).not.toHaveBeenCalled();
    });

    it('should map a 409 already-ongoing run to an error tool result', async () => {
      mockForestServerClient.triggerWorkflow.mockRejectedValue(
        new Error('A run is already ongoing on this record'),
      );

      const result = await registeredToolHandler({ workflowId: 'wf-1', recordId: '42' }, mockExtra);

      expect(result).toEqual({
        content: [
          { type: 'text', text: expect.stringContaining('already ongoing on this record') },
        ],
        isError: true,
      });
    });

    it('should map a 404 non-mcp-enabled workflow to an error tool result', async () => {
      mockForestServerClient.triggerWorkflow.mockRejectedValue(
        new NotFoundError('Workflow MCP trigger not found or disabled'),
      );

      const result = await registeredToolHandler({ workflowId: 'wf-1', recordId: '42' }, mockExtra);

      expect(result).toEqual({
        content: [{ type: 'text', text: expect.stringContaining('not found or disabled') }],
        isError: true,
      });
    });
  });
});
