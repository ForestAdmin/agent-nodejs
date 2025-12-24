import type { Logger } from '../../src/server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import declareCreateTool from '../../src/tools/create';
import buildClient from '../../src/utils/agent-caller';
import withActivityLog from '../../src/utils/with-activity-log';

jest.mock('../../src/utils/agent-caller');
jest.mock('../../src/utils/with-activity-log');

const mockLogger: Logger = jest.fn();

const mockBuildClient = buildClient as jest.MockedFunction<typeof buildClient>;
const mockWithActivityLog = withActivityLog as jest.MockedFunction<typeof withActivityLog>;

describe('declareCreateTool', () => {
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

    // By default, withActivityLog executes the operation and returns its result
    mockWithActivityLog.mockImplementation(async options => options.operation());
  });

  describe('tool registration', () => {
    it('should register a tool named "create"', () => {
      declareCreateTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      expect(mcpServer.registerTool).toHaveBeenCalledWith(
        'create',
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should register tool with correct title and description', () => {
      declareCreateTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      expect(registeredToolConfig.title).toBe('Create a record');
      expect(registeredToolConfig.description).toBe(
        'Create a new record in the specified collection.',
      );
    });

    it('should define correct input schema', () => {
      declareCreateTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      expect(registeredToolConfig.inputSchema).toHaveProperty('collectionName');
      expect(registeredToolConfig.inputSchema).toHaveProperty('attributes');
    });

    it('should use string type for collectionName when no collection names provided', () => {
      declareCreateTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      const schema = registeredToolConfig.inputSchema as Record<
        string,
        { options?: string[]; parse: (value: unknown) => unknown }
      >;
      expect(schema.collectionName.options).toBeUndefined();
      expect(() => schema.collectionName.parse('any-collection')).not.toThrow();
    });

    it('should use enum type for collectionName when collection names provided', () => {
      declareCreateTool(mcpServer, 'https://api.forestadmin.com', mockLogger, [
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
      declareCreateTool(mcpServer, 'https://api.forestadmin.com', mockLogger);
    });

    it('should call buildClient with the extra parameter', async () => {
      const mockCreate = jest.fn().mockResolvedValue({ id: 1, name: 'New Record' });
      const mockCollection = jest.fn().mockReturnValue({ create: mockCreate });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      await registeredToolHandler(
        { collectionName: 'users', attributes: { name: 'John' } },
        mockExtra,
      );

      expect(mockBuildClient).toHaveBeenCalledWith(mockExtra);
    });

    it('should call rpcClient.collection with the collection name', async () => {
      const mockCreate = jest.fn().mockResolvedValue({ id: 1, name: 'New Record' });
      const mockCollection = jest.fn().mockReturnValue({ create: mockCreate });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      await registeredToolHandler(
        { collectionName: 'products', attributes: { name: 'Product' } },
        mockExtra,
      );

      expect(mockCollection).toHaveBeenCalledWith('products');
    });

    it('should call create with the attributes', async () => {
      const mockCreate = jest
        .fn()
        .mockResolvedValue({ id: 1, name: 'John', email: 'john@test.com' });
      const mockCollection = jest.fn().mockReturnValue({ create: mockCreate });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      const attributes = { name: 'John', email: 'john@test.com' };
      await registeredToolHandler({ collectionName: 'users', attributes }, mockExtra);

      expect(mockCreate).toHaveBeenCalledWith(attributes);
    });

    it('should return the created record as JSON text content', async () => {
      const createdRecord = { id: 1, name: 'John', email: 'john@test.com' };
      const mockCreate = jest.fn().mockResolvedValue(createdRecord);
      const mockCollection = jest.fn().mockReturnValue({ create: mockCreate });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      const result = await registeredToolHandler(
        { collectionName: 'users', attributes: { name: 'John', email: 'john@test.com' } },
        mockExtra,
      );

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify({ record: createdRecord }) }],
      });
    });

    describe('activity logging', () => {
      beforeEach(() => {
        const mockCreate = jest.fn().mockResolvedValue({ id: 1 });
        const mockCollection = jest.fn().mockReturnValue({ create: mockCreate });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);
      });

      it('should call withActivityLog with correct parameters', async () => {
        await registeredToolHandler(
          { collectionName: 'users', attributes: { name: 'John' } },
          mockExtra,
        );

        expect(mockWithActivityLog).toHaveBeenCalledWith({
          forestServerUrl: 'https://api.forestadmin.com',
          request: mockExtra,
          action: 'create',
          context: { collectionName: 'users' },
          logger: mockLogger,
          operation: expect.any(Function),
        });
      });

      it('should wrap the create operation with activity logging', async () => {
        const mockCreate = jest.fn().mockResolvedValue({ id: 1, name: 'John' });
        const mockCollection = jest.fn().mockReturnValue({ create: mockCreate });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        await registeredToolHandler(
          { collectionName: 'users', attributes: { name: 'John' } },
          mockExtra,
        );

        // Verify the operation was executed through withActivityLog
        expect(mockWithActivityLog).toHaveBeenCalled();
        expect(mockCreate).toHaveBeenCalledWith({ name: 'John' });
      });
    });

    describe('attributes parsing', () => {
      it('should parse attributes sent as JSON string (LLM workaround)', () => {
        const attributes = { name: 'John', age: 30 };
        const attributesAsString = JSON.stringify(attributes);

        const inputSchema = registeredToolConfig.inputSchema as Record<
          string,
          { parse: (value: unknown) => unknown }
        >;
        const parsedAttributes = inputSchema.attributes.parse(attributesAsString);

        expect(parsedAttributes).toEqual(attributes);
      });

      it('should handle attributes as object when not sent as string', async () => {
        const mockCreate = jest.fn().mockResolvedValue({ id: 1 });
        const mockCollection = jest.fn().mockReturnValue({ create: mockCreate });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        const attributes = { name: 'John', age: 30 };
        await registeredToolHandler({ collectionName: 'users', attributes }, mockExtra);

        expect(mockCreate).toHaveBeenCalledWith(attributes);
      });
    });

    describe('error handling', () => {
      it('should parse error with nested error.text structure in message', async () => {
        const errorPayload = {
          error: {
            status: 400,
            text: JSON.stringify({
              errors: [{ name: 'ValidationError', detail: 'Name is required' }],
            }),
          },
        };
        const agentError = new Error(JSON.stringify(errorPayload));
        const mockCreate = jest.fn().mockRejectedValue(agentError);
        const mockCollection = jest.fn().mockReturnValue({ create: mockCreate });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        await expect(
          registeredToolHandler({ collectionName: 'users', attributes: {} }, mockExtra),
        ).rejects.toThrow('Name is required');
      });

      it('should rethrow original error when no parsable error found', async () => {
        const agentError = { unknownProperty: 'some value' };
        const mockCreate = jest.fn().mockRejectedValue(agentError);
        const mockCollection = jest.fn().mockReturnValue({ create: mockCreate });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        await expect(
          registeredToolHandler({ collectionName: 'users', attributes: {} }, mockExtra),
        ).rejects.toEqual(agentError);
      });
    });
  });
});
