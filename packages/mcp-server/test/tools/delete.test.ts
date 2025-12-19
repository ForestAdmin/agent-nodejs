import type { Logger } from '../../src/server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import declareDeleteTool from '../../src/tools/delete';
import createActivityLog from '../../src/utils/activity-logs-creator';
import buildClient from '../../src/utils/agent-caller';

jest.mock('../../src/utils/agent-caller');
jest.mock('../../src/utils/activity-logs-creator');

const mockLogger: Logger = jest.fn();

const mockBuildClient = buildClient as jest.MockedFunction<typeof buildClient>;
const mockCreateActivityLog = createActivityLog as jest.MockedFunction<typeof createActivityLog>;

describe('declareDeleteTool', () => {
  let mcpServer: McpServer;
  let registeredToolHandler: (options: unknown, extra: unknown) => Promise<unknown>;
  let registeredToolConfig: { title: string; description: string; inputSchema: unknown };

  beforeEach(() => {
    jest.clearAllMocks();

    mcpServer = {
      registerTool: jest.fn((name, config, handler) => {
        registeredToolConfig = config;
        registeredToolHandler = handler;
      }),
    } as unknown as McpServer;

    mockCreateActivityLog.mockResolvedValue(undefined);
  });

  describe('tool registration', () => {
    it('should register a tool named "delete"', () => {
      declareDeleteTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      expect(mcpServer.registerTool).toHaveBeenCalledWith(
        'delete',
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should register tool with correct title and description', () => {
      declareDeleteTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      expect(registeredToolConfig.title).toBe('Delete records');
      expect(registeredToolConfig.description).toBe(
        'Delete one or more records from the specified collection.',
      );
    });

    it('should define correct input schema', () => {
      declareDeleteTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      expect(registeredToolConfig.inputSchema).toHaveProperty('collectionName');
      expect(registeredToolConfig.inputSchema).toHaveProperty('recordIds');
    });

    it('should use string type for collectionName when no collection names provided', () => {
      declareDeleteTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      const schema = registeredToolConfig.inputSchema as Record<
        string,
        { options?: string[]; parse: (value: unknown) => unknown }
      >;
      expect(schema.collectionName.options).toBeUndefined();
      expect(() => schema.collectionName.parse('any-collection')).not.toThrow();
    });

    it('should use enum type for collectionName when collection names provided', () => {
      declareDeleteTool(mcpServer, 'https://api.forestadmin.com', mockLogger, [
        'users',
        'products',
      ]);

      const schema = registeredToolConfig.inputSchema as Record<
        string,
        { options: string[]; parse: (value: unknown) => unknown }
      >;
      expect(schema.collectionName.options).toEqual(['users', 'products']);
      expect(() => schema.collectionName.parse('users')).not.toThrow();
      expect(() => schema.collectionName.parse('invalid-collection')).toThrow();
    });

    it('should accept array of strings or numbers for recordIds', () => {
      declareDeleteTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      const schema = registeredToolConfig.inputSchema as Record<
        string,
        { parse: (value: unknown) => unknown }
      >;
      expect(() => schema.recordIds.parse(['1', '2', '3'])).not.toThrow();
      expect(() => schema.recordIds.parse([1, 2, 3])).not.toThrow();
      expect(() => schema.recordIds.parse(['1', 2, '3'])).not.toThrow();
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
      declareDeleteTool(mcpServer, 'https://api.forestadmin.com', mockLogger);
    });

    it('should call buildClient with the extra parameter', async () => {
      const mockDelete = jest.fn().mockResolvedValue(undefined);
      const mockCollection = jest.fn().mockReturnValue({ delete: mockDelete });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      await registeredToolHandler({ collectionName: 'users', recordIds: [1, 2] }, mockExtra);

      expect(mockBuildClient).toHaveBeenCalledWith(mockExtra);
    });

    it('should call rpcClient.collection with the collection name', async () => {
      const mockDelete = jest.fn().mockResolvedValue(undefined);
      const mockCollection = jest.fn().mockReturnValue({ delete: mockDelete });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      await registeredToolHandler({ collectionName: 'products', recordIds: [1] }, mockExtra);

      expect(mockCollection).toHaveBeenCalledWith('products');
    });

    it('should call delete with the recordIds', async () => {
      const mockDelete = jest.fn().mockResolvedValue(undefined);
      const mockCollection = jest.fn().mockReturnValue({ delete: mockDelete });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      const recordIds = [1, 2, 3];
      await registeredToolHandler({ collectionName: 'users', recordIds }, mockExtra);

      expect(mockDelete).toHaveBeenCalledWith(recordIds);
    });

    it('should return success message with count', async () => {
      const mockDelete = jest.fn().mockResolvedValue(undefined);
      const mockCollection = jest.fn().mockReturnValue({ delete: mockDelete });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      const result = await registeredToolHandler(
        { collectionName: 'users', recordIds: [1, 2, 3] },
        mockExtra,
      );

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Successfully deleted 3 record(s) from users',
            }),
          },
        ],
      });
    });

    it('should handle single record deletion', async () => {
      const mockDelete = jest.fn().mockResolvedValue(undefined);
      const mockCollection = jest.fn().mockReturnValue({ delete: mockDelete });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      const result = await registeredToolHandler(
        { collectionName: 'users', recordIds: [42] },
        mockExtra,
      );

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Successfully deleted 1 record(s) from users',
            }),
          },
        ],
      });
    });

    describe('activity logging', () => {
      beforeEach(() => {
        const mockDelete = jest.fn().mockResolvedValue(undefined);
        const mockCollection = jest.fn().mockReturnValue({ delete: mockDelete });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);
      });

      it('should create activity log with "delete" action type and recordIds', async () => {
        const recordIds = [1, 2, 3];
        await registeredToolHandler({ collectionName: 'users', recordIds }, mockExtra);

        expect(mockCreateActivityLog).toHaveBeenCalledWith(
          'https://api.forestadmin.com',
          mockExtra,
          'delete',
          { collectionName: 'users', recordIds },
        );
      });
    });

    describe('error handling', () => {
      it('should parse error with nested error.text structure in message', async () => {
        const errorPayload = {
          error: {
            status: 403,
            text: JSON.stringify({
              errors: [{ name: 'ForbiddenError', detail: 'Cannot delete protected records' }],
            }),
          },
        };
        const agentError = new Error(JSON.stringify(errorPayload));
        const mockDelete = jest.fn().mockRejectedValue(agentError);
        const mockCollection = jest.fn().mockReturnValue({ delete: mockDelete });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        await expect(
          registeredToolHandler({ collectionName: 'users', recordIds: [1] }, mockExtra),
        ).rejects.toThrow('Cannot delete protected records');
      });

      it('should rethrow original error when no parsable error found', async () => {
        const agentError = { unknownProperty: 'some value' };
        const mockDelete = jest.fn().mockRejectedValue(agentError);
        const mockCollection = jest.fn().mockReturnValue({ delete: mockDelete });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        await expect(
          registeredToolHandler({ collectionName: 'users', recordIds: [1] }, mockExtra),
        ).rejects.toEqual(agentError);
      });
    });
  });
});
