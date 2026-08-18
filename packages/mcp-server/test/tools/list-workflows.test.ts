import type { ForestServerClient } from '../../src/http-client';
import type { Logger } from '../../src/server';
import type { RegisteredToolConfig } from '../helpers/registered-tool-config';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import { NotFoundError } from '@forestadmin/forestadmin-client';

import declareListWorkflowsTool from '../../src/tools/list-workflows';
import createMockForestServerClient from '../helpers/forest-server-client';

const mockLogger: Logger = jest.fn();

describe('declareListWorkflowsTool', () => {
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
    it('should register a tool named "listWorkflows"', () => {
      declareListWorkflowsTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: [],
      });

      expect(mcpServer.registerTool).toHaveBeenCalledWith(
        'listWorkflows',
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should register tool with correct title and description', () => {
      declareListWorkflowsTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: [],
      });

      expect(registeredToolConfig.title).toBe('List MCP-enabled workflows');
      expect(registeredToolConfig.description).toContain('MCP triggering');
    });

    it('should spell out every annotation, not just readOnlyHint', () => {
      declareListWorkflowsTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: [],
      });

      // An omitted destructiveHint defaults to true in the MCP spec, so a client reading
      // that field alone would treat this read as destructive.
      expect(registeredToolConfig.annotations).toEqual({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      });
    });

    it('should expose an optional collectionName argument', () => {
      declareListWorkflowsTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: [],
      });

      const schema = registeredToolConfig.inputSchema as Record<
        string,
        { parse: (value: unknown) => unknown }
      >;
      expect(registeredToolConfig.inputSchema).toHaveProperty('collectionName');
      expect(schema.collectionName.parse(undefined)).toBeUndefined();
    });

    it('should accept any string for collectionName when no collection names provided', () => {
      declareListWorkflowsTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: [],
      });

      const schema = registeredToolConfig.inputSchema as Record<
        string,
        { parse: (value: unknown) => unknown }
      >;
      expect(() => schema.collectionName.parse('any-collection')).not.toThrow();
      expect(() => schema.collectionName.parse(undefined)).not.toThrow();
      expect(() => schema.collectionName.parse(123)).toThrow();
    });

    it('should restrict collectionName to the known collections when provided', () => {
      declareListWorkflowsTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: ['orders', 'users'],
      });

      const schema = registeredToolConfig.inputSchema as Record<
        string,
        { parse: (value: unknown) => unknown }
      >;
      expect(() => schema.collectionName.parse('orders')).not.toThrow();
      expect(() => schema.collectionName.parse(undefined)).not.toThrow();
      expect(() => schema.collectionName.parse('invalid-collection')).toThrow();
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

    const workflows = [
      { workflowId: 'wf-1', name: 'Refund order', collectionName: 'orders' },
      { workflowId: 'wf-2', name: 'Notify customer', collectionName: 'orders' },
    ];

    beforeEach(() => {
      declareListWorkflowsTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: [],
      });
      mockForestServerClient.listMcpEnabledWorkflows.mockResolvedValue(workflows);
    });

    it('should call listMcpEnabledWorkflows with the identity from the auth context', async () => {
      await registeredToolHandler({}, mockExtra);

      expect(mockForestServerClient.listMcpEnabledWorkflows).toHaveBeenCalledWith({
        forestServerToken: 'forest-token',
        renderingId: '123',
        collectionName: undefined,
      });
    });

    it('should forward the collectionName filter to listMcpEnabledWorkflows', async () => {
      await registeredToolHandler({ collectionName: 'orders' }, mockExtra);

      expect(mockForestServerClient.listMcpEnabledWorkflows).toHaveBeenCalledWith({
        forestServerToken: 'forest-token',
        renderingId: '123',
        collectionName: 'orders',
      });
    });

    it('should return the workflows as JSON text content', async () => {
      const result = await registeredToolHandler({}, mockExtra);

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify(workflows) }],
      });
    });

    it('should hide workflows whose collection is unavailable, since triggerWorkflow rejects them', async () => {
      mockForestServerClient.listMcpEnabledWorkflows.mockResolvedValue([
        { workflowId: 'wf-1', name: 'Refund order', collectionName: 'orders' },
        { workflowId: 'wf-2', name: 'Retired process', collectionName: null },
      ]);

      const result = await registeredToolHandler({}, mockExtra);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              { workflowId: 'wf-1', name: 'Refund order', collectionName: 'orders' },
            ]),
          },
        ],
      });
    });

    it('should warn the operator about each hidden workflow', async () => {
      mockForestServerClient.listMcpEnabledWorkflows.mockResolvedValue([
        { workflowId: 'wf-1', name: 'Refund order', collectionName: 'orders' },
        { workflowId: 'wf-2', name: 'Retired process', collectionName: null },
        { workflowId: 'wf-3', name: 'Other retired', collectionName: null },
      ]);

      await registeredToolHandler({}, mockExtra);

      expect(mockLogger).toHaveBeenCalledWith(
        'Warn',
        'listWorkflows hid 2 MCP-enabled workflow(s) whose collection is no longer available in ' +
          'this rendering; they cannot be triggered until their configuration is fixed.',
      );
    });

    it('should not warn when every workflow is triggerable', async () => {
      mockForestServerClient.listMcpEnabledWorkflows.mockResolvedValue([
        { workflowId: 'wf-1', name: 'Refund order', collectionName: 'orders' },
      ]);

      await registeredToolHandler({}, mockExtra);

      expect(mockLogger).not.toHaveBeenCalledWith(
        'Warn',
        expect.stringContaining('listWorkflows hid'),
      );
    });

    it('should return an error result when the auth context is missing the token', async () => {
      const extraWithoutToken = {
        authInfo: { extra: { renderingId: 123 } },
      } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

      const result = await registeredToolHandler({}, extraWithoutToken);

      expect(result).toEqual({
        content: [{ type: 'text', text: expect.stringContaining('forestServerToken') }],
        isError: true,
      });
      expect(mockForestServerClient.listMcpEnabledWorkflows).not.toHaveBeenCalled();
    });

    it('should map server errors to an error tool result', async () => {
      mockForestServerClient.listMcpEnabledWorkflows.mockRejectedValue(
        new NotFoundError('No active workflow for the rendering'),
      );

      const result = await registeredToolHandler({}, mockExtra);

      expect(result).toEqual({
        content: [
          { type: 'text', text: expect.stringContaining('No active workflow for the rendering') },
        ],
        isError: true,
      });
    });
  });
});
