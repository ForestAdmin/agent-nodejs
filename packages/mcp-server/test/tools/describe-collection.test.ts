import type { ForestServerClient } from '../../src/http-client';
import type { Logger } from '../../src/server';
import type { RegisteredToolConfig } from '../helpers/registered-tool-config';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import filterSchema from '../../src/schemas/filter';
import declareDescribeCollectionTool from '../../src/tools/describe-collection';
import buildClient from '../../src/utils/agent-caller';
import * as schemaFetcher from '../../src/utils/schema-fetcher';
import withActivityLog from '../../src/utils/with-activity-log';
import createMockForestServerClient from '../helpers/forest-server-client';

jest.mock('../../src/utils/agent-caller');
jest.mock('../../src/utils/schema-fetcher');
jest.mock('../../src/utils/with-activity-log');

const mockLogger: Logger = jest.fn();

const mockBuildClient = buildClient as jest.MockedFunction<typeof buildClient>;
const mockWithActivityLog = withActivityLog as jest.MockedFunction<typeof withActivityLog>;
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
  let mockForestServerClient: jest.Mocked<ForestServerClient>;
  let registeredToolHandler: (options: unknown, extra: unknown) => Promise<unknown>;
  let registeredToolConfig: RegisteredToolConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    mockForestServerClient = createMockForestServerClient();

    // Mock withActivityLog to execute the operation directly
    mockWithActivityLog.mockImplementation(async options => options.operation());

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
      declareDescribeCollectionTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: [],
      });

      expect(mcpServer.registerTool).toHaveBeenCalledWith(
        'describeCollection',
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should register tool with correct title and description', () => {
      declareDescribeCollectionTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: [],
      });

      expect(registeredToolConfig.title).toBe('Describe a collection');
      expect(registeredToolConfig.description).toContain(
        "Discover a collection's schema: fields, types, operators, relations, and available actions.",
      );
      expect(registeredToolConfig.description).toContain('Actions properties:');
      expect(registeredToolConfig.description).toContain('download:');
    });

    it('should tell the model to send schema names and read values under recordKey', () => {
      declareDescribeCollectionTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: [],
      });

      expect(registeredToolConfig.description).toContain(
        'create/update attributes) is the schema `name`. A field or relation with a `recordKey` comes back under that key in a returned record',
      );
    });

    it('should be annotated as read-only', () => {
      declareDescribeCollectionTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: [],
      });

      expect(registeredToolConfig.annotations).toEqual({ readOnlyHint: true });
    });

    it('should define correct input schema', () => {
      declareDescribeCollectionTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: [],
      });

      expect(registeredToolConfig.inputSchema).toHaveProperty('collectionName');
    });

    it('should use string type for collectionName when no collection names provided', () => {
      declareDescribeCollectionTool(mcpServer, {
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

    it('should use enum type for collectionName when collection names provided', () => {
      declareDescribeCollectionTool(mcpServer, {
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
      declareDescribeCollectionTool(mcpServer, {
        forestServerClient: mockForestServerClient,
        logger: mockLogger,
        collectionNames: [],
      });
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

      expect(mockBuildClient).toHaveBeenCalledWith(mockExtra, undefined);
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

      expect(mockFetchForestSchema).toHaveBeenCalledWith(mockForestServerClient);
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
            { name: 'id', type: 'Number', operators: ['equal', 'not_equal'] },
            { name: 'name', type: 'String', operators: ['equal', 'contains'] },
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
                  enums: null,
                  reference: null,
                },
                {
                  field: 'name',
                  type: 'String',
                  isSortable: true,
                  isPrimaryKey: false,
                  isReadOnly: false,
                  isRequired: false,
                  enums: null,
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

    describe('operator vocabulary', () => {
      const SERVED_BY_AGENTS = [
        'equal',
        'not_equal',
        'less_than',
        'greater_than',
        'less_than_or_equal',
        'greater_than_or_equal',
        'match',
        'like',
        'i_like',
        'not_contains',
        'contains',
        'i_contains',
        'not_i_contains',
        'longer_than',
        'shorter_than',
        'includes_all',
        'present',
        'blank',
        'in',
        'not_in',
        'starts_with',
        'i_starts_with',
        'ends_with',
        'i_ends_with',
        'missing',
        'before',
        'after',
        'after_x_hours_ago',
        'before_x_hours_ago',
        'future',
        'past',
        'today',
        'yesterday',
        'previous_week',
        'previous_month',
        'previous_quarter',
        'previous_year',
        'previous_week_to_date',
        'previous_month_to_date',
        'previous_quarter_to_date',
        'previous_year_to_date',
        'previous_x_days',
        'previous_x_days_to_date',
      ];

      async function describeWith(fields: unknown[]) {
        const mockCapabilities = jest.fn().mockResolvedValue({ fields });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: jest.fn().mockReturnValue({ capabilities: mockCapabilities }) },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);
        mockFetchForestSchema.mockResolvedValue({ collections: [{ name: 'users', fields: [] }] });
        mockGetFieldsOfCollection.mockReturnValue([]);

        const result = (await registeredToolHandler({ collectionName: 'users' }, mockExtra)) as {
          content: { text: string }[];
        };

        return JSON.parse(result.content[0].text).fields;
      }

      it('announces every operator agent-ruby serves in a value the list tool accepts', async () => {
        const [field] = await describeWith([
          { name: 'price', type: 'Number', operators: SERVED_BY_AGENTS },
        ]);

        field.operators.forEach((operator: string) => {
          expect(filterSchema.safeParse({ field: 'price', operator, value: 50 }).success).toBe(
            true,
          );
        });
        expect(field.operators).toHaveLength(SERVED_BY_AGENTS.length);
        expect(field.operators.slice(0, 3)).toEqual(['Equal', 'NotEqual', 'LessThan']);
      });

      it('drops an operator the list tool does not know and logs it at Debug', async () => {
        const [field] = await describeWith([
          { name: 'price', type: 'Number', operators: ['less_than', 'fuzzy_match'] },
        ]);

        expect(field.operators).toEqual(['LessThan']);
        expect(mockLogger).toHaveBeenCalledWith('Debug', expect.stringContaining('fuzzy_match'));
      });

      it('leaves a field without operators (ManyToOne) without operators', async () => {
        const [field] = await describeWith([{ name: 'owner', type: 'Number' }]);

        expect(field).not.toHaveProperty('operators');
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
                  enums: null,
                  reference: null,
                },
                {
                  field: 'email',
                  type: 'String',
                  isSortable: false,
                  isPrimaryKey: false,
                  isReadOnly: false,
                  isRequired: false,
                  enums: null,
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

      it('should return error result and log Error for non-404 capabilities errors', async () => {
        const mockCapabilities = jest.fn().mockRejectedValue(new Error('Server error'));
        const mockCollection = jest.fn().mockReturnValue({ capabilities: mockCapabilities });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        mockFetchForestSchema.mockResolvedValue({ collections: [] });
        mockGetFieldsOfCollection.mockReturnValue([]);

        const result = await registeredToolHandler({ collectionName: 'users' }, mockExtra);
        expect(result).toEqual({
          content: [{ type: 'text', text: expect.stringContaining('Server error') }],
          isError: true,
        });

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
            enums: null,
            reference: null,
          },
          {
            field: 'orders',
            type: '[Number]',
            isSortable: false,
            isPrimaryKey: false,
            isReadOnly: false,
            isRequired: false,
            enums: null,
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
            enums: null,
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
            enums: null,
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
            enums: null,
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
            enums: null,
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
            enums: null,
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
            enums: null,
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

      it('should detect polymorphic BelongsTo relations from forest-rails schema', async () => {
        const mockFields = [
          {
            field: 'commentable',
            type: 'Number',
            isSortable: false,
            isPrimaryKey: false,
            isReadOnly: false,
            isRequired: false,
            enums: null,
            reference: 'commentable.id',
            relationship: 'BelongsTo',
            polymorphicReferencedModels: ['Post', 'Video'],
          },
        ] as unknown as schemaFetcher.ForestField[];
        mockFetchForestSchema.mockResolvedValue({
          collections: [{ name: 'comments', fields: mockFields }],
        });
        mockGetFieldsOfCollection.mockReturnValue(mockFields);

        const result = (await registeredToolHandler({ collectionName: 'comments' }, mockExtra)) as {
          content: { type: string; text: string }[];
        };

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.relations).toContainEqual({
          name: 'commentable',
          type: 'many-to-one',
          targetCollection: null,
          isPolymorphic: true,
          polymorphicTargets: ['Post', 'Video'],
        });
      });

      it('should not add polymorphic fields to non-polymorphic relations', async () => {
        const mockFields: schemaFetcher.ForestField[] = [
          {
            field: 'user',
            type: 'Number',
            isSortable: false,
            isPrimaryKey: false,
            isReadOnly: false,
            isRequired: false,
            enums: null,
            reference: 'users.id',
            relationship: 'BelongsTo',
          },
        ];
        mockFetchForestSchema.mockResolvedValue({
          collections: [{ name: 'comments', fields: mockFields }],
        });
        mockGetFieldsOfCollection.mockReturnValue(mockFields);

        const result = (await registeredToolHandler({ collectionName: 'comments' }, mockExtra)) as {
          content: { type: string; text: string }[];
        };

        const parsed = JSON.parse(result.content[0].text);
        const relation = parsed.relations[0];
        expect(relation.targetCollection).toBe('users');
        expect(relation.isPolymorphic).toBeUndefined();
        expect(relation.polymorphicTargets).toBeUndefined();
      });

      it('should treat empty polymorphic-referenced-models as non-polymorphic', async () => {
        const mockFields = [
          {
            field: 'commentable',
            type: 'Number',
            isSortable: false,
            isPrimaryKey: false,
            isReadOnly: false,
            isRequired: false,
            enums: null,
            reference: 'commentable.id',
            relationship: 'BelongsTo',
            polymorphicReferencedModels: [],
          },
        ] as unknown as schemaFetcher.ForestField[];
        mockFetchForestSchema.mockResolvedValue({
          collections: [{ name: 'comments', fields: mockFields }],
        });
        mockGetFieldsOfCollection.mockReturnValue(mockFields);

        const result = (await registeredToolHandler({ collectionName: 'comments' }, mockExtra)) as {
          content: { type: string; text: string }[];
        };

        const parsed = JSON.parse(result.content[0].text);
        const relation = parsed.relations[0];
        expect(relation.targetCollection).toBe('commentable');
        expect(relation.isPolymorphic).toBeUndefined();
        expect(relation.polymorphicTargets).toBeUndefined();
      });
    });

    describe('record keys', () => {
      function schemaField(
        field: string,
        overrides: Partial<schemaFetcher.ForestField> = {},
      ): schemaFetcher.ForestField {
        return {
          field,
          type: 'String',
          isSortable: true,
          isPrimaryKey: false,
          isReadOnly: false,
          isRequired: false,
          enums: null,
          reference: null,
          ...overrides,
        };
      }

      function mockAgent(capabilities: () => Promise<unknown>) {
        const mockCollection = jest
          .fn()
          .mockReturnValue({ capabilities: jest.fn().mockImplementation(capabilities) });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);
      }

      async function describeWith(
        fields: schemaFetcher.ForestField[],
        capabilities: () => Promise<unknown>,
      ) {
        mockAgent(capabilities);
        mockFetchForestSchema.mockResolvedValue({ collections: [{ name: 'articles', fields }] });
        mockGetFieldsOfCollection.mockReturnValue(fields);

        const result = (await registeredToolHandler({ collectionName: 'articles' }, mockExtra)) as {
          content: { type: string; text: string }[];
        };

        return JSON.parse(result.content[0].text) as {
          fields: { name: string; recordKey?: string }[];
          relations: { name: string; recordKey?: string }[];
        };
      }

      const withoutCapabilities = () => Promise.reject(new Error('404 Not Found'));
      const withCapabilities = (names: string[]) => () =>
        Promise.resolve({
          fields: names.map(name => ({ name, type: 'String', operators: ['Equal'] })),
        });

      it('should publish the camelCase record key of a snake_case field on a v1 schema', async () => {
        const parsed = await describeWith(
          [schemaField('id', { isPrimaryKey: true }), schemaField('created_at')],
          withoutCapabilities,
        );

        expect(parsed.fields.find(f => f.name === 'created_at')).toHaveProperty(
          'recordKey',
          'createdAt',
        );
      });

      it('should publish the record key of a snake_case field from capabilities', async () => {
        const parsed = await describeWith(
          [schemaField('id', { isPrimaryKey: true }), schemaField('created_at')],
          withCapabilities(['id', 'created_at']),
        );

        expect(parsed.fields.find(f => f.name === 'created_at')).toHaveProperty(
          'recordKey',
          'createdAt',
        );
      });

      it('should publish no record key when every name is already camelCase', async () => {
        const parsed = await describeWith(
          [schemaField('id', { isPrimaryKey: true }), schemaField('createdAt')],
          withCapabilities(['id', 'createdAt']),
        );

        expect(parsed.fields).toEqual([
          expect.not.objectContaining({ recordKey: expect.anything() }),
          expect.not.objectContaining({ recordKey: expect.anything() }),
        ]);
      });

      it('should publish no record key on fields that collide on one key', async () => {
        const parsed = await describeWith(
          [schemaField('first_name'), schemaField('firstName')],
          withoutCapabilities,
        );

        expect(parsed.fields.find(f => f.name === 'first_name')).not.toHaveProperty('recordKey');
        expect(parsed.fields.find(f => f.name === 'firstName')).not.toHaveProperty('recordKey');
      });

      it('should detect a collision with a relation the fields list leaves out', async () => {
        const parsed = await describeWith(
          [
            schemaField('author_id', { type: 'Number' }),
            schemaField('authorId', {
              type: 'Number',
              reference: 'users.id',
              relationship: 'BelongsTo',
            }),
          ],
          withoutCapabilities,
        );

        expect(parsed.fields.find(f => f.name === 'author_id')).not.toHaveProperty('recordKey');
      });

      it('should detect a collision with a capability field absent from the schema', async () => {
        const parsed = await describeWith(
          [schemaField('first_name')],
          withCapabilities(['first_name', 'firstName']),
        );

        expect(parsed.fields.find(f => f.name === 'first_name')).not.toHaveProperty('recordKey');
      });

      it('should publish Id as the record key of a Mongo _id', async () => {
        const parsed = await describeWith(
          [schemaField('_id', { isPrimaryKey: true })],
          withoutCapabilities,
        );

        expect(parsed.fields.find(f => f.name === '_id')).toHaveProperty('recordKey', 'Id');
      });

      it('should publish Id for _id and nothing for Id, which maps to the reserved id', async () => {
        const parsed = await describeWith(
          [schemaField('_id', { isPrimaryKey: true }), schemaField('Id')],
          withoutCapabilities,
        );

        expect(parsed.fields.find(f => f.name === '_id')).toHaveProperty('recordKey', 'Id');
        expect(parsed.fields.find(f => f.name === 'Id')).not.toHaveProperty('recordKey');
      });

      it('should publish the record key of a snake_case relation', async () => {
        const parsed = await describeWith(
          [
            schemaField('id', { isPrimaryKey: true }),
            schemaField('blog_author', {
              type: 'Number',
              reference: 'users.id',
              relationship: 'BelongsTo',
            }),
          ],
          withoutCapabilities,
        );

        expect(parsed.relations).toEqual([
          {
            name: 'blog_author',
            recordKey: 'blogAuthor',
            type: 'many-to-one',
            targetCollection: 'users',
          },
        ]);
      });

      it('should publish the same record key on a many-to-one listed in both fields and relations', async () => {
        const parsed = await describeWith(
          [
            schemaField('id', { isPrimaryKey: true }),
            schemaField('blog_author', {
              type: 'Number',
              reference: 'users.id',
              relationship: 'BelongsTo',
            }),
          ],
          withCapabilities(['id', 'blog_author']),
        );

        expect(parsed.fields.find(f => f.name === 'blog_author')).toHaveProperty(
          'recordKey',
          'blogAuthor',
        );
        expect(parsed.relations.find(r => r.name === 'blog_author')).toHaveProperty(
          'recordKey',
          'blogAuthor',
        );
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
            fields: [{ field: 'subject', type: 'String' }],
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
            fields: [{ field: 'reason', type: 'String' }],
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

      it('should exclude actions without endpoint and expose them in _meta.skippedActions', async () => {
        mockGetActionsOfCollection.mockReturnValue([
          {
            id: 'action-with-endpoint',
            name: 'Valid Action',
            type: 'single',
            endpoint: '/forest/actions/valid',
            fields: [],
            hooks: { load: false, change: [] },
            download: false,
          },
          {
            id: 'action-without-endpoint',
            name: 'Invalid Action',
            type: 'single',
            endpoint: '',
            fields: [],
            hooks: { load: false, change: [] },
            download: false,
          },
          {
            id: 'action-null-endpoint',
            name: 'Null Endpoint Action',
            type: 'global',
            endpoint: null,
            fields: [],
            hooks: { load: false, change: [] },
            download: false,
          },
        ]);

        const result = (await registeredToolHandler({ collectionName: 'users' }, mockExtra)) as {
          content: { type: string; text: string }[];
        };

        const { actions, _meta: meta } = JSON.parse(result.content[0].text);
        expect(actions).toHaveLength(1);
        expect(actions[0].name).toBe('Valid Action');
        expect(meta.skippedActions).toEqual([
          { name: 'Invalid Action', reason: 'no endpoint configured' },
          { name: 'Null Endpoint Action', reason: 'no endpoint configured' },
        ]);
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
            enums: null,
            reference: null,
          },
          {
            field: 'posts',
            type: '[Number]',
            isSortable: false,
            isPrimaryKey: false,
            isReadOnly: false,
            isRequired: false,
            enums: null,
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

        const { _meta: meta } = JSON.parse(result.content[0].text);
        expect(meta.capabilitiesAvailable).toBe(true);
        expect(meta.note).toBeUndefined();
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

        const { _meta: meta } = JSON.parse(result.content[0].text);
        expect(meta.capabilitiesAvailable).toBe(false);
        expect(meta.note).toBe(
          'Operators unavailable (older agent version). Fields have operators: null.',
        );
      });
    });
  });
});
