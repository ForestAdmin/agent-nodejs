import type { ForestServerClient } from '../../src/http-client';
import type { Logger } from '../../src/server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import declareAssociateTool from '../../src/tools/associate';
import buildClient from '../../src/utils/agent-caller';
import withActivityLog from '../../src/utils/with-activity-log';
import createMockForestServerClient from '../helpers/forest-server-client';

jest.mock('../../src/utils/agent-caller');
jest.mock('../../src/utils/with-activity-log');

const mockLogger: Logger = jest.fn();

const mockBuildClient = buildClient as jest.MockedFunction<typeof buildClient>;
const mockWithActivityLog = withActivityLog as jest.MockedFunction<typeof withActivityLog>;

describe('declareAssociateTool', () => {
  let mcpServer: McpServer;
  let mockForestServerClient: jest.Mocked<ForestServerClient>;
  let registeredToolHandler: (options: unknown, extra: unknown) => Promise<unknown>;
  let registeredToolConfig: { title: string; description: string; inputSchema: unknown };

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
    it('should register a tool named "associate"', () => {
      declareAssociateTool(mcpServer, mockForestServerClient, mockLogger);

      expect(mcpServer.registerTool).toHaveBeenCalledWith(
        'associate',
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should register tool with correct title and description', () => {
      declareAssociateTool(mcpServer, mockForestServerClient, mockLogger);

      expect(registeredToolConfig.title).toBe('Associate records in a relation');
      expect(registeredToolConfig.description).toBe(
        'Link a record to another through a one-to-many or many-to-many relation. For many-to-many relations, this creates a new entry in the join table.',
      );
    });

    it('should define correct input schema', () => {
      declareAssociateTool(mcpServer, mockForestServerClient, mockLogger);

      expect(registeredToolConfig.inputSchema).toHaveProperty('collectionName');
      expect(registeredToolConfig.inputSchema).toHaveProperty('relationName');
      expect(registeredToolConfig.inputSchema).toHaveProperty('parentRecordId');
      expect(registeredToolConfig.inputSchema).toHaveProperty('targetRecordId');
    });

    it('should use enum type for collectionName when collection names provided', () => {
      declareAssociateTool(mcpServer, mockForestServerClient, mockLogger, ['users', 'posts']);

      const schema = registeredToolConfig.inputSchema as Record<
        string,
        { options?: string[]; parse: (value: unknown) => unknown }
      >;
      expect(schema.collectionName.options).toEqual(['users', 'posts']);
    });
  });

  describe('tool execution', () => {
    const mockExtra = {
      authInfo: {
        token: 'test-token',
        extra: {
          forestServerToken: 'forest-token',
          renderingId: '123',
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    beforeEach(() => {
      declareAssociateTool(mcpServer, mockForestServerClient, mockLogger);
    });

    it('should call associate on the relation', async () => {
      const mockAssociate = jest.fn().mockResolvedValue(undefined);
      const mockRelation = jest.fn().mockReturnValue({ associate: mockAssociate });
      const mockCollection = jest.fn().mockReturnValue({ relation: mockRelation });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      const result = (await registeredToolHandler(
        {
          collectionName: 'posts',
          relationName: 'tags',
          parentRecordId: 1,
          targetRecordId: 42,
        },
        mockExtra,
      )) as { content: { type: string; text: string }[] };

      expect(mockCollection).toHaveBeenCalledWith('posts');
      expect(mockRelation).toHaveBeenCalledWith('tags', 1);
      expect(mockAssociate).toHaveBeenCalledWith(42);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
    });

    describe('activity logging', () => {
      beforeEach(() => {
        const mockAssociate = jest.fn().mockResolvedValue(undefined);
        const mockRelation = jest.fn().mockReturnValue({ associate: mockAssociate });
        const mockCollection = jest.fn().mockReturnValue({ relation: mockRelation });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);
      });

      it('should call withActivityLog with correct parameters', async () => {
        await registeredToolHandler(
          {
            collectionName: 'posts',
            relationName: 'tags',
            parentRecordId: 1,
            targetRecordId: 42,
          },
          mockExtra,
        );

        expect(mockWithActivityLog).toHaveBeenCalledWith({
          forestServerClient: mockForestServerClient,
          request: mockExtra,
          action: 'associate',
          context: expect.objectContaining({
            collectionName: 'posts',
            recordId: 1,
          }),
          logger: mockLogger,
          operation: expect.any(Function),
        });
      });

      it('should wrap the associate operation with activity logging', async () => {
        const mockAssociate = jest.fn().mockResolvedValue(undefined);
        const mockRelation = jest.fn().mockReturnValue({ associate: mockAssociate });
        const mockCollection = jest.fn().mockReturnValue({ relation: mockRelation });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        await registeredToolHandler(
          {
            collectionName: 'posts',
            relationName: 'tags',
            parentRecordId: 1,
            targetRecordId: 42,
          },
          mockExtra,
        );

        // Verify the operation was executed through withActivityLog
        expect(mockWithActivityLog).toHaveBeenCalled();
        expect(mockAssociate).toHaveBeenCalledWith(42);
      });
    });

    it('should handle string record ids', async () => {
      const mockAssociate = jest.fn().mockResolvedValue(undefined);
      const mockRelation = jest.fn().mockReturnValue({ associate: mockAssociate });
      const mockCollection = jest.fn().mockReturnValue({ relation: mockRelation });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      await registeredToolHandler(
        {
          collectionName: 'posts',
          relationName: 'tags',
          parentRecordId: 'abc-123',
          targetRecordId: 'xyz-456',
        },
        mockExtra,
      );

      expect(mockRelation).toHaveBeenCalledWith('tags', 'abc-123');
      expect(mockAssociate).toHaveBeenCalledWith('xyz-456');
    });
  });
});
