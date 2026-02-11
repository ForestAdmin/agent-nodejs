import type { ForestServerClient } from '../../src/http-client';
import type { Logger } from '../../src/server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import declareUpdateTool from '../../src/tools/update';
import buildClient from '../../src/utils/agent-caller';
import withActivityLog from '../../src/utils/with-activity-log';
import createMockForestServerClient from '../helpers/forest-server-client';

jest.mock('../../src/utils/agent-caller');
jest.mock('../../src/utils/with-activity-log');

const mockLogger: Logger = jest.fn();

const mockBuildClient = buildClient as jest.MockedFunction<typeof buildClient>;
const mockWithActivityLog = withActivityLog as jest.MockedFunction<typeof withActivityLog>;

describe('declareUpdateTool', () => {
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
    it('should register a tool named "update"', () => {
      declareUpdateTool(mcpServer, mockForestServerClient, mockLogger);

      expect(mcpServer.registerTool).toHaveBeenCalledWith(
        'update',
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should register tool with correct title and description', () => {
      declareUpdateTool(mcpServer, mockForestServerClient, mockLogger);

      expect(registeredToolConfig.title).toBe('Update a record');
      expect(registeredToolConfig.description).toBe(
        'Update an existing record in the specified collection.',
      );
    });

    it('should define correct input schema', () => {
      declareUpdateTool(mcpServer, mockForestServerClient, mockLogger);

      expect(registeredToolConfig.inputSchema).toHaveProperty('collectionName');
      expect(registeredToolConfig.inputSchema).toHaveProperty('recordId');
      expect(registeredToolConfig.inputSchema).toHaveProperty('attributes');
    });

    it('should use string type for collectionName when no collection names provided', () => {
      declareUpdateTool(mcpServer, mockForestServerClient, mockLogger);

      const schema = registeredToolConfig.inputSchema as Record<
        string,
        { options?: string[]; parse: (value: unknown) => unknown }
      >;
      expect(schema.collectionName.options).toBeUndefined();
      expect(() => schema.collectionName.parse('any-collection')).not.toThrow();
    });

    it('should use enum type for collectionName when collection names provided', () => {
      declareUpdateTool(mcpServer, mockForestServerClient, mockLogger, ['users', 'products']);

      const schema = registeredToolConfig.inputSchema as Record<
        string,
        { options: string[]; parse: (value: unknown) => unknown }
      >;
      expect(schema.collectionName.options).toEqual(['users', 'products']);
      expect(() => schema.collectionName.parse('users')).not.toThrow();
      expect(() => schema.collectionName.parse('invalid-collection')).toThrow();
    });

    it('should accept both string and number for recordId', () => {
      declareUpdateTool(mcpServer, mockForestServerClient, mockLogger);

      const schema = registeredToolConfig.inputSchema as Record<
        string,
        { parse: (value: unknown) => unknown }
      >;
      expect(() => schema.recordId.parse('123')).not.toThrow();
      expect(() => schema.recordId.parse(123)).not.toThrow();
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
      declareUpdateTool(mcpServer, mockForestServerClient, mockLogger);
    });

    it('should call buildClient with the extra parameter', async () => {
      const mockUpdate = jest.fn().mockResolvedValue({ id: 1, name: 'Updated' });
      const mockCollection = jest.fn().mockReturnValue({ update: mockUpdate });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      await registeredToolHandler(
        { collectionName: 'users', recordId: 1, attributes: { name: 'Updated' } },
        mockExtra,
      );

      expect(mockBuildClient).toHaveBeenCalledWith(mockExtra);
    });

    it('should call rpcClient.collection with the collection name', async () => {
      const mockUpdate = jest.fn().mockResolvedValue({ id: 1, name: 'Updated' });
      const mockCollection = jest.fn().mockReturnValue({ update: mockUpdate });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      await registeredToolHandler(
        { collectionName: 'products', recordId: 1, attributes: { name: 'Updated' } },
        mockExtra,
      );

      expect(mockCollection).toHaveBeenCalledWith('products');
    });

    it('should call update with the recordId and attributes', async () => {
      const mockUpdate = jest
        .fn()
        .mockResolvedValue({ id: 1, name: 'Updated', email: 'new@test.com' });
      const mockCollection = jest.fn().mockReturnValue({ update: mockUpdate });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      const attributes = { name: 'Updated', email: 'new@test.com' };
      await registeredToolHandler({ collectionName: 'users', recordId: 42, attributes }, mockExtra);

      expect(mockUpdate).toHaveBeenCalledWith(42, attributes);
    });

    it('should return the updated record as JSON text content', async () => {
      const updatedRecord = { id: 1, name: 'Updated', email: 'new@test.com' };
      const mockUpdate = jest.fn().mockResolvedValue(updatedRecord);
      const mockCollection = jest.fn().mockReturnValue({ update: mockUpdate });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      const result = await registeredToolHandler(
        { collectionName: 'users', recordId: 1, attributes: { name: 'Updated' } },
        mockExtra,
      );

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify({ record: updatedRecord }) }],
      });
    });

    describe('activity logging', () => {
      beforeEach(() => {
        const mockUpdate = jest.fn().mockResolvedValue({ id: 1 });
        const mockCollection = jest.fn().mockReturnValue({ update: mockUpdate });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);
      });

      it('should call withActivityLog with correct parameters', async () => {
        await registeredToolHandler(
          { collectionName: 'users', recordId: 42, attributes: { name: 'Updated' } },
          mockExtra,
        );

        expect(mockWithActivityLog).toHaveBeenCalledWith({
          forestServerClient: mockForestServerClient,
          request: mockExtra,
          action: 'update',
          context: { collectionName: 'users', recordId: 42 },
          logger: mockLogger,
          operation: expect.any(Function),
        });
      });

      it('should wrap the update operation with activity logging', async () => {
        const mockUpdate = jest.fn().mockResolvedValue({ id: 1, name: 'Updated' });
        const mockCollection = jest.fn().mockReturnValue({ update: mockUpdate });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        await registeredToolHandler(
          { collectionName: 'users', recordId: 42, attributes: { name: 'Updated' } },
          mockExtra,
        );

        // Verify the operation was executed through withActivityLog
        expect(mockWithActivityLog).toHaveBeenCalled();
        expect(mockUpdate).toHaveBeenCalledWith(42, { name: 'Updated' });
      });
    });

    describe('attributes parsing', () => {
      it('should parse attributes sent as JSON string (LLM workaround)', () => {
        const attributes = { name: 'Updated', age: 31 };
        const attributesAsString = JSON.stringify(attributes);

        const inputSchema = registeredToolConfig.inputSchema as Record<
          string,
          { parse: (value: unknown) => unknown }
        >;
        const parsedAttributes = inputSchema.attributes.parse(attributesAsString);

        expect(parsedAttributes).toEqual(attributes);
      });

      it('should handle attributes as object when not sent as string', async () => {
        const mockUpdate = jest.fn().mockResolvedValue({ id: 1 });
        const mockCollection = jest.fn().mockReturnValue({ update: mockUpdate });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        const attributes = { name: 'Updated', age: 31 };
        await registeredToolHandler(
          { collectionName: 'users', recordId: 1, attributes },
          mockExtra,
        );

        expect(mockUpdate).toHaveBeenCalledWith(1, attributes);
      });
    });

    describe('error handling', () => {
      it('should parse error with nested error.text structure in message', async () => {
        const errorPayload = {
          error: {
            status: 404,
            text: JSON.stringify({
              errors: [{ name: 'NotFoundError', detail: 'Record not found' }],
            }),
          },
        };
        const agentError = new Error(JSON.stringify(errorPayload));
        const mockUpdate = jest.fn().mockRejectedValue(agentError);
        const mockCollection = jest.fn().mockReturnValue({ update: mockUpdate });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        const result = await registeredToolHandler(
          { collectionName: 'users', recordId: 999, attributes: {} },
          mockExtra,
        );
        expect(result).toEqual({
          content: [{ type: 'text', text: expect.stringContaining('Record not found') }],
          isError: true,
        });
      });

      it('should return error result when no parsable error found', async () => {
        const agentError = { unknownProperty: 'some value' };
        const mockUpdate = jest.fn().mockRejectedValue(agentError);
        const mockCollection = jest.fn().mockReturnValue({ update: mockUpdate });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        const result = await registeredToolHandler(
          { collectionName: 'users', recordId: 1, attributes: {} },
          mockExtra,
        );
        expect(result).toEqual({
          content: [{ type: 'text', text: '{"unknownProperty":"some value"}' }],
          isError: true,
        });
      });
    });
  });
});
