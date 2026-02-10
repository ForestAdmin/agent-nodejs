import type { ForestServerClient } from '../../src/http-client';
import type { Logger } from '../../src/server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import declareDeleteTool from '../../src/tools/delete';
import buildClient from '../../src/utils/agent-caller';
import withActivityLog from '../../src/utils/with-activity-log';
import createMockForestServerClient from '../helpers/forest-server-client';

jest.mock('../../src/utils/agent-caller');
jest.mock('../../src/utils/with-activity-log');

const mockLogger: Logger = jest.fn();

const mockBuildClient = buildClient as jest.MockedFunction<typeof buildClient>;
const mockWithActivityLog = withActivityLog as jest.MockedFunction<typeof withActivityLog>;

describe('declareDeleteTool', () => {
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
    it('should register a tool named "delete"', () => {
      declareDeleteTool(mcpServer, mockForestServerClient, mockLogger);

      expect(mcpServer.registerTool).toHaveBeenCalledWith(
        'delete',
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should register tool with correct title and description', () => {
      declareDeleteTool(mcpServer, mockForestServerClient, mockLogger);

      expect(registeredToolConfig.title).toBe('Delete records');
      expect(registeredToolConfig.description).toBe(
        'Delete one or more records from the specified collection.',
      );
    });

    it('should define correct input schema', () => {
      declareDeleteTool(mcpServer, mockForestServerClient, mockLogger);

      expect(registeredToolConfig.inputSchema).toHaveProperty('collectionName');
      expect(registeredToolConfig.inputSchema).toHaveProperty('recordIds');
    });

    it('should use string type for collectionName when no collection names provided', () => {
      declareDeleteTool(mcpServer, mockForestServerClient, mockLogger);

      const schema = registeredToolConfig.inputSchema as Record<
        string,
        { options?: string[]; parse: (value: unknown) => unknown }
      >;
      expect(schema.collectionName.options).toBeUndefined();
      expect(() => schema.collectionName.parse('any-collection')).not.toThrow();
    });

    it('should use enum type for collectionName when collection names provided', () => {
      declareDeleteTool(mcpServer, mockForestServerClient, mockLogger, ['users', 'products']);

      const schema = registeredToolConfig.inputSchema as Record<
        string,
        { options: string[]; parse: (value: unknown) => unknown }
      >;
      expect(schema.collectionName.options).toEqual(['users', 'products']);
      expect(() => schema.collectionName.parse('users')).not.toThrow();
      expect(() => schema.collectionName.parse('invalid-collection')).toThrow();
    });

    it('should accept array of strings or numbers for recordIds', () => {
      declareDeleteTool(mcpServer, mockForestServerClient, mockLogger);

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
      declareDeleteTool(mcpServer, mockForestServerClient, mockLogger);
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
        content: [{ type: 'text', text: JSON.stringify({ deletedCount: 3 }) }],
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
        content: [{ type: 'text', text: JSON.stringify({ deletedCount: 1 }) }],
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

      it('should call withActivityLog with correct parameters', async () => {
        const recordIds = [1, 2, 3];
        await registeredToolHandler({ collectionName: 'users', recordIds }, mockExtra);

        expect(mockWithActivityLog).toHaveBeenCalledWith({
          forestServerClient: mockForestServerClient,
          request: mockExtra,
          action: 'delete',
          context: { collectionName: 'users', recordIds },
          logger: mockLogger,
          operation: expect.any(Function),
        });
      });

      it('should wrap the delete operation with activity logging', async () => {
        const mockDelete = jest.fn().mockResolvedValue(undefined);
        const mockCollection = jest.fn().mockReturnValue({ delete: mockDelete });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        const recordIds = [1, 2, 3];
        await registeredToolHandler({ collectionName: 'users', recordIds }, mockExtra);

        // Verify the operation was executed through withActivityLog
        expect(mockWithActivityLog).toHaveBeenCalled();
        expect(mockDelete).toHaveBeenCalledWith(recordIds);
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
