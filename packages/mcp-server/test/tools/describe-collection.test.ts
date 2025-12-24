import type { Logger } from '../../src/server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import declareDescribeCollectionTool from '../../src/tools/describe-collection.js';
import createActivityLog, {
  markActivityLogAsFailed,
  markActivityLogAsSucceeded,
} from '../../src/utils/activity-logs-creator.js';
import buildClient from '../../src/utils/agent-caller.js';
import * as schemaFetcher from '../../src/utils/schema-fetcher.js';

jest.mock('../../src/utils/agent-caller');
jest.mock('../../src/utils/schema-fetcher');
jest.mock('../../src/utils/activity-logs-creator');

const mockLogger: Logger = jest.fn();

const mockBuildClient = buildClient as jest.MockedFunction<typeof buildClient>;
const mockCreateActivityLog = createActivityLog as jest.MockedFunction<typeof createActivityLog>;
const mockMarkActivityLogAsSucceeded = markActivityLogAsSucceeded as jest.MockedFunction<
  typeof markActivityLogAsSucceeded
>;
const mockMarkActivityLogAsFailed = markActivityLogAsFailed as jest.MockedFunction<
  typeof markActivityLogAsFailed
>;
const mockFetchForestSchema = schemaFetcher.fetchForestSchema as jest.MockedFunction<
  typeof schemaFetcher.fetchForestSchema
>;
const mockGetFieldsOfCollection = schemaFetcher.getFieldsOfCollection as jest.MockedFunction<
  typeof schemaFetcher.getFieldsOfCollection
>;
const mockGetActionsOfCollection = schemaFetcher.getActionsOfCollection as jest.MockedFunction<
  typeof schemaFetcher.getActionsOfCollection
>;

