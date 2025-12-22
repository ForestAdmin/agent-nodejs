import type { Logger } from '../../src/server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import declareDissociateTool from '../../src/tools/dissociate';
import createActivityLog from '../../src/utils/activity-logs-creator';
import buildClient from '../../src/utils/agent-caller';

jest.mock('../../src/utils/agent-caller');
jest.mock('../../src/utils/activity-logs-creator');

const mockBuildClient = buildClient as jest.MockedFunction<typeof buildClient>;
const mockCreateActivityLog = createActivityLog as jest.MockedFunction<typeof createActivityLog>;

describe('declareDissociateTool', () => {
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
    it('should register a tool named "dissociate"', () => {
      declareDissociateTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      expect(mcpServer.registerTool).toHaveBeenCalledWith(
        'dissociate',
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should register tool with correct title and description', () => {
      declareDissociateTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      expect(registeredToolConfig.title).toBe('Dissociate records from a relation');
      expect(registeredToolConfig.description).toBe(
        'Unlink records from a one-to-many or many-to-many relation. For many-to-many relations, this removes entries from the join table without deleting the target records.',
      );
    });

    it('should define correct input schema', () => {
      declareDissociateTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      expect(registeredToolConfig.inputSchema).toHaveProperty('collectionName');
      expect(registeredToolConfig.inputSchema).toHaveProperty('relationName');
      expect(registeredToolConfig.inputSchema).toHaveProperty('parentRecordId');
      expect(registeredToolConfig.inputSchema).toHaveProperty('targetRecordIds');
    });

    it('should use enum type for collectionName when collection names provided', () => {
      declareDissociateTool(mcpServer, 'https://api.forestadmin.com', mockLogger, [
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
      declareDissociateTool(mcpServer, 'https://api.forestadmin.com', mockLogger);
    });

    it('should call dissociate on the relation', async () => {
      const mockDissociate = jest.fn().mockResolvedValue(undefined);
      const mockRelation = jest.fn().mockReturnValue({ dissociate: mockDissociate });
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
          targetRecordIds: [42, 43],
        },
        mockExtra,
      )) as { content: { type: string; text: string }[] };

      expect(mockCollection).toHaveBeenCalledWith('posts');
      expect(mockRelation).toHaveBeenCalledWith('tags', 1);
      expect(mockDissociate).toHaveBeenCalledWith([42, 43]);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
    });

    it('should create an activity log', async () => {
      const mockDissociate = jest.fn().mockResolvedValue(undefined);
      const mockRelation = jest.fn().mockReturnValue({ dissociate: mockDissociate });
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
          targetRecordIds: [42, 43],
        },
        mockExtra,
      );

      expect(mockCreateActivityLog).toHaveBeenCalledWith(
        'https://api.forestadmin.com',
        mockExtra,
        'dissociate',
        expect.objectContaining({
          collectionName: 'posts',
          recordId: 1,
        }),
      );
    });

    it('should handle string record ids', async () => {
      const mockDissociate = jest.fn().mockResolvedValue(undefined);
      const mockRelation = jest.fn().mockReturnValue({ dissociate: mockDissociate });
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
          targetRecordIds: ['xyz-456', 'def-789'],
        },
        mockExtra,
      );

      expect(mockRelation).toHaveBeenCalledWith('tags', 'abc-123');
      expect(mockDissociate).toHaveBeenCalledWith(['xyz-456', 'def-789']);
    });

    it('should handle single record dissociation', async () => {
      const mockDissociate = jest.fn().mockResolvedValue(undefined);
      const mockRelation = jest.fn().mockReturnValue({ dissociate: mockDissociate });
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
          targetRecordIds: [99],
        },
        mockExtra,
      )) as { content: { type: string; text: string }[] };

      expect(mockDissociate).toHaveBeenCalledWith([99]);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.message).toContain('1 record(s)');
    });
  });
});
