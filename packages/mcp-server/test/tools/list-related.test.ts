import type { ForestServerClient } from '../../src/http-client';
import type { Logger } from '../../src/server';
import type { RegisteredToolConfig } from '../helpers/registered-tool-config';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import declareListRelatedTool from '../../src/tools/list-related';
import buildClient from '../../src/utils/agent-caller';
import * as schemaFetcher from '../../src/utils/schema-fetcher';
import createMockForestServerClient from '../helpers/forest-server-client';

jest.mock('../../src/utils/agent-caller');
jest.mock('../../src/utils/schema-fetcher');

const mockBuildClient = buildClient as jest.MockedFunction<typeof buildClient>;
const mockFetchForestSchema = schemaFetcher.fetchForestSchema as jest.MockedFunction<
  typeof schemaFetcher.fetchForestSchema
>;
const mockGetFieldsOfCollection = schemaFetcher.getFieldsOfCollection as jest.MockedFunction<
  typeof schemaFetcher.getFieldsOfCollection
>;

describe('declareListRelatedTool', () => {
  let mcpServer: McpServer;
  let mockLogger: Logger;
  let mockForestServerClient: jest.Mocked<ForestServerClient>;
  let registeredToolHandler: (options: unknown, extra: unknown) => Promise<unknown>;
  let registeredToolConfig: RegisteredToolConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchForestSchema.mockResolvedValue({ collections: [] });
    mockGetFieldsOfCollection.mockReturnValue([]);

    mockForestServerClient = createMockForestServerClient();

    // Create a mock logger
    mockLogger = jest.fn();

    // Create a mock MCP server that captures the registered tool
    mcpServer = {
      registerTool: jest.fn((name, config, handler) => {
        registeredToolConfig = config;
        registeredToolHandler = handler;
      }),
    } as unknown as McpServer;
  });

  describe('tool registration', () => {
    it('should register a tool named "listRelated"', () => {
      declareListRelatedTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: [],
      });

      expect(mcpServer.registerTool).toHaveBeenCalledWith(
        'listRelated',
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should register tool with correct title and description', () => {
      declareListRelatedTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: [],
      });

      expect(registeredToolConfig.title).toBe('List records from a relation');
      expect(registeredToolConfig.description).toBe(
        'Retrieve a list of records from a one-to-many or many-to-many relation. Send schema field names; read each value under its `recordKey` when describeCollection publishes one. Never read a field whose `recordKey` is null; project a field listing `sharesRecordKeyWith` without the fields it lists.',
      );
    });

    it('should be annotated as read-only', () => {
      declareListRelatedTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: [],
      });

      expect(registeredToolConfig.annotations).toEqual({ readOnlyHint: true });
    });

    it('should define correct input schema', () => {
      declareListRelatedTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: [],
      });

      expect(registeredToolConfig.inputSchema).toHaveProperty('collectionName');
      expect(registeredToolConfig.inputSchema).toHaveProperty('relationName');
      expect(registeredToolConfig.inputSchema).toHaveProperty('parentRecordId');
      expect(registeredToolConfig.inputSchema).toHaveProperty('search');
      expect(registeredToolConfig.inputSchema).toHaveProperty('filters');
      expect(registeredToolConfig.inputSchema).toHaveProperty('sort');
    });

    it('should use string type for collectionName when no collection names provided', () => {
      declareListRelatedTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: [],
      });

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
      declareListRelatedTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: [],
      });

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
      declareListRelatedTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: ['users', 'products', 'orders'],
      });

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
      declareListRelatedTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: [],
      });

      const schema = registeredToolConfig.inputSchema as Record<
        string,
        { parse: (value: unknown) => unknown }
      >;
      expect(() => schema.parentRecordId.parse('abc-123')).not.toThrow();
    });

    it('should accept number parentRecordId', () => {
      declareListRelatedTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: [],
      });

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
      declareListRelatedTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: [],
      });
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

      expect(mockBuildClient).toHaveBeenCalledWith(
        mockExtra,
        expect.objectContaining({ forestServerClient: mockForestServerClient, logger: mockLogger }),
      );
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

      expect(mockRelation).toHaveBeenCalledWith('orders', 42, undefined);
    });

    it('lists the relation on the collection its schema field references', async () => {
      const mockList = jest.fn().mockResolvedValue([]);
      const mockRelation = jest.fn().mockReturnValue({ list: mockList });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: jest.fn().mockReturnValue({ relation: mockRelation }) },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);
      mockGetFieldsOfCollection.mockReturnValue([
        { field: 'reports', reference: 'employees.id', relationship: 'HasMany' },
      ] as unknown as ReturnType<typeof schemaFetcher.getFieldsOfCollection>);

      await registeredToolHandler(
        { collectionName: 'employees', relationName: 'reports', parentRecordId: 42 },
        mockExtra,
      );

      expect(mockRelation).toHaveBeenCalledWith('reports', 42, 'employees');
    });

    it('lists the relation under its own name when the schema cannot be fetched', async () => {
      const mockList = jest.fn().mockResolvedValue([{ id: 1 }]);
      const mockRelation = jest.fn().mockReturnValue({ list: mockList });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: jest.fn().mockReturnValue({ relation: mockRelation }) },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);
      mockFetchForestSchema.mockRejectedValueOnce(new Error('Forest server unreachable'));

      const result = await registeredToolHandler(
        { collectionName: 'employees', relationName: 'reports', parentRecordId: 42 },
        mockExtra,
      );

      expect(mockRelation).toHaveBeenCalledWith('reports', 42, undefined);
      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify({ records: [{ id: 1 }] }) }],
      });
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

      expect(mockRelation).toHaveBeenCalledWith('orders', 'uuid-123', undefined);
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
      const mockList = jest.fn();
      const mockListAndCount = jest.fn().mockResolvedValue({ records: mockData, totalCount: 42 });
      const mockRelation = jest
        .fn()
        .mockReturnValue({ list: mockList, listAndCount: mockListAndCount });
      const mockCollection = jest.fn().mockReturnValue({ relation: mockRelation });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      const result = await registeredToolHandler(
        { collectionName: 'users', relationName: 'orders', parentRecordId: 1, enableCount: true },
        mockExtra,
      );

      expect(mockList).not.toHaveBeenCalled();
      expect(mockListAndCount).toHaveBeenCalledWith(
        { collectionName: 'users', relationName: 'orders', parentRecordId: 1, enableCount: true },
        { label: 'list relation "orders"' },
      );
      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify({ records: mockData, totalCount: 42 }) }],
      });
    });

    it('should answer a null totalCount when count is deactivated for the listed collection', async () => {
      const mockRelation = jest.fn().mockReturnValue({
        listAndCount: jest.fn().mockResolvedValue({ records: [{ id: 1 }], totalCount: null }),
      });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: jest.fn().mockReturnValue({ relation: mockRelation }) },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      const result = await registeredToolHandler(
        { collectionName: 'users', relationName: 'orders', parentRecordId: 1, enableCount: true },
        mockExtra,
      );

      expect(result).toEqual({
        content: [
          { type: 'text', text: JSON.stringify({ records: [{ id: 1 }], totalCount: null }) },
        ],
      });
    });

    describe('activity log label', () => {
      let mockList: jest.Mock;

      beforeEach(() => {
        mockList = jest.fn().mockResolvedValue([]);
        const mockRelation = jest.fn().mockReturnValue({ list: mockList });
        const mockCollection = jest.fn().mockReturnValue({ relation: mockRelation });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
        } as unknown as ReturnType<typeof buildClient>);
      });

      it.each([
        [{}, 'list relation "orders"'],
        [{ search: 'test' }, 'list relation "orders" with search'],
        [
          { filters: { field: 'status', operator: 'Equal', value: 'pending' } },
          'list relation "orders" with filter',
        ],
        [
          { search: 'test', filters: { field: 'status', operator: 'Equal', value: 'pending' } },
          'list relation "orders" with search and filter',
        ],
      ])('should name the refinements of %j in the label', async (refinements, label) => {
        await registeredToolHandler(
          { collectionName: 'users', relationName: 'orders', parentRecordId: 1, ...refinements },
          mockExtra,
        );

        expect(mockList).toHaveBeenCalledWith(expect.any(Object), { label });
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

        expect(mockList).toHaveBeenCalledWith(
          {
            collectionName: 'users',
            relationName: 'orders',
            parentRecordId: 1,
          },
          expect.anything(),
        );
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

        expect(mockList).toHaveBeenCalledWith(
          {
            collectionName: 'users',
            relationName: 'orders',
            parentRecordId: 1,
            search: 'test query',
          },
          expect.anything(),
        );
      });

      it('should pass filters to list', async () => {
        const filters = { field: 'status', operator: 'Equal', value: 'completed' };

        await registeredToolHandler(
          { collectionName: 'users', relationName: 'orders', parentRecordId: 1, filters },
          mockExtra,
        );

        expect(mockList).toHaveBeenCalledWith(
          {
            collectionName: 'users',
            relationName: 'orders',
            parentRecordId: 1,
            filters,
          },
          expect.anything(),
        );
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

        expect(mockList).toHaveBeenCalledWith(
          {
            collectionName: 'users',
            relationName: 'orders',
            parentRecordId: 1,
            sort: { field: 'createdAt', ascending: true },
          },
          expect.anything(),
        );
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

        expect(mockList).toHaveBeenCalledWith(
          {
            collectionName: 'users',
            relationName: 'orders',
            parentRecordId: 1,
            sort: { field: 'createdAt', ascending: false },
          },
          expect.anything(),
        );
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

        expect(mockList).toHaveBeenCalledWith(
          {
            collectionName: 'users',
            relationName: 'orders',
            parentRecordId: 1,
            search: 'test',
            filters,
            sort: { field: 'total', ascending: false },
          },
          expect.anything(),
        );
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

        const result = await registeredToolHandler(
          { collectionName: 'users', relationName: 'orders', parentRecordId: 1 },
          mockExtra,
        );
        expect(result).toEqual({
          content: [{ type: 'text', text: expect.stringContaining('Invalid filters provided') }],
          isError: true,
        });
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

        const result = await registeredToolHandler(
          { collectionName: 'users', relationName: 'orders', parentRecordId: 1 },
          mockExtra,
        );
        expect(result).toEqual({
          content: [{ type: 'text', text: expect.stringContaining('Direct text error') }],
          isError: true,
        });
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
            enums: null,
            reference: null,
            isReadOnly: false,
            isRequired: true,
            isPrimaryKey: true,
          },
          {
            field: 'total',
            type: 'Number',
            isSortable: true,
            enums: null,
            reference: null,
            isReadOnly: false,
            isRequired: false,
            isPrimaryKey: false,
          },
          {
            field: 'computed',
            type: 'String',
            isSortable: false,
            enums: null,
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

        const result = await registeredToolHandler(
          { collectionName: 'users', relationName: 'orders', parentRecordId: 1 },
          mockExtra,
        );
        expect(result).toEqual({
          content: [
            {
              type: 'text',
              text: expect.stringContaining(
                'The sort field provided is invalid for this collection. Available fields for the collection users are: id, total.',
              ),
            },
          ],
          isError: true,
        });

        expect(mockFetchForestSchema).toHaveBeenCalledWith(mockForestServerClient);
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
            enums: null,
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
            enums: null,
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
            enums: null,
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

        const result = await registeredToolHandler(
          { collectionName: 'users', relationName: 'invalidRelation', parentRecordId: 1 },
          mockExtra,
        );
        expect(result).toEqual({
          content: [
            {
              type: 'text',
              text: expect.stringContaining(
                'The relation name provided is invalid for this collection. Available relations for collection users are: orders, reviews.',
              ),
            },
          ],
          isError: true,
        });
      });

      it('should include BelongsToMany relations in available relations error message', async () => {
        const agentError = new Error('Relation not found');
        mockList.mockRejectedValue(agentError);

        const mockFields: schemaFetcher.ForestField[] = [
          {
            field: 'orders',
            type: 'HasMany',
            isSortable: false,
            enums: null,
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
            enums: null,
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

        const result = await registeredToolHandler(
          { collectionName: 'users', relationName: 'invalidRelation', parentRecordId: 1 },
          mockExtra,
        );
        expect(result).toEqual({
          content: [
            {
              type: 'text',
              text: expect.stringContaining(
                'The relation name provided is invalid for this collection. Available relations for collection users are: orders, tags.',
              ),
            },
          ],
          isError: true,
        });
      });

      it('should not show relation error when relation exists but error is different', async () => {
        const agentError = new Error('Some other error');
        mockList.mockRejectedValue(agentError);

        const mockFields: schemaFetcher.ForestField[] = [
          {
            field: 'orders',
            type: 'HasMany',
            isSortable: false,
            enums: null,
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

        // Should return the original error message since 'orders' relation exists
        const result = await registeredToolHandler(
          { collectionName: 'users', relationName: 'orders', parentRecordId: 1 },
          mockExtra,
        );
        expect(result).toEqual({
          content: [{ type: 'text', text: expect.stringContaining('Some other error') }],
          isError: true,
        });
      });

      it('should fall back to error.message when message is not valid JSON', async () => {
        const agentError = new Error('Plain error message');
        mockList.mockRejectedValue(agentError);

        const mockFields: schemaFetcher.ForestField[] = [
          {
            field: 'orders',
            type: 'HasMany',
            isSortable: false,
            enums: null,
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

        const result = await registeredToolHandler(
          { collectionName: 'users', relationName: 'orders', parentRecordId: 1 },
          mockExtra,
        );
        expect(result).toEqual({
          content: [{ type: 'text', text: expect.stringContaining('Plain error message') }],
          isError: true,
        });
      });

      it('should handle string errors thrown directly', async () => {
        // Some libraries throw string errors directly
        mockList.mockRejectedValue('Connection failed');

        const mockFields: schemaFetcher.ForestField[] = [
          {
            field: 'orders',
            type: 'HasMany',
            isSortable: false,
            enums: null,
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

        const result = await registeredToolHandler(
          { collectionName: 'users', relationName: 'orders', parentRecordId: 1 },
          mockExtra,
        );
        expect(result).toEqual({
          content: [{ type: 'text', text: expect.stringContaining('Connection failed') }],
          isError: true,
        });
      });
    });
  });
});