describe('declareDescribeCollectionTool', () => {
  let mcpServer: McpServer;
  let registeredToolHandler: (options: unknown, extra: unknown) => Promise<unknown>;
  let registeredToolConfig: { title: string; description: string; inputSchema: unknown };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock for actions - return empty array
    mockGetActionsOfCollection.mockReturnValue([]);

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
        "Discover a collection's schema: fields, types, operators, relations, and available actions. Always call this first before querying or modifying data. Check `_meta` for data availability context.",
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

    it('should create activity log with index action', async () => {
      const mockCapabilities = jest.fn().mockResolvedValue({ fields: [] });
      const mockCollection = jest.fn().mockReturnValue({ capabilities: mockCapabilities });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      mockFetchForestSchema.mockResolvedValue({ collections: [] });
      mockGetFieldsOfCollection.mockReturnValue([]);

      await registeredToolHandler({ collectionName: 'users' }, mockExtra);

      expect(mockCreateActivityLog).toHaveBeenCalledWith(
        'https://api.forestadmin.com',
        mockExtra,
        'describeCollection',
        { collectionName: 'users' },
      );
    });

    it('should mark activity log as succeeded after successful describe', async () => {
      const mockActivityLog = { id: 'log-123', attributes: { index: 'idx-456' } };
      mockCreateActivityLog.mockResolvedValue(mockActivityLog);

      const mockCapabilities = jest.fn().mockResolvedValue({ fields: [] });
      const mockCollection = jest.fn().mockReturnValue({ capabilities: mockCapabilities });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      mockFetchForestSchema.mockResolvedValue({ collections: [] });
      mockGetFieldsOfCollection.mockReturnValue([]);

      await registeredToolHandler({ collectionName: 'users' }, mockExtra);

      expect(mockMarkActivityLogAsSucceeded).toHaveBeenCalledWith({
        forestServerUrl: 'https://api.forestadmin.com',
        request: mockExtra,
        activityLog: mockActivityLog,
        logger: mockLogger,
      });
    });

    it('should mark activity log as failed when describe throws an error', async () => {
      const mockActivityLog = { id: 'log-123', attributes: { index: 'idx-456' } };
      mockCreateActivityLog.mockResolvedValue(mockActivityLog);

      const mockCapabilities = jest.fn().mockResolvedValue({ fields: [] });
      const mockCollection = jest.fn().mockReturnValue({ capabilities: mockCapabilities });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      mockFetchForestSchema.mockRejectedValue(new Error('Schema fetch failed'));
      mockGetFieldsOfCollection.mockReturnValue([]);

      await expect(registeredToolHandler({ collectionName: 'users' }, mockExtra)).rejects.toThrow(
        'Schema fetch failed',
      );

      expect(mockMarkActivityLogAsFailed).toHaveBeenCalledWith({
        forestServerUrl: 'https://api.forestadmin.com',
        request: mockExtra,
        activityLog: mockActivityLog,
        errorMessage: 'Schema fetch failed',
        logger: mockLogger,
      });
    });

    it('should mark activity log as failed when capabilities throws a non-404 error', async () => {
      const mockActivityLog = { id: 'log-123', attributes: { index: 'idx-456' } };
      mockCreateActivityLog.mockResolvedValue(mockActivityLog);

      const mockCapabilities = jest.fn().mockRejectedValue(new Error('Server error'));
      const mockCollection = jest.fn().mockReturnValue({ capabilities: mockCapabilities });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      mockFetchForestSchema.mockResolvedValue({ collections: [] });
      mockGetFieldsOfCollection.mockReturnValue([]);

      await expect(registeredToolHandler({ collectionName: 'users' }, mockExtra)).rejects.toThrow(
        'Server error',
      );

      expect(mockMarkActivityLogAsFailed).toHaveBeenCalledWith({
        forestServerUrl: 'https://api.forestadmin.com',
        request: mockExtra,
        activityLog: mockActivityLog,
        errorMessage: 'Server error',
        logger: mockLogger,
      });
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

        const result = (await registeredToolHandler({ collectionName: 'users' }, mockExtra)) as {
          content: { type: string; text: string }[];
        };

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
        const mockCapabilities = jest.fn().mockRejectedValue(new Error('404 Not Found'));
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

        const result = (await registeredToolHandler({ collectionName: 'users' }, mockExtra)) as {
          content: { type: string; text: string }[];
        };

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.fields).toEqual([
          {
            name: 'id',
            type: 'Number',
            operators: null,
            isPrimaryKey: true,
            isReadOnly: false,
            isRequired: true,
            isSortable: true,
          },
          {
            name: 'email',
            type: 'String',
            operators: null,
            isPrimaryKey: false,
            isReadOnly: false,
            isRequired: false,
            isSortable: false,
          },
        ]);
      });

      it('should log at Debug level when capabilities return 404', async () => {
        const mockCapabilities = jest.fn().mockRejectedValue(new Error('404 Not Found'));
        const mockCollection = jest.fn().mockReturnValue({ capabilities: mockCapabilities });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        mockFetchForestSchema.mockResolvedValue({ collections: [] });
        mockGetFieldsOfCollection.mockReturnValue([]);

        await registeredToolHandler({ collectionName: 'users' }, mockExtra);

        expect(mockLogger).toHaveBeenCalledWith(
          'Debug',
          expect.stringContaining('Capabilities route not available for collection users'),
        );
      });

      it('should throw and log Error for non-404 capabilities errors', async () => {
        const mockCapabilities = jest.fn().mockRejectedValue(new Error('Server error'));
        const mockCollection = jest.fn().mockReturnValue({ capabilities: mockCapabilities });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        mockFetchForestSchema.mockResolvedValue({ collections: [] });
        mockGetFieldsOfCollection.mockReturnValue([]);

        await expect(registeredToolHandler({ collectionName: 'users' }, mockExtra)).rejects.toThrow(
          'Server error',
        );

        expect(mockLogger).toHaveBeenCalledWith(
          'Error',
          expect.stringContaining('Failed to fetch capabilities for collection users'),
        );
      });

      it('should exclude relation fields from schema fallback', async () => {
        const mockCapabilities = jest.fn().mockRejectedValue(new Error('404 Not Found'));
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
        mockFetchForestSchema.mockResolvedValue({
          collections: [{ name: 'users', fields: mockFields }],
        });
        mockGetFieldsOfCollection.mockReturnValue(mockFields);

        const result = (await registeredToolHandler({ collectionName: 'users' }, mockExtra)) as {
          content: { type: string; text: string }[];
        };

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
        mockFetchForestSchema.mockResolvedValue({
          collections: [{ name: 'users', fields: mockFields }],
        });
        mockGetFieldsOfCollection.mockReturnValue(mockFields);

        const result = (await registeredToolHandler({ collectionName: 'users' }, mockExtra)) as {
          content: { type: string; text: string }[];
        };

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
        mockFetchForestSchema.mockResolvedValue({
          collections: [{ name: 'posts', fields: mockFields }],
        });
        mockGetFieldsOfCollection.mockReturnValue(mockFields);

        const result = (await registeredToolHandler({ collectionName: 'posts' }, mockExtra)) as {
          content: { type: string; text: string }[];
        };

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
        mockFetchForestSchema.mockResolvedValue({
          collections: [{ name: 'orders', fields: mockFields }],
        });
        mockGetFieldsOfCollection.mockReturnValue(mockFields);

        const result = (await registeredToolHandler({ collectionName: 'orders' }, mockExtra)) as {
          content: { type: string; text: string }[];
        };

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
        mockFetchForestSchema.mockResolvedValue({
          collections: [{ name: 'users', fields: mockFields }],
        });
        mockGetFieldsOfCollection.mockReturnValue(mockFields);

        const result = (await registeredToolHandler({ collectionName: 'users' }, mockExtra)) as {
          content: { type: string; text: string }[];
        };

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
        mockFetchForestSchema.mockResolvedValue({
          collections: [{ name: 'test', fields: mockFields }],
        });
        mockGetFieldsOfCollection.mockReturnValue(mockFields);

        const result = (await registeredToolHandler({ collectionName: 'test' }, mockExtra)) as {
          content: { type: string; text: string }[];
        };

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
        mockFetchForestSchema.mockResolvedValue({
          collections: [{ name: 'test', fields: mockFields }],
        });
        mockGetFieldsOfCollection.mockReturnValue(mockFields);

        const result = (await registeredToolHandler({ collectionName: 'test' }, mockExtra)) as {
          content: { type: string; text: string }[];
        };

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.relations).toContainEqual({
          name: 'orphan',
          type: 'one-to-many',
          targetCollection: null,
        });
      });
    });

    describe('actions extraction', () => {
      beforeEach(() => {
        const mockCapabilities = jest.fn().mockResolvedValue({ fields: [] });
        const mockCollection = jest.fn().mockReturnValue({ capabilities: mockCapabilities });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        mockFetchForestSchema.mockResolvedValue({ collections: [] });
        mockGetFieldsOfCollection.mockReturnValue([]);
      });

      it('should return actions with correct structure', async () => {
        mockGetActionsOfCollection.mockReturnValue([
          {
            id: 'send-email',
            name: 'Send Email',
            type: 'single',
            endpoint: '/forest/actions/send-email',
            description: 'Send an email to the user',
            fields: [{ field: 'subject' }],
            hooks: { load: false, change: [] },
            download: false,
          },
        ]);

        const result = (await registeredToolHandler({ collectionName: 'users' }, mockExtra)) as {
          content: { type: string; text: string }[];
        };

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.actions).toEqual([
          {
            name: 'Send Email',
            type: 'single',
            description: 'Send an email to the user',
            hasForm: true,
            download: false,
          },
        ]);
      });

      it('should set hasForm true when action has fields', async () => {
        mockGetActionsOfCollection.mockReturnValue([
          {
            id: 'action-with-fields',
            name: 'Action With Fields',
            type: 'bulk',
            endpoint: '/forest/actions/action-with-fields',
            fields: [{ field: 'reason' }],
            hooks: { load: false, change: [] },
            download: false,
          },
        ]);

        const result = (await registeredToolHandler({ collectionName: 'users' }, mockExtra)) as {
          content: { type: string; text: string }[];
        };

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.actions[0].hasForm).toBe(true);
      });

      it('should set hasForm true when action has load hook', async () => {
        mockGetActionsOfCollection.mockReturnValue([
          {
            id: 'action-with-hook',
            name: 'Action With Hook',
            type: 'single',
            endpoint: '/forest/actions/action-with-hook',
            fields: [],
            hooks: { load: true, change: [] },
            download: false,
          },
        ]);

        const result = (await registeredToolHandler({ collectionName: 'users' }, mockExtra)) as {
          content: { type: string; text: string }[];
        };

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.actions[0].hasForm).toBe(true);
      });

      it('should set hasForm false when action has no fields and no load hook', async () => {
        mockGetActionsOfCollection.mockReturnValue([
          {
            id: 'simple-action',
            name: 'Simple Action',
            type: 'global',
            endpoint: '/forest/actions/simple-action',
            fields: [],
            hooks: { load: false, change: [] },
            download: false,
          },
        ]);

        const result = (await registeredToolHandler({ collectionName: 'users' }, mockExtra)) as {
          content: { type: string; text: string }[];
        };

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.actions[0].hasForm).toBe(false);
      });

      it('should handle null description', async () => {
        mockGetActionsOfCollection.mockReturnValue([
          {
            id: 'no-description',
            name: 'No Description Action',
            type: 'single',
            endpoint: '/forest/actions/no-description',
            fields: [],
            hooks: { load: false, change: [] },
            download: false,
          },
        ]);

        const result = (await registeredToolHandler({ collectionName: 'users' }, mockExtra)) as {
          content: { type: string; text: string }[];
        };

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.actions[0].description).toBeNull();
      });

      it('should include download property', async () => {
        mockGetActionsOfCollection.mockReturnValue([
          {
            id: 'export-action',
            name: 'Export Action',
            type: 'bulk',
            endpoint: '/forest/actions/export-action',
            fields: [],
            hooks: { load: false, change: [] },
            download: true,
          },
        ]);

        const result = (await registeredToolHandler({ collectionName: 'users' }, mockExtra)) as {
          content: { type: string; text: string }[];
        };

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.actions[0].download).toBe(true);
      });

      it('should return empty actions array when collection has no actions', async () => {
        mockGetActionsOfCollection.mockReturnValue([]);

        const result = (await registeredToolHandler({ collectionName: 'users' }, mockExtra)) as {
          content: { type: string; text: string }[];
        };

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.actions).toEqual([]);
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

        const result = (await registeredToolHandler({ collectionName: 'users' }, mockExtra)) as {
          content: { type: string; text: string }[];
        };

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
        mockFetchForestSchema.mockResolvedValue({
          collections: [{ name: 'users', fields: mockFields }],
        });
        mockGetFieldsOfCollection.mockReturnValue(mockFields);

        const result = (await registeredToolHandler({ collectionName: 'users' }, mockExtra)) as {
          content: { type: string; text: string }[];
        };

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed).toHaveProperty('collection', 'users');
        expect(parsed).toHaveProperty('fields');
        expect(parsed).toHaveProperty('relations');
        expect(parsed).toHaveProperty('actions');
        expect(parsed).toHaveProperty('_meta');
        expect(parsed.fields).toBeInstanceOf(Array);
        expect(parsed.relations).toBeInstanceOf(Array);
        expect(parsed.actions).toBeInstanceOf(Array);
      });

      it('should set _meta.capabilitiesAvailable to true without note when capabilities succeed', async () => {
        const mockCapabilities = jest.fn().mockResolvedValue({ fields: [] });
        const mockCollection = jest.fn().mockReturnValue({ capabilities: mockCapabilities });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        mockFetchForestSchema.mockResolvedValue({ collections: [] });
        mockGetFieldsOfCollection.mockReturnValue([]);

        const result = (await registeredToolHandler({ collectionName: 'users' }, mockExtra)) as {
          content: { type: string; text: string }[];
        };

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed._meta.capabilitiesAvailable).toBe(true);
        expect(parsed._meta.note).toBeUndefined();
      });

      it('should set _meta.capabilitiesAvailable to false with note when capabilities fail with 404', async () => {
        const mockCapabilities = jest.fn().mockRejectedValue(new Error('404 Not Found'));
        const mockCollection = jest.fn().mockReturnValue({ capabilities: mockCapabilities });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        mockFetchForestSchema.mockResolvedValue({ collections: [] });
        mockGetFieldsOfCollection.mockReturnValue([]);

        const result = (await registeredToolHandler({ collectionName: 'users' }, mockExtra)) as {
          content: { type: string; text: string }[];
        };

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed._meta.capabilitiesAvailable).toBe(false);
        expect(parsed._meta.note).toBe(
          'Operators unavailable (older agent version). Fields have operators: null.',
        );
      });
    });
  });
});
