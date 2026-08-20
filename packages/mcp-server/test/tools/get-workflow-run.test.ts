import type { ForestServerClient } from '../../src/http-client';
import type { Logger } from '../../src/server';
import type { RegisteredToolConfig } from '../helpers/registered-tool-config';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import { ForbiddenError, HttpError, NotFoundError } from '@forestadmin/forestadmin-client';

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
      expect(registeredToolConfig.description).toContain('workflowHistory');
      expect(registeredToolConfig.description).toContain('cannot be resumed via MCP');
      expect(registeredToolConfig.description).toContain('wait at least a few seconds');
    });

    it('should spell out every annotation, not just readOnlyHint', () => {
      declareGetWorkflowRunTool(mcpServer, {
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
      expect(() => schema.runId.parse('')).toThrow();
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

    const hydratedRun = {
      id: 7,
      userId: 42,
      renderingId: 123,
      collectionId: 'orders',
      workflowId: 'wf-1',
      bpmnVersion: '3',
      selectedRecordId: '99',
      runState: 'finished' as const,
      engine: 'orchestrator' as const,
      triggerType: 'mcp' as const,
      lockedAt: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:05:00.000Z',
      workflowHistory: [
        {
          stepName: 'Refund order',
          stepIndex: 0,
          done: true,
          isCardStep: false,
          context: { manuallyCompleted: true as const, completedBy: 42 },
          stepDefinition: {
            type: 'task' as const,
            title: 'Refund order',
            executionType: 'fully-automated' as const,
            automaticCompletion: true,
            outgoing: [],
            taskType: 'trigger-action' as const,
          },
        },
      ],
    };

    beforeEach(() => {
      declareGetWorkflowRunTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: [],
      });
      mockForestServerClient.getMcpWorkflowRun.mockResolvedValue(hydratedRun);
    });

    it('should call getWorkflowRun with the identity from the auth context and the runId', async () => {
      await registeredToolHandler({ runId: '7' }, mockExtra);

      expect(mockForestServerClient.getMcpWorkflowRun).toHaveBeenCalledWith({
        forestServerToken: 'forest-token',
        renderingId: '123',
        runId: '7',
      });
    });

    it('should return the full hydrated run as JSON text content, unchanged', async () => {
      const result = await registeredToolHandler({ runId: '7' }, mockExtra);

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify(hydratedRun) }],
      });
    });

    it('should surface a human-gated step and its context verbatim', async () => {
      const gatedRun = {
        ...hydratedRun,
        runState: 'started' as const,
        workflowHistory: [
          {
            stepName: 'Manager approval',
            stepIndex: 0,
            done: false,
            isCardStep: true,
            context: { escalationState: 'escalated' as const },
            stepDefinition: {
              type: 'escalation' as const,
              title: 'Manager approval',
              executionType: 'manual' as const,
              automaticCompletion: false,
              outgoing: [{ stepId: 'end', buttonText: 'Approve' }],
            },
          },
        ],
      };
      mockForestServerClient.getMcpWorkflowRun.mockResolvedValue(gatedRun);

      const result = await registeredToolHandler({ runId: '7' }, mockExtra);

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify(gatedRun) }],
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
      expect(mockForestServerClient.getMcpWorkflowRun).not.toHaveBeenCalled();
    });

    it('should map an unknown runId 404 to an error tool result', async () => {
      mockForestServerClient.getMcpWorkflowRun.mockRejectedValue(
        new NotFoundError('Workflow run not found'),
      );

      const result = await registeredToolHandler({ runId: '7' }, mockExtra);

      expect(result).toEqual({
        content: [{ type: 'text', text: expect.stringContaining('not found') }],
        isError: true,
      });
    });

    it('should map a forbidden runId 403 to an error tool result', async () => {
      mockForestServerClient.getMcpWorkflowRun.mockRejectedValue(
        new ForbiddenError('You are not allowed to access this workflow run'),
      );

      const result = await registeredToolHandler({ runId: '7' }, mockExtra);

      expect(result).toEqual({
        content: [{ type: 'text', text: expect.stringContaining('not allowed') }],
        isError: true,
      });
    });

    it.each([
      ['a raw connection error', new Error('connect ECONNREFUSED 10.0.4.17:3310')],
      [
        'a timeout naming the server URL',
        new HttpError(
          'The request to Forest Admin server has timed out while trying to reach ' +
            'https://api.internal.acme.corp/api/workflow-orchestrator/mcp-workflows/runs/7 at ' +
            '2026-08-19T13:00:00.000Z. Message: Timeout of 10000ms exceeded',
          408,
        ),
      ],
    ])('should keep transport detail out of the tool result on %s', async (_, error) => {
      mockForestServerClient.getMcpWorkflowRun.mockRejectedValue(error);

      const result = await registeredToolHandler({ runId: '7' }, mockExtra);
      const { text } = (result as { content: [{ text: string }] }).content[0];

      expect(result).toMatchObject({ isError: true });
      expect(text).toBe(
        'Run "7" could not be read because Forest could not be reached. This is a temporary ' +
          'server-side failure, not a problem with the run id — retry later, and report it to ' +
          'your Forest administrator if it persists.',
      );
      expect(text).not.toContain('10.0.4.17');
      expect(text).not.toContain('acme.corp');
      expect(mockLogger).toHaveBeenCalledWith(
        'Error',
        `Failed to read workflow run "7": ${error.message}`,
      );
    });

    // This is the tool the model is told to poll, so a refusal it cannot fix has to say so or the
    // documented usage becomes an endless loop.
    it.each([
      ['an unknown runId', new NotFoundError('Workflow run not found')],
      ['a refused identity', new ForbiddenError('You are not allowed to access this workflow run')],
      ['a malformed runId', new HttpError('Validation failed', 400)],
      [
        'a browser-engine environment',
        new HttpError('This environment runs workflows in the browser', 409),
      ],
    ])('should tell the model not to retry %s', async (_, error) => {
      mockForestServerClient.getMcpWorkflowRun.mockRejectedValue(error);

      const result = await registeredToolHandler({ runId: '7' }, mockExtra);
      const { text } = (result as { content: [{ text: string }] }).content[0];

      expect(result).toMatchObject({ isError: true });
      expect(text).toBe(
        `${error.message.replace(/\.$/, '')}. Retrying will not help: fix the request, or report ` +
          'it to your Forest administrator.',
      );
    });

    it.each([
      ['a rate limit', new HttpError('Too many requests', 429)],
      ['a server error', new HttpError('Internal server error', 500)],
    ])('should leave %s retryable, with no advice to stop', async (_, error) => {
      mockForestServerClient.getMcpWorkflowRun.mockRejectedValue(error);

      const result = await registeredToolHandler({ runId: '7' }, mockExtra);
      const { text } = (result as { content: [{ text: string }] }).content[0];

      expect(text).toBe(error.message);
      expect(text).not.toContain('Retrying will not help');
    });
  });
});
