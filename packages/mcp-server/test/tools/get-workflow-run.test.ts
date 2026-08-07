import type { ForestServerClient } from '../../src/http-client';
import type { Logger } from '../../src/server';
import type { RegisteredToolConfig } from '../helpers/registered-tool-config';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import { ForbiddenError, NotFoundError } from '@forestadmin/forestadmin-client';

import declareGetWorkflowRunTool from '../../src/tools/get-workflow-run';
import createMockForestServerClient from '../helpers/forest-server-client';

const mockLogger: Logger = jest.fn();

describe('declareGetWorkflowRunTool', () => {
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
    it('should register a tool named "getWorkflowRun"', () => {
      declareGetWorkflowRunTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: [],
      });

      expect(mcpServer.registerTool).toHaveBeenCalledWith(
        'getWorkflowRun',
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should register tool with correct title and description', () => {
      declareGetWorkflowRunTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: [],
      });

      expect(registeredToolConfig.title).toBe('Get a workflow run status');
      expect(registeredToolConfig.description).toContain('waitingForHumanInput');
    });

    it('should be annotated as read-only', () => {
      declareGetWorkflowRunTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: [],
      });

      expect(registeredToolConfig.annotations).toEqual({ readOnlyHint: true });
    });

    it('should require a string runId argument', () => {
      declareGetWorkflowRunTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: [],
      });

      const schema = registeredToolConfig.inputSchema as Record<
        string,
        { parse: (value: unknown) => unknown }
      >;

      expect(() => schema.runId.parse('7')).not.toThrow();
      expect(() => schema.runId.parse(undefined)).toThrow();
      expect(() => schema.runId.parse(7)).toThrow();
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

    const runStatus = {
      runState: 'finished' as const,
      currentStep: null,
      waitingForHumanInput: false,
      result: { refunded: true },
    };

    beforeEach(() => {
      declareGetWorkflowRunTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: [],
      });
      mockForestServerClient.getWorkflowRun.mockResolvedValue(runStatus);
    });

    it('should call getWorkflowRun with the identity from the auth context and the runId', async () => {
      await registeredToolHandler({ runId: '7' }, mockExtra);

      expect(mockForestServerClient.getWorkflowRun).toHaveBeenCalledWith({
        forestServerToken: 'forest-token',
        renderingId: '123',
        runId: '7',
      });
    });

    it('should return the run status as JSON text content', async () => {
      const result = await registeredToolHandler({ runId: '7' }, mockExtra);

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify(runStatus) }],
      });
    });

    it('should report a human-gated run as waitingForHumanInput', async () => {
      mockForestServerClient.getWorkflowRun.mockResolvedValue({
        runState: 'started',
        currentStep: { name: 'Manager approval', type: 'human' },
        waitingForHumanInput: true,
      });

      const result = await registeredToolHandler({ runId: '7' }, mockExtra);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              runState: 'started',
              currentStep: { name: 'Manager approval', type: 'human' },
              waitingForHumanInput: true,
            }),
          },
        ],
      });
    });

    it('should return an error result when the auth context is missing the token', async () => {
      const extraWithoutToken = {
        authInfo: { extra: { renderingId: 123 } },
      } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

      const result = await registeredToolHandler({ runId: '7' }, extraWithoutToken);

      expect(result).toEqual({
        content: [{ type: 'text', text: expect.stringContaining('forestServerToken') }],
        isError: true,
      });
      expect(mockForestServerClient.getWorkflowRun).not.toHaveBeenCalled();
    });

    it('should map an unknown runId 404 to an error tool result', async () => {
      mockForestServerClient.getWorkflowRun.mockRejectedValue(
        new NotFoundError('Workflow run not found'),
      );

      const result = await registeredToolHandler({ runId: '7' }, mockExtra);

      expect(result).toEqual({
        content: [{ type: 'text', text: expect.stringContaining('not found') }],
        isError: true,
      });
    });

    it('should map a forbidden runId 403 to an error tool result', async () => {
      mockForestServerClient.getWorkflowRun.mockRejectedValue(
        new ForbiddenError('You are not allowed to access this workflow run'),
      );

      const result = await registeredToolHandler({ runId: '7' }, mockExtra);

      expect(result).toEqual({
        content: [{ type: 'text', text: expect.stringContaining('not allowed') }],
        isError: true,
      });
    });
  });
});
