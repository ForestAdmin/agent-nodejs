import type { Logger } from '../../src/server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import declareDescribeCollectionTool from '../../src/tools/describe-collection';
import buildClient from '../../src/utils/agent-caller';
import * as schemaFetcher from '../../src/utils/schema-fetcher';

jest.mock('../../src/utils/agent-caller');
jest.mock('../../src/utils/schema-fetcher');

const mockLogger: Logger = jest.fn();

const mockBuildClient = buildClient as jest.MockedFunction<typeof buildClient>;
const mockFetchForestSchema = schemaFetcher.fetchForestSchema as jest.MockedFunction<
  typeof schemaFetcher.fetchForestSchema
>;
const mockGetFieldsOfCollection = schemaFetcher.getFieldsOfCollection as jest.MockedFunction<
  typeof schemaFetcher.getFieldsOfCollection
>;

describe('declareDescribeCollectionTool', () => {
  let mcpServer: McpServer;
  let registeredToolHandler: (options: unknown, extra: unknown) => Promise<unknown>;
  let registeredToolConfig: { title: string; description: string; inputSchema: unknown };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a mock MCP server that captures the registered tool
    mcpServer = {
      registerTool: jest.fn((name, config, handler) => {
        registeredToolConfig = config;
        registeredToolHandler = handler;
      }),
    } as unknown as McpServer;
  });

  describe('tool registration', () => {
    it('should register a tool named "describeCollection"', () => {
      declareDescribeCollectionTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      expect(mcpServer.registerTool).toHaveBeenCalledWith(
        'describeCollection',
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should register tool with correct title and description', () => {
      declareDescribeCollectionTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      expect(registeredToolConfig.title).toBe('Describe a collection');
      expect(registeredToolConfig.description).toBe(
        'Get detailed information about a collection including its fields, data types, available filter operators, and relations to other collections. Use this tool first before querying data to understand the collection structure and build accurate filters.',
      );
    });

    it('should define correct input schema', () => {
      declareDescribeCollectionTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      expect(registeredToolConfig.inputSchema).toHaveProperty('collectionName');
    });

    it('should use string type for collectionName when no collection names provided', () => {
      declareDescribeCollectionTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      const schema = registeredToolConfig.inputSchema as Record<
        string,
        { options?: string[]; parse: (value: unknown) => unknown }
      >;
      // String type should not have options property (enum has options)
      expect(schema.collectionName.options).toBeUndefined();
      // Should accept any string
      expect(() => schema.collectionName.parse('any-collection')).not.toThrow();
    });

    it('should use enum type for collectionName when collection names provided', () => {
      declareDescribeCollectionTool(mcpServer, 'https://api.forestadmin.com', mockLogger, [
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
      declareDescribeCollectionTool(mcpServer, 'https://api.forestadmin.com', mockLogger);
    });

    it('should call buildClient with the extra parameter', async () => {
      const mockCapabilities = jest.fn().mockResolvedValue({ fields: [] });
      const mockCollection = jest.fn().mockReturnValue({ capabilities: mockCapabilities });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      mockFetchForestSchema.mockResolvedValue({ collections: [] });
      mockGetFieldsOfCollection.mockReturnValue([]);

      await registeredToolHandler({ collectionName: 'users' }, mockExtra);

      expect(mockBuildClient).toHaveBeenCalledWith(mockExtra);
    });

    it('should fetch forest schema', async () => {
      const mockCapabilities = jest.fn().mockResolvedValue({ fields: [] });
      const mockCollection = jest.fn().mockReturnValue({ capabilities: mockCapabilities });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      mockFetchForestSchema.mockResolvedValue({ collections: [] });
      mockGetFieldsOfCollection.mockReturnValue([]);

      await registeredToolHandler({ collectionName: 'users' }, mockExtra);

      expect(mockFetchForestSchema).toHaveBeenCalledWith('https://api.forestadmin.com');
    });

    it('should call capabilities on the collection', async () => {
      const mockCapabilities = jest.fn().mockResolvedValue({ fields: [] });
      const mockCollection = jest.fn().mockReturnValue({ capabilities: mockCapabilities });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      mockFetchForestSchema.mockResolvedValue({ collections: [] });
      mockGetFieldsOfCollection.mockReturnValue([]);

      await registeredToolHandler({ collectionName: 'users' }, mockExtra);

      expect(mockCollection).toHaveBeenCalledWith('users');
      expect(mockCapabilities).toHaveBeenCalled();
    });

    describe('when capabilities are available', () => {
      it('should return fields from capabilities with schema metadata', async () => {
        const mockCapabilities = jest.fn().mockResolvedValue({
          fields: [
            { name: 'id', type: 'Number', operators: ['Equal', 'NotEqual'] },
            { name: 'name', type: 'String', operators: ['Equal', 'Contains'] },
          ],
        });
        const mockCollection = jest.fn().mockReturnValue({ capabilities: mockCapabilities });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        const mockSchema: schemaFetcher.ForestSchema = {
          collections: [
            {
              name: 'users',
              fields: [
                {
                  field: 'id',
                  type: 'Number',
                  isSortable: true,
                  isPrimaryKey: true,
                  isReadOnly: false,
                  isRequired: true,
                  enum: null,
                  reference: null,
                },
                {
                  field: 'name',
                  type: 'String',
                  isSortable: true,
                  isPrimaryKey: false,
                  isReadOnly: false,
                  isRequired: false,
                  enum: null,
                  reference: null,
                },
              ],
            },
          ],
        };
        mockFetchForestSchema.mockResolvedValue(mockSchema);
        mockGetFieldsOfCollection.mockReturnValue(mockSchema.collections[0].fields);

        const result = (await registeredToolHandler(
          { collectionName: 'users' },
          mockExtra,
        )) as { content: { type: string; text: string }[] };

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.collection).toBe('users');
        expect(parsed.fields).toEqual([
          {
            name: 'id',
            type: 'Number',
            operators: ['Equal', 'NotEqual'],
            isPrimaryKey: true,
            isReadOnly: false,
            isRequired: true,
            isSortable: true,
          },
          {
            name: 'name',
            type: 'String',
            operators: ['Equal', 'Contains'],
            isPrimaryKey: false,
            isReadOnly: false,
            isRequired: false,
            isSortable: true,
          },
        ]);
      });
    });

    describe('when capabilities are not available (older agent)', () => {
      it('should fall back to schema fields with empty operators', async () => {
        const mockCapabilities = jest.fn().mockRejectedValue(new Error('Not found'));
        const mockCollection = jest.fn().mockReturnValue({ capabilities: mockCapabilities });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        const mockSchema: schemaFetcher.ForestSchema = {
          collections: [
            {
              name: 'users',
              fields: [
                {
                  field: 'id',
                  type: 'Number',
                  isSortable: true,
                  isPrimaryKey: true,
                  isReadOnly: false,
                  isRequired: true,
                  enum: null,
                  reference: null,
                },
                {
                  field: 'email',
                  type: 'String',
                  isSortable: false,
                  isPrimaryKey: false,
                  isReadOnly: false,
                  isRequired: false,
                  enum: null,
                  reference: null,
                },
              ],
            },
          ],
        };
        mockFetchForestSchema.mockResolvedValue(mockSchema);
        mockGetFieldsOfCollection.mockReturnValue(mockSchema.collections[0].fields);

        const result = (await registeredToolHandler(
          { collectionName: 'users' },
          mockExtra,
        )) as { content: { type: string; text: string }[] };

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.fields).toEqual([
          {
            name: 'id',
            type: 'Number',
            operators: [],
            isPrimaryKey: true,
            isReadOnly: false,
            isRequired: true,
            isSortable: true,
          },
          {
            name: 'email',
            type: 'String',
            operators: [],
            isPrimaryKey: false,
            isReadOnly: false,
            isRequired: false,
            isSortable: false,
          },
        ]);
      });

      it('should log a warning when capabilities fail', async () => {
        const mockCapabilities = jest.fn().mockRejectedValue(new Error('Not found'));
        const mockCollection = jest.fn().mockReturnValue({ capabilities: mockCapabilities });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        mockFetchForestSchema.mockResolvedValue({ collections: [] });
        mockGetFieldsOfCollection.mockReturnValue([]);

        await registeredToolHandler({ collectionName: 'users' }, mockExtra);

        expect(mockLogger).toHaveBeenCalledWith(
          'Warn',
          expect.stringContaining('Failed to fetch capabilities for collection users'),
        );
      });

      it('should exclude relation fields from schema fallback', async () => {
        const mockCapabilities = jest.fn().mockRejectedValue(new Error('Not found'));
        const mockCollection = jest.fn().mockReturnValue({ capabilities: mockCapabilities });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        const mockFields: schemaFetcher.ForestField[] = [
          {
            field: 'id',
            type: 'Number',
            isSortable: true,
            isPrimaryKey: true,
            isReadOnly: false,
            isRequired: true,
            enum: null,
            reference: null,
          },
          {
            field: 'orders',
            type: '[Number]',
            isSortable: false,
            isPrimaryKey: false,
            isReadOnly: false,
            isRequired: false,
            enum: null,
            reference: 'orders.id',
            relationship: 'HasMany',
          },
        ];
        mockFetchForestSchema.mockResolvedValue({ collections: [{ name: 'users', fields: mockFields }] });
        mockGetFieldsOfCollection.mockReturnValue(mockFields);

        const result = (await registeredToolHandler(
          { collectionName: 'users' },
          mockExtra,
        )) as { content: { type: string; text: string }[] };

        const parsed = JSON.parse(result.content[0].text);
        // Should only include non-relation fields
        expect(parsed.fields).toHaveLength(1);
        expect(parsed.fields[0].name).toBe('id');
      });
    });

    describe('relations extraction', () => {
      beforeEach(() => {
        const mockCapabilities = jest.fn().mockResolvedValue({ fields: [] });
        const mockCollection = jest.fn().mockReturnValue({ capabilities: mockCapabilities });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);
      });

      it('should extract HasMany relations as one-to-many', async () => {
        const mockFields: schemaFetcher.ForestField[] = [
          {
            field: 'orders',
            type: '[Number]',
            isSortable: false,
            isPrimaryKey: false,
            isReadOnly: false,
            isRequired: false,
            enum: null,
            reference: 'orders.id',
            relationship: 'HasMany',
          },
        ];
        mockFetchForestSchema.mockResolvedValue({ collections: [{ name: 'users', fields: mockFields }] });
        mockGetFieldsOfCollection.mockReturnValue(mockFields);

        const result = (await registeredToolHandler(
          { collectionName: 'users' },
          mockExtra,
        )) as { content: { type: string; text: string }[] };

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.relations).toContainEqual({
          name: 'orders',
          type: 'one-to-many',
          targetCollection: 'orders',
        });
      });

      it('should extract BelongsToMany relations as many-to-many', async () => {
        const mockFields: schemaFetcher.ForestField[] = [
          {
            field: 'tags',
            type: '[Number]',
            isSortable: false,
            isPrimaryKey: false,
            isReadOnly: false,
            isRequired: false,
            enum: null,
            reference: 'tags.id',
            relationship: 'BelongsToMany',
          },
        ];
        mockFetchForestSchema.mockResolvedValue({ collections: [{ name: 'posts', fields: mockFields }] });
        mockGetFieldsOfCollection.mockReturnValue(mockFields);

        const result = (await registeredToolHandler(
          { collectionName: 'posts' },
          mockExtra,
        )) as { content: { type: string; text: string }[] };

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.relations).toContainEqual({
          name: 'tags',
          type: 'many-to-many',
          targetCollection: 'tags',
        });
      });

      it('should extract BelongsTo relations as many-to-one', async () => {
        const mockFields: schemaFetcher.ForestField[] = [
          {
            field: 'user',
            type: 'Number',
            isSortable: false,
            isPrimaryKey: false,
            isReadOnly: false,
            isRequired: false,
            enum: null,
            reference: 'users.id',
            relationship: 'BelongsTo',
          },
        ];
        mockFetchForestSchema.mockResolvedValue({ collections: [{ name: 'orders', fields: mockFields }] });
        mockGetFieldsOfCollection.mockReturnValue(mockFields);

        const result = (await registeredToolHandler(
          { collectionName: 'orders' },
          mockExtra,
        )) as { content: { type: string; text: string }[] };

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.relations).toContainEqual({
          name: 'user',
          type: 'many-to-one',
          targetCollection: 'users',
        });
      });

      it('should extract HasOne relations as one-to-one', async () => {
        const mockFields: schemaFetcher.ForestField[] = [
          {
            field: 'profile',
            type: 'Number',
            isSortable: false,
            isPrimaryKey: false,
            isReadOnly: false,
            isRequired: false,
            enum: null,
            reference: 'profiles.id',
            relationship: 'HasOne',
          },
        ];
        mockFetchForestSchema.mockResolvedValue({ collections: [{ name: 'users', fields: mockFields }] });
        mockGetFieldsOfCollection.mockReturnValue(mockFields);

        const result = (await registeredToolHandler(
          { collectionName: 'users' },
          mockExtra,
        )) as { content: { type: string; text: string }[] };

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.relations).toContainEqual({
          name: 'profile',
          type: 'one-to-one',
          targetCollection: 'profiles',
        });
      });

      it('should handle unknown relationship types', async () => {
        const mockFields: schemaFetcher.ForestField[] = [
          {
            field: 'custom',
            type: 'Number',
            isSortable: false,
            isPrimaryKey: false,
            isReadOnly: false,
            isRequired: false,
            enum: null,
            reference: 'custom.id',
            relationship: 'CustomRelation' as schemaFetcher.ForestField['relationship'],
          },
        ];
        mockFetchForestSchema.mockResolvedValue({ collections: [{ name: 'test', fields: mockFields }] });
        mockGetFieldsOfCollection.mockReturnValue(mockFields);

        const result = (await registeredToolHandler(
          { collectionName: 'test' },
          mockExtra,
        )) as { content: { type: string; text: string }[] };

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.relations).toContainEqual({
          name: 'custom',
          type: 'CustomRelation',
          targetCollection: 'custom',
        });
      });

      it('should handle missing reference gracefully', async () => {
        const mockFields: schemaFetcher.ForestField[] = [
          {
            field: 'orphan',
            type: 'Number',
            isSortable: false,
            isPrimaryKey: false,
            isReadOnly: false,
            isRequired: false,
            enum: null,
            reference: null,
            relationship: 'HasMany',
          },
        ];
        mockFetchForestSchema.mockResolvedValue({ collections: [{ name: 'test', fields: mockFields }] });
        mockGetFieldsOfCollection.mockReturnValue(mockFields);

        const result = (await registeredToolHandler(
          { collectionName: 'test' },
          mockExtra,
        )) as { content: { type: string; text: string }[] };

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.relations).toContainEqual({
          name: 'orphan',
          type: 'one-to-many',
          targetCollection: null,
        });
      });
    });

    describe('response format', () => {
      it('should return JSON formatted with indentation', async () => {
        const mockCapabilities = jest.fn().mockResolvedValue({ fields: [] });
        const mockCollection = jest.fn().mockReturnValue({ capabilities: mockCapabilities });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        mockFetchForestSchema.mockResolvedValue({ collections: [] });
        mockGetFieldsOfCollection.mockReturnValue([]);

        const result = (await registeredToolHandler(
          { collectionName: 'users' },
          mockExtra,
        )) as { content: { type: string; text: string }[] };

        // Check that JSON is formatted (has newlines)
        expect(result.content[0].text).toContain('\n');
        expect(result.content[0].type).toBe('text');
      });

      it('should return complete structure with collection, fields, and relations', async () => {
        const mockCapabilities = jest.fn().mockResolvedValue({
          fields: [{ name: 'id', type: 'Number', operators: ['Equal'] }],
        });
        const mockCollection = jest.fn().mockReturnValue({ capabilities: mockCapabilities });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        const mockFields: schemaFetcher.ForestField[] = [
          {
            field: 'id',
            type: 'Number',
            isSortable: true,
            isPrimaryKey: true,
            isReadOnly: false,
            isRequired: true,
            enum: null,
            reference: null,
          },
          {
            field: 'posts',
            type: '[Number]',
            isSortable: false,
            isPrimaryKey: false,
            isReadOnly: false,
            isRequired: false,
            enum: null,
            reference: 'posts.id',
            relationship: 'HasMany',
          },
        ];
        mockFetchForestSchema.mockResolvedValue({ collections: [{ name: 'users', fields: mockFields }] });
        mockGetFieldsOfCollection.mockReturnValue(mockFields);

        const result = (await registeredToolHandler(
          { collectionName: 'users' },
          mockExtra,
        )) as { content: { type: string; text: string }[] };

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed).toHaveProperty('collection', 'users');
        expect(parsed).toHaveProperty('fields');
        expect(parsed).toHaveProperty('relations');
        expect(parsed.fields).toBeInstanceOf(Array);
        expect(parsed.relations).toBeInstanceOf(Array);
      });
    });
  });
});
