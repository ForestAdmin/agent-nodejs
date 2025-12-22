import type { Logger } from '../../src/server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import declareAssociateTool from '../../src/tools/associate';
import createActivityLog from '../../src/utils/activity-logs-creator';
import buildClient from '../../src/utils/agent-caller';

jest.mock('../../src/utils/agent-caller');
jest.mock('../../src/utils/activity-logs-creator');

const mockBuildClient = buildClient as jest.MockedFunction<typeof buildClient>;
const mockCreateActivityLog = createActivityLog as jest.MockedFunction<typeof createActivityLog>;

describe('declareAssociateTool', () => {
  let mcpServer: McpServer;
  let mockLogger: Logger;
  let registeredToolHandler: (options: unknown, extra: unknown) => Promise<unknown>;
  let registeredToolConfig: { title: string; description: string; inputSchema: unknown };

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = jest.fn();

    mcpServer = {
      registerTool: jest.fn((name, config, handler) => {
        registeredToolConfig = config;
        registeredToolHandler = handler;
      }),
    } as unknown as McpServer;

    mockCreateActivityLog.mockResolvedValue(undefined);
  });

  describe('tool registration', () => {
    it('should register a tool named "associate"', () => {
      declareAssociateTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      expect(mcpServer.registerTool).toHaveBeenCalledWith(
        'associate',
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should register tool with correct title and description', () => {
      declareAssociateTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      expect(registeredToolConfig.title).toBe('Associate records in a relation');
      expect(registeredToolConfig.description).toBe(
        'Link a record to another through a one-to-many or many-to-many relation. For many-to-many relations, this creates a new entry in the join table.',
      );
    });

    it('should define correct input schema', () => {
      declareAssociateTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      expect(registeredToolConfig.inputSchema).toHaveProperty('collectionName');
      expect(registeredToolConfig.inputSchema).toHaveProperty('relationName');
      expect(registeredToolConfig.inputSchema).toHaveProperty('parentRecordId');
      expect(registeredToolConfig.inputSchema).toHaveProperty('targetRecordId');
    });

    it('should use enum type for collectionName when collection names provided', () => {
      declareAssociateTool(mcpServer, 'https://api.forestadmin.com', mockLogger, [
        'users',
        'posts',
      ]);

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
      declareAssociateTool(mcpServer, 'https://api.forestadmin.com', mockLogger);
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

    it('should create an activity log', async () => {
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

      expect(mockCreateActivityLog).toHaveBeenCalledWith(
        'https://api.forestadmin.com',
        mockExtra,
        'associate',
        expect.objectContaining({
          collectionName: 'posts',
          recordId: 1,
        }),
      );
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
