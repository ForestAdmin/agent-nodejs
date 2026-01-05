import type { McpHttpClient } from '../../src/http-client';
import type { Logger } from '../../src/server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import declareListRelatedTool from '../../src/tools/list-related';
import buildClient from '../../src/utils/agent-caller';
import * as schemaFetcher from '../../src/utils/schema-fetcher';
import withActivityLog from '../../src/utils/with-activity-log';
import createMockHttpClient from '../helpers/mcp-http-client';

jest.mock('../../src/utils/agent-caller');
jest.mock('../../src/utils/with-activity-log');
jest.mock('../../src/utils/schema-fetcher');

const mockBuildClient = buildClient as jest.MockedFunction<typeof buildClient>;
const mockWithActivityLog = withActivityLog as jest.MockedFunction<typeof withActivityLog>;
const mockFetchForestSchema = schemaFetcher.fetchForestSchema as jest.MockedFunction<
  typeof schemaFetcher.fetchForestSchema
>;
const mockGetFieldsOfCollection = schemaFetcher.getFieldsOfCollection as jest.MockedFunction<
  typeof schemaFetcher.getFieldsOfCollection
>;

describe('declareListRelatedTool', () => {
  let mcpServer: McpServer;
  let mockLogger: Logger;
  let mockHttpClient: jest.Mocked<McpHttpClient>;
  let registeredToolHandler: (options: unknown, extra: unknown) => Promise<unknown>;
  let registeredToolConfig: { title: string; description: string; inputSchema: unknown };

  beforeEach(() => {
    jest.clearAllMocks();

    mockHttpClient = createMockHttpClient();

    // Create a mock logger
    mockLogger = jest.fn();

    // Create a mock MCP server that captures the registered tool
    mcpServer = {
      registerTool: jest.fn((name, config, handler) => {
        registeredToolConfig = config;
        registeredToolHandler = handler;
      }),
    } as unknown as McpServer;

    // By default, withActivityLog executes the operation and handles errors with enhancement
    mockWithActivityLog.mockImplementation(async options => {
      try {
        return await options.operation();
      } catch (error) {
        let errorMessage = error instanceof Error ? error.message : String(error);

        // Try to parse JSON:API error format
        try {
          const parsed = JSON.parse(errorMessage);

          if (parsed.error?.text) {
            const textParsed = JSON.parse(parsed.error.text);

            if (textParsed.errors?.[0]?.detail) {
              errorMessage = textParsed.errors[0].detail;
            }
          }
        } catch {
          // Not a JSON error, use as-is
        }

        // Apply error enhancer if provided
        if (options.errorEnhancer) {
          errorMessage = await options.errorEnhancer(errorMessage, error);
        }

        throw new Error(errorMessage);
      }
    });
  });

  describe('tool registration', () => {
    it('should register a tool named "listRelated"', () => {
      declareListRelatedTool(mcpServer, mockHttpClient, mockLogger);

      expect(mcpServer.registerTool).toHaveBeenCalledWith(
        'listRelated',
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should register tool with correct title and description', () => {
      declareListRelatedTool(mcpServer, mockHttpClient, mockLogger);

      expect(registeredToolConfig.title).toBe('List records from a relation');
      expect(registeredToolConfig.description).toBe(
        'Retrieve a list of records from a one-to-many or many-to-many relation.',
      );
    });

    it('should define correct input schema', () => {
      declareListRelatedTool(mcpServer, mockHttpClient, mockLogger);

      expect(registeredToolConfig.inputSchema).toHaveProperty('collectionName');
      expect(registeredToolConfig.inputSchema).toHaveProperty('relationName');
      expect(registeredToolConfig.inputSchema).toHaveProperty('parentRecordId');
      expect(registeredToolConfig.inputSchema).toHaveProperty('search');
      expect(registeredToolConfig.inputSchema).toHaveProperty('filters');
      expect(registeredToolConfig.inputSchema).toHaveProperty('sort');
    });

    it('should use string type for collectionName when no collection names provided', () => {
      declareListRelatedTool(mcpServer, mockHttpClient, mockLogger);

      const schema = registeredToolConfig.inputSchema as Record<
        string,
        { options?: string[]; parse: (value: unknown) => unknown }
      >;
      // String type should not have options property (enum has options)
      expect(schema.collectionName.options).toBeUndefined();
      // Should accept any string
      expect(() => schema.collectionName.parse('any-collection')).not.toThrow();
    });

    it('should use string type for collectionName when empty array provided', () => {
      declareListRelatedTool(mcpServer, mockHttpClient, mockLogger, []);

      const schema = registeredToolConfig.inputSchema as Record<
        string,
        { options?: string[]; parse: (value: unknown) => unknown }
      >;
      // String type should not have options property
      expect(schema.collectionName.options).toBeUndefined();
      // Should accept any string
      expect(() => schema.collectionName.parse('any-collection')).not.toThrow();
    });

    it('should use enum type for collectionName when collection names provided', () => {
      declareListRelatedTool(mcpServer, mockHttpClient, mockLogger, [
        'users',
        'products',
        'orders',
      ]);

      const schema = registeredToolConfig.inputSchema as Record<
        string,
        { options: string[]; parse: (value: unknown) => unknown }
      >;
      // Enum type should have options property with the collection names
      expect(schema.collectionName.options).toEqual(['users', 'products', 'orders']);
      // Should accept valid collection names
      expect(() => schema.collectionName.parse('users')).not.toThrow();
      expect(() => schema.collectionName.parse('products')).not.toThrow();
      // Should reject invalid collection names
      expect(() => schema.collectionName.parse('invalid-collection')).toThrow();
    });

    it('should accept string parentRecordId', () => {
      declareListRelatedTool(mcpServer, mockHttpClient, mockLogger);

      const schema = registeredToolConfig.inputSchema as Record<
        string,
        { parse: (value: unknown) => unknown }
      >;
      expect(() => schema.parentRecordId.parse('abc-123')).not.toThrow();
    });

    it('should accept number parentRecordId', () => {
      declareListRelatedTool(mcpServer, mockHttpClient, mockLogger);

      const schema = registeredToolConfig.inputSchema as Record<
        string,
        { parse: (value: unknown) => unknown }
      >;
      expect(() => schema.parentRecordId.parse(123)).not.toThrow();
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
      declareListRelatedTool(mcpServer, mockHttpClient, mockLogger);
    });

    it('should call buildClient with the extra parameter', async () => {
      const mockList = jest.fn().mockResolvedValue([{ id: 1, name: 'Item 1' }]);
      const mockRelation = jest.fn().mockReturnValue({ list: mockList });
      const mockCollection = jest.fn().mockReturnValue({ relation: mockRelation });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      await registeredToolHandler(
        { collectionName: 'users', relationName: 'orders', parentRecordId: 1 },
        mockExtra,
      );

      expect(mockBuildClient).toHaveBeenCalledWith(mockExtra);
    });

    it('should call rpcClient.collection with the collection name', async () => {
      const mockList = jest.fn().mockResolvedValue([]);
      const mockRelation = jest.fn().mockReturnValue({ list: mockList });
      const mockCollection = jest.fn().mockReturnValue({ relation: mockRelation });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      await registeredToolHandler(
        { collectionName: 'users', relationName: 'orders', parentRecordId: 1 },
        mockExtra,
      );

      expect(mockCollection).toHaveBeenCalledWith('users');
    });

    it('should call relation with the relation name and parent record id', async () => {
      const mockList = jest.fn().mockResolvedValue([]);
      const mockRelation = jest.fn().mockReturnValue({ list: mockList });
      const mockCollection = jest.fn().mockReturnValue({ relation: mockRelation });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      await registeredToolHandler(
        { collectionName: 'users', relationName: 'orders', parentRecordId: 42 },
        mockExtra,
      );

      expect(mockRelation).toHaveBeenCalledWith('orders', 42);
    });

    it('should call relation with string parentRecordId', async () => {
      const mockList = jest.fn().mockResolvedValue([]);
      const mockRelation = jest.fn().mockReturnValue({ list: mockList });
      const mockCollection = jest.fn().mockReturnValue({ relation: mockRelation });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      await registeredToolHandler(
        { collectionName: 'users', relationName: 'orders', parentRecordId: 'uuid-123' },
        mockExtra,
      );

      expect(mockRelation).toHaveBeenCalledWith('orders', 'uuid-123');
    });

    it('should return results as JSON text content with records wrapper', async () => {
      const mockData = [
        { id: 1, name: 'Order 1' },
        { id: 2, name: 'Order 2' },
      ];
      const mockList = jest.fn().mockResolvedValue(mockData);
      const mockRelation = jest.fn().mockReturnValue({ list: mockList });
      const mockCollection = jest.fn().mockReturnValue({ relation: mockRelation });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      const result = await registeredToolHandler(
        { collectionName: 'users', relationName: 'orders', parentRecordId: 1 },
        mockExtra,
      );

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify({ records: mockData }) }],
      });
    });

    it('should return records with totalCount when enableCount is true', async () => {
      const mockData = [{ id: 1, name: 'Order 1' }];
      const mockList = jest.fn().mockResolvedValue(mockData);
      const mockCount = jest.fn().mockResolvedValue(42);
      const mockRelation = jest.fn().mockReturnValue({ list: mockList, count: mockCount });
      const mockCollection = jest.fn().mockReturnValue({ relation: mockRelation });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      const result = await registeredToolHandler(
        { collectionName: 'users', relationName: 'orders', parentRecordId: 1, enableCount: true },
        mockExtra,
      );

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify({ records: mockData, totalCount: 42 }) }],
      });
    });

    it('should call list and count in parallel when enableCount is true', async () => {
      const mockList = jest.fn().mockResolvedValue([]);
      const mockCount = jest.fn().mockResolvedValue(0);
      const mockRelation = jest.fn().mockReturnValue({ list: mockList, count: mockCount });
      const mockCollection = jest.fn().mockReturnValue({ relation: mockRelation });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      await registeredToolHandler(
        { collectionName: 'users', relationName: 'orders', parentRecordId: 1, enableCount: true },
        mockExtra,
      );

      expect(mockList).toHaveBeenCalled();
      expect(mockCount).toHaveBeenCalled();
    });

    describe('activity logging', () => {
      beforeEach(() => {
        const mockList = jest.fn().mockResolvedValue([]);
        const mockRelation = jest.fn().mockReturnValue({ list: mockList });
        const mockCollection = jest.fn().mockReturnValue({ relation: mockRelation });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);
      });

      it('should call withActivityLog with "listRelatedData" action and relation label', async () => {
        await registeredToolHandler(
          { collectionName: 'users', relationName: 'orders', parentRecordId: 42 },
          mockExtra,
        );

        expect(mockWithActivityLog).toHaveBeenCalledWith({
          httpClient: mockHttpClient,
          request: mockExtra,
          action: 'listRelatedData',
          context: {
            collectionName: 'users',
            recordId: 42,
            label: 'list relation "orders"',
          },
          logger: mockLogger,
          operation: expect.any(Function),
          errorEnhancer: expect.any(Function),
        });
      });

      it('should include parentRecordId in activity log context', async () => {
        await registeredToolHandler(
          { collectionName: 'products', relationName: 'reviews', parentRecordId: 'prod-123' },
          mockExtra,
        );

        expect(mockWithActivityLog).toHaveBeenCalledWith({
          httpClient: mockHttpClient,
          request: mockExtra,
          action: 'listRelatedData',
          context: {
            collectionName: 'products',
            recordId: 'prod-123',
            label: 'list relation "reviews"',
          },
          logger: mockLogger,
          operation: expect.any(Function),
          errorEnhancer: expect.any(Function),
        });
      });

      it('should include "with search" in label when search is used', async () => {
        await registeredToolHandler(
          { collectionName: 'users', relationName: 'orders', parentRecordId: 1, search: 'test' },
          mockExtra,
        );

        expect(mockWithActivityLog).toHaveBeenCalledWith({
          httpClient: mockHttpClient,
          request: mockExtra,
          action: 'listRelatedData',
          context: {
            collectionName: 'users',
            recordId: 1,
            label: 'list relation "orders" with search',
          },
          logger: mockLogger,
          operation: expect.any(Function),
          errorEnhancer: expect.any(Function),
        });
      });

      it('should include "with filter" in label when filters are used', async () => {
        await registeredToolHandler(
          {
            collectionName: 'users',
            relationName: 'orders',
            parentRecordId: 1,
            filters: { field: 'status', operator: 'Equal', value: 'pending' },
          },
          mockExtra,
        );

        expect(mockWithActivityLog).toHaveBeenCalledWith({
          httpClient: mockHttpClient,
          request: mockExtra,
          action: 'listRelatedData',
          context: {
            collectionName: 'users',
            recordId: 1,
            label: 'list relation "orders" with filter',
          },
          logger: mockLogger,
          operation: expect.any(Function),
          errorEnhancer: expect.any(Function),
        });
      });

      it('should include "with search and filter" in label when both are used', async () => {
        await registeredToolHandler(
          {
            collectionName: 'users',
            relationName: 'orders',
            parentRecordId: 1,
            search: 'test',
            filters: { field: 'status', operator: 'Equal', value: 'pending' },
          },
          mockExtra,
        );

        expect(mockWithActivityLog).toHaveBeenCalledWith({
          httpClient: mockHttpClient,
          request: mockExtra,
          action: 'listRelatedData',
          context: {
            collectionName: 'users',
            recordId: 1,
            label: 'list relation "orders" with search and filter',
          },
          logger: mockLogger,
          operation: expect.any(Function),
          errorEnhancer: expect.any(Function),
        });
      });
    });

    describe('list parameters', () => {
      let mockList: jest.Mock;
      let mockRelation: jest.Mock;
      let mockCollection: jest.Mock;

      beforeEach(() => {
        mockList = jest.fn().mockResolvedValue([]);
        mockRelation = jest.fn().mockReturnValue({ list: mockList });
        mockCollection = jest.fn().mockReturnValue({ relation: mockRelation });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);
      });

      it('should call list with basic parameters', async () => {
        await registeredToolHandler(
          { collectionName: 'users', relationName: 'orders', parentRecordId: 1 },
          mockExtra,
        );

        expect(mockList).toHaveBeenCalledWith({
          collectionName: 'users',
          relationName: 'orders',
          parentRecordId: 1,
        });
      });

      it('should pass search parameter to list', async () => {
        await registeredToolHandler(
          {
            collectionName: 'users',
            relationName: 'orders',
            parentRecordId: 1,
            search: 'test query',
          },
          mockExtra,
        );

        expect(mockList).toHaveBeenCalledWith({
          collectionName: 'users',
          relationName: 'orders',
          parentRecordId: 1,
          search: 'test query',
        });
      });

      it('should pass filters to list', async () => {
        const filters = { field: 'status', operator: 'Equal', value: 'completed' };

        await registeredToolHandler(
          { collectionName: 'users', relationName: 'orders', parentRecordId: 1, filters },
          mockExtra,
        );

        expect(mockList).toHaveBeenCalledWith({
          collectionName: 'users',
          relationName: 'orders',
          parentRecordId: 1,
          filters,
        });
      });

      it('should pass sort parameter when both field and ascending are provided', async () => {
        await registeredToolHandler(
          {
            collectionName: 'users',
            relationName: 'orders',
            parentRecordId: 1,
            sort: { field: 'createdAt', ascending: true },
          },
          mockExtra,
        );

        expect(mockList).toHaveBeenCalledWith({
          collectionName: 'users',
          relationName: 'orders',
          parentRecordId: 1,
          sort: { field: 'createdAt', ascending: true },
        });
      });

      it('should pass sort parameter when ascending is false', async () => {
        await registeredToolHandler(
          {
            collectionName: 'users',
            relationName: 'orders',
            parentRecordId: 1,
            sort: { field: 'createdAt', ascending: false },
          },
          mockExtra,
        );

        expect(mockList).toHaveBeenCalledWith({
          collectionName: 'users',
          relationName: 'orders',
          parentRecordId: 1,
          sort: { field: 'createdAt', ascending: false },
        });
      });

      it('should pass all parameters together', async () => {
        const filters = {
          aggregator: 'And',
          conditions: [{ field: 'status', operator: 'Equal', value: 'pending' }],
        };

        await registeredToolHandler(
          {
            collectionName: 'users',
            relationName: 'orders',
            parentRecordId: 1,
            search: 'test',
            filters,
            sort: { field: 'total', ascending: false },
          },
          mockExtra,
        );

        expect(mockList).toHaveBeenCalledWith({
          collectionName: 'users',
          relationName: 'orders',
          parentRecordId: 1,
          search: 'test',
          filters,
          sort: { field: 'total', ascending: false },
        });
      });
    });

    describe('error handling', () => {
      let mockList: jest.Mock;
      let mockRelation: jest.Mock;
      let mockCollection: jest.Mock;

      beforeEach(() => {
        mockList = jest.fn();
        mockRelation = jest.fn().mockReturnValue({ list: mockList });
        mockCollection = jest.fn().mockReturnValue({ relation: mockRelation });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);
      });

      it('should parse error with nested error.text structure in message', async () => {
        const errorPayload = {
          error: {
            status: 400,
            text: JSON.stringify({
              errors: [{ name: 'ValidationError', detail: 'Invalid filters provided' }],
            }),
          },
        };
        const agentError = new Error(JSON.stringify(errorPayload));
        mockList.mockRejectedValue(agentError);

        mockFetchForestSchema.mockResolvedValue({ collections: [] });
        mockGetFieldsOfCollection.mockReturnValue([]);

        await expect(
          registeredToolHandler(
            { collectionName: 'users', relationName: 'orders', parentRecordId: 1 },
            mockExtra,
          ),
        ).rejects.toThrow('Invalid filters provided');
      });

      it('should parse error with direct text property in message', async () => {
        const errorPayload = {
          text: JSON.stringify({
            errors: [{ name: 'ValidationError', detail: 'Direct text error' }],
          }),
        };
        const agentError = new Error(JSON.stringify(errorPayload));
        mockList.mockRejectedValue(agentError);

        mockFetchForestSchema.mockResolvedValue({ collections: [] });
        mockGetFieldsOfCollection.mockReturnValue([]);

        await expect(
          registeredToolHandler(
            { collectionName: 'users', relationName: 'orders', parentRecordId: 1 },
            mockExtra,
          ),
        ).rejects.toThrow('Direct text error');
      });

      it('should provide helpful error message for Invalid sort errors', async () => {
        const errorPayload = {
          error: {
            status: 400,
            text: JSON.stringify({
              errors: [{ name: 'ValidationError', detail: 'Invalid sort field: invalidField' }],
            }),
          },
        };
        const agentError = new Error(JSON.stringify(errorPayload));
        mockList.mockRejectedValue(agentError);

        const mockFields: schemaFetcher.ForestField[] = [
          {
            field: 'id',
            type: 'Number',
            isSortable: true,
            enum: null,
            reference: null,
            isReadOnly: false,
            isRequired: true,
            isPrimaryKey: true,
          },
          {
            field: 'total',
            type: 'Number',
            isSortable: true,
            enum: null,
            reference: null,
            isReadOnly: false,
            isRequired: false,
            isPrimaryKey: false,
          },
          {
            field: 'computed',
            type: 'String',
            isSortable: false,
            enum: null,
            reference: null,
            isReadOnly: true,
            isRequired: false,
            isPrimaryKey: false,
          },
        ];
        const mockSchema: schemaFetcher.ForestSchema = {
          collections: [{ name: 'users', fields: mockFields }],
        };
        mockFetchForestSchema.mockResolvedValue(mockSchema);
        mockGetFieldsOfCollection.mockReturnValue(mockFields);

        await expect(
          registeredToolHandler(
            { collectionName: 'users', relationName: 'orders', parentRecordId: 1 },
            mockExtra,
          ),
        ).rejects.toThrow(
          'The sort field provided is invalid for this collection. Available fields for the collection users are: id, total.',
        );

        expect(mockFetchForestSchema).toHaveBeenCalledWith(mockHttpClient);
        expect(mockGetFieldsOfCollection).toHaveBeenCalledWith(mockSchema, 'users');
      });

      it('should provide helpful error message when relation is not found', async () => {
        const agentError = new Error('Relation not found');
        mockList.mockRejectedValue(agentError);

        const mockFields: schemaFetcher.ForestField[] = [
          {
            field: 'id',
            type: 'Number',
            isSortable: true,
            enum: null,
            reference: null,
            isReadOnly: false,
            isRequired: true,
            isPrimaryKey: true,
            relationship: null,
          },
          {
            field: 'orders',
            type: 'HasMany',
            isSortable: false,
            enum: null,
            reference: 'orders',
            isReadOnly: true,
            isRequired: false,
            isPrimaryKey: false,
            relationship: 'HasMany',
          },
          {
            field: 'reviews',
            type: 'HasMany',
            isSortable: false,
            enum: null,
            reference: 'reviews',
            isReadOnly: true,
            isRequired: false,
            isPrimaryKey: false,
            relationship: 'HasMany',
          },
        ];
        const mockSchema: schemaFetcher.ForestSchema = {
          collections: [{ name: 'users', fields: mockFields }],
        };
        mockFetchForestSchema.mockResolvedValue(mockSchema);
        mockGetFieldsOfCollection.mockReturnValue(mockFields);

        await expect(
          registeredToolHandler(
            { collectionName: 'users', relationName: 'invalidRelation', parentRecordId: 1 },
            mockExtra,
          ),
        ).rejects.toThrow(
          'The relation name provided is invalid for this collection. Available relations for collection users are: orders, reviews.',
        );
      });

      it('should include BelongsToMany relations in available relations error message', async () => {
        const agentError = new Error('Relation not found');
        mockList.mockRejectedValue(agentError);

        const mockFields: schemaFetcher.ForestField[] = [
          {
            field: 'orders',
            type: 'HasMany',
            isSortable: false,
            enum: null,
            reference: 'orders',
            isReadOnly: true,
            isRequired: false,
            isPrimaryKey: false,
            relationship: 'HasMany',
          },
          {
            field: 'tags',
            type: 'BelongsToMany',
            isSortable: false,
            enum: null,
            reference: 'tags',
            isReadOnly: true,
            isRequired: false,
            isPrimaryKey: false,
            relationship: 'BelongsToMany',
          },
        ];
        const mockSchema: schemaFetcher.ForestSchema = {
          collections: [{ name: 'users', fields: mockFields }],
        };
        mockFetchForestSchema.mockResolvedValue(mockSchema);
        mockGetFieldsOfCollection.mockReturnValue(mockFields);

        await expect(
          registeredToolHandler(
            { collectionName: 'users', relationName: 'invalidRelation', parentRecordId: 1 },
            mockExtra,
          ),
        ).rejects.toThrow(
          'The relation name provided is invalid for this collection. Available relations for collection users are: orders, tags.',
        );
      });

      it('should not show relation error when relation exists but error is different', async () => {
        const agentError = new Error('Some other error');
        mockList.mockRejectedValue(agentError);

        const mockFields: schemaFetcher.ForestField[] = [
          {
            field: 'orders',
            type: 'HasMany',
            isSortable: false,
            enum: null,
            reference: 'orders',
            isReadOnly: true,
            isRequired: false,
            isPrimaryKey: false,
            relationship: 'HasMany',
          },
        ];
        const mockSchema: schemaFetcher.ForestSchema = {
          collections: [{ name: 'users', fields: mockFields }],
        };
        mockFetchForestSchema.mockResolvedValue(mockSchema);
        mockGetFieldsOfCollection.mockReturnValue(mockFields);

        // Should throw the original error message since 'orders' relation exists
        await expect(
          registeredToolHandler(
            { collectionName: 'users', relationName: 'orders', parentRecordId: 1 },
            mockExtra,
          ),
        ).rejects.toThrow('Some other error');
      });

      it('should fall back to error.message when message is not valid JSON', async () => {
        const agentError = new Error('Plain error message');
        mockList.mockRejectedValue(agentError);

        const mockFields: schemaFetcher.ForestField[] = [
          {
            field: 'orders',
            type: 'HasMany',
            isSortable: false,
            enum: null,
            reference: 'orders',
            isReadOnly: true,
            isRequired: false,
            isPrimaryKey: false,
            relationship: 'HasMany',
          },
        ];
        mockFetchForestSchema.mockResolvedValue({
          collections: [{ name: 'users', fields: mockFields }],
        });
        mockGetFieldsOfCollection.mockReturnValue(mockFields);

        await expect(
          registeredToolHandler(
            { collectionName: 'users', relationName: 'orders', parentRecordId: 1 },
            mockExtra,
          ),
        ).rejects.toThrow('Plain error message');
      });

      it('should handle string errors thrown directly', async () => {
        // Some libraries throw string errors directly
        mockList.mockRejectedValue('Connection failed');

        const mockFields: schemaFetcher.ForestField[] = [
          {
            field: 'orders',
            type: 'HasMany',
            isSortable: false,
            enum: null,
            reference: 'orders',
            isReadOnly: true,
            isRequired: false,
            isPrimaryKey: false,
            relationship: 'HasMany',
          },
        ];
        mockFetchForestSchema.mockResolvedValue({
          collections: [{ name: 'users', fields: mockFields }],
        });
        mockGetFieldsOfCollection.mockReturnValue(mockFields);

        await expect(
          registeredToolHandler(
            { collectionName: 'users', relationName: 'orders', parentRecordId: 1 },
            mockExtra,
          ),
        ).rejects.toThrow('Connection failed');
      });
    });
  });
});
