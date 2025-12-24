import type { Logger } from '../../src/server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import declareListTool from '../../src/tools/list';
import buildClient from '../../src/utils/agent-caller';
import * as schemaFetcher from '../../src/utils/schema-fetcher';
import withActivityLog from '../../src/utils/with-activity-log';

jest.mock('../../src/utils/agent-caller');
jest.mock('../../src/utils/with-activity-log');
jest.mock('../../src/utils/schema-fetcher');

const mockLogger: Logger = jest.fn();

const mockBuildClient = buildClient as jest.MockedFunction<typeof buildClient>;
const mockWithActivityLog = withActivityLog as jest.MockedFunction<typeof withActivityLog>;
const mockFetchForestSchema = schemaFetcher.fetchForestSchema as jest.MockedFunction<
  typeof schemaFetcher.fetchForestSchema
>;
const mockGetFieldsOfCollection = schemaFetcher.getFieldsOfCollection as jest.MockedFunction<
  typeof schemaFetcher.getFieldsOfCollection
>;

describe('declareListTool', () => {
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
    it('should register a tool named "list"', () => {
      declareListTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      expect(mcpServer.registerTool).toHaveBeenCalledWith(
        'list',
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should register tool with correct title and description', () => {
      declareListTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      expect(registeredToolConfig.title).toBe('List records from a collection');
      expect(registeredToolConfig.description).toBe(
        'Retrieve a list of records from the specified collection.',
      );
    });

    it('should define correct input schema', () => {
      declareListTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      expect(registeredToolConfig.inputSchema).toHaveProperty('collectionName');
      expect(registeredToolConfig.inputSchema).toHaveProperty('search');
      expect(registeredToolConfig.inputSchema).toHaveProperty('filters');
      expect(registeredToolConfig.inputSchema).toHaveProperty('sort');
      expect(registeredToolConfig.inputSchema).toHaveProperty('shouldSearchInRelation');
      expect(registeredToolConfig.inputSchema).toHaveProperty('fields');
      expect(registeredToolConfig.inputSchema).toHaveProperty('enableCount');
    });

    it('should have fields schema with description mentioning @@@ separator for relations', () => {
      declareListTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const schema = registeredToolConfig.inputSchema as any;
      // Zod schema: z.array().describe().optional()
      // The description is stored in metadata, accessible via meta() on the inner type
      const fieldsZodDef = Reflect.get(schema.fields, '_def');
      const fieldsDescription = fieldsZodDef.innerType.meta().description;
      expect(fieldsDescription).toContain('@@@');
      expect(fieldsDescription).toContain('relationName@@@fieldName');
    });

    it('should use string type for collectionName when no collection names provided', () => {
      declareListTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

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
      declareListTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

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
      declareListTool(mcpServer, 'https://api.forestadmin.com', mockLogger, [
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
      declareListTool(mcpServer, 'https://api.forestadmin.com', mockLogger);
    });

    it('should call buildClient with the extra parameter', async () => {
      const mockList = jest.fn().mockResolvedValue([{ id: 1, name: 'Item 1' }]);
      const mockCollection = jest.fn().mockReturnValue({ list: mockList });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      await registeredToolHandler({ collectionName: 'users' }, mockExtra);

      expect(mockBuildClient).toHaveBeenCalledWith(mockExtra);
    });

    it('should call rpcClient.collection with the collection name', async () => {
      const mockList = jest.fn().mockResolvedValue([]);
      const mockCollection = jest.fn().mockReturnValue({ list: mockList });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      await registeredToolHandler({ collectionName: 'products' }, mockExtra);

      expect(mockCollection).toHaveBeenCalledWith('products');
    });

    it('should return results as JSON text content with records wrapper', async () => {
      const mockData = [
        { id: 1, name: 'Product 1' },
        { id: 2, name: 'Product 2' },
      ];
      const mockList = jest.fn().mockResolvedValue(mockData);
      const mockCollection = jest.fn().mockReturnValue({ list: mockList });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      const result = await registeredToolHandler({ collectionName: 'products' }, mockExtra);

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify({ records: mockData }) }],
      });
    });

    describe('activity logging', () => {
      beforeEach(() => {
        const mockList = jest.fn().mockResolvedValue([]);
        const mockCollection = jest.fn().mockReturnValue({ list: mockList });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);
      });

      it('should call withActivityLog with "index" action type for basic list', async () => {
        await registeredToolHandler({ collectionName: 'users' }, mockExtra);

        expect(mockWithActivityLog).toHaveBeenCalledWith({
          forestServerUrl: 'https://api.forestadmin.com',
          request: mockExtra,
          action: 'index',
          context: { collectionName: 'users' },
          logger: mockLogger,
          operation: expect.any(Function),
          errorEnhancer: expect.any(Function),
        });
      });

      it('should call withActivityLog with "search" action type when search is provided', async () => {
        await registeredToolHandler({ collectionName: 'users', search: 'john' }, mockExtra);

        expect(mockWithActivityLog).toHaveBeenCalledWith({
          forestServerUrl: 'https://api.forestadmin.com',
          request: mockExtra,
          action: 'search',
          context: { collectionName: 'users' },
          logger: mockLogger,
          operation: expect.any(Function),
          errorEnhancer: expect.any(Function),
        });
      });

      it('should call withActivityLog with "filter" action type when filters are provided', async () => {
        await registeredToolHandler(
          {
            collectionName: 'users',
            filters: { field: 'status', operator: 'Equal', value: 'active' },
          },
          mockExtra,
        );

        expect(mockWithActivityLog).toHaveBeenCalledWith({
          forestServerUrl: 'https://api.forestadmin.com',
          request: mockExtra,
          action: 'filter',
          context: { collectionName: 'users' },
          logger: mockLogger,
          operation: expect.any(Function),
          errorEnhancer: expect.any(Function),
        });
      });

      it('should prioritize "search" over "filter" when both are provided', async () => {
        await registeredToolHandler(
          {
            collectionName: 'users',
            search: 'john',
            filters: { field: 'status', operator: 'Equal', value: 'active' },
          },
          mockExtra,
        );

        expect(mockWithActivityLog).toHaveBeenCalledWith({
          forestServerUrl: 'https://api.forestadmin.com',
          request: mockExtra,
          action: 'search',
          context: { collectionName: 'users' },
          logger: mockLogger,
          operation: expect.any(Function),
          errorEnhancer: expect.any(Function),
        });
      });

      it('should wrap the list operation with activity logging', async () => {
        const mockList = jest.fn().mockResolvedValue([{ id: 1 }]);
        const mockCollection = jest.fn().mockReturnValue({ list: mockList });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        await registeredToolHandler({ collectionName: 'users' }, mockExtra);

        // Verify the operation was executed through withActivityLog
        expect(mockWithActivityLog).toHaveBeenCalled();
        expect(mockList).toHaveBeenCalled();
      });
    });

    describe('list parameters', () => {
      let mockList: jest.Mock;
      let mockCollection: jest.Mock;

      beforeEach(() => {
        mockList = jest.fn().mockResolvedValue([]);
        mockCollection = jest.fn().mockReturnValue({ list: mockList });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);
      });

      it('should call list with options for basic request', async () => {
        await registeredToolHandler({ collectionName: 'users' }, mockExtra);

        expect(mockList).toHaveBeenCalledWith({ collectionName: 'users' });
      });

      it('should pass search parameter to list', async () => {
        await registeredToolHandler({ collectionName: 'users', search: 'test query' }, mockExtra);

        expect(mockList).toHaveBeenCalledWith({ collectionName: 'users', search: 'test query' });
      });

      it('should pass filters directly', async () => {
        const filters = { field: 'name', operator: 'Equal', value: 'John' };

        await registeredToolHandler({ collectionName: 'users', filters }, mockExtra);

        expect(mockList).toHaveBeenCalledWith({
          collectionName: 'users',
          filters,
        });
      });

      it('should pass sort parameter when both field and ascending are provided', async () => {
        await registeredToolHandler(
          {
            collectionName: 'users',
            sort: { field: 'createdAt', ascending: true },
          },
          mockExtra,
        );

        expect(mockList).toHaveBeenCalledWith({
          collectionName: 'users',
          sort: { field: 'createdAt', ascending: true },
        });
      });

      it('should pass sort parameter when ascending is false', async () => {
        await registeredToolHandler(
          {
            collectionName: 'users',
            sort: { field: 'createdAt', ascending: false },
          },
          mockExtra,
        );

        expect(mockList).toHaveBeenCalledWith({
          collectionName: 'users',
          sort: { field: 'createdAt', ascending: false },
        });
      });

      it('should pass sort even when only field is provided', async () => {
        await registeredToolHandler(
          {
            collectionName: 'users',
            sort: { field: 'createdAt' },
          },
          mockExtra,
        );

        expect(mockList).toHaveBeenCalledWith({
          collectionName: 'users',
          sort: { field: 'createdAt' },
        });
      });

      it('should pass all parameters together', async () => {
        const filters = {
          aggregator: 'And',
          conditions: [{ field: 'active', operator: 'Equal', value: true }],
        };

        await registeredToolHandler(
          {
            collectionName: 'users',
            search: 'john',
            filters,
            sort: { field: 'name', ascending: true },
          },
          mockExtra,
        );

        expect(mockList).toHaveBeenCalledWith({
          collectionName: 'users',
          search: 'john',
          filters,
          sort: { field: 'name', ascending: true },
        });
      });

      describe('shouldSearchInRelation parameter', () => {
        it('should not pass shouldSearchInRelation when it is false', async () => {
          await registeredToolHandler(
            { collectionName: 'users', search: 'test', shouldSearchInRelation: false },
            mockExtra,
          );

          expect(mockList).toHaveBeenCalledWith({
            collectionName: 'users',
            search: 'test',
            shouldSearchInRelation: false,
          });
        });

        it('should not pass shouldSearchInRelation when it is not provided', async () => {
          await registeredToolHandler({ collectionName: 'users', search: 'test' }, mockExtra);

          expect(mockList).toHaveBeenCalledWith({ collectionName: 'users', search: 'test' });
        });

        it('should pass shouldSearchInRelation when shouldSearchInRelation is true', async () => {
          await registeredToolHandler(
            { collectionName: 'users', search: 'test', shouldSearchInRelation: true },
            mockExtra,
          );

          expect(mockList).toHaveBeenCalledWith({
            collectionName: 'users',
            search: 'test',
            shouldSearchInRelation: true,
          });
        });

        it('should pass shouldSearchInRelation with other parameters', async () => {
          const filters = {
            aggregator: 'And',
            conditions: [{ field: 'active', operator: 'Equal', value: true }],
          };

          await registeredToolHandler(
            {
              collectionName: 'users',
              search: 'john',
              filters,
              sort: { field: 'name', ascending: true },
              shouldSearchInRelation: true,
            },
            mockExtra,
          );

          expect(mockList).toHaveBeenCalledWith({
            collectionName: 'users',
            search: 'john',
            filters,
            sort: { field: 'name', ascending: true },
            shouldSearchInRelation: true,
          });
        });

        it('should pass shouldSearchInRelation even without search parameter', async () => {
          await registeredToolHandler(
            { collectionName: 'users', shouldSearchInRelation: true },
            mockExtra,
          );

          expect(mockList).toHaveBeenCalledWith({
            collectionName: 'users',
            shouldSearchInRelation: true,
          });
        });
      });

      describe('fields parameter', () => {
        it('should pass fields when fields is provided', async () => {
          // Mock schema for field validation
          const mockSchema: schemaFetcher.ForestSchema = {
            collections: [
              {
                name: 'users',
                fields: [
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
                    field: 'name',
                    type: 'String',
                    isSortable: true,
                    enum: null,
                    reference: null,
                    isReadOnly: false,
                    isRequired: false,
                    isPrimaryKey: false,
                  },
                  {
                    field: 'email',
                    type: 'String',
                    isSortable: true,
                    enum: null,
                    reference: null,
                    isReadOnly: false,
                    isRequired: false,
                    isPrimaryKey: false,
                  },
                ],
              },
            ],
          };
          mockFetchForestSchema.mockResolvedValue(mockSchema);
          mockGetFieldsOfCollection.mockReturnValue(mockSchema.collections[0].fields);

          await registeredToolHandler(
            { collectionName: 'users', fields: ['id', 'name', 'email'] },
            mockExtra,
          );

          expect(mockList).toHaveBeenCalledWith({
            collectionName: 'users',
            fields: ['id', 'name', 'email'],
          });
        });

        it('should not pass fields when fields is not provided', async () => {
          await registeredToolHandler({ collectionName: 'users' }, mockExtra);

          expect(mockList).toHaveBeenCalledWith({ collectionName: 'users' });
        });

        it('should pass empty fields array when provided', async () => {
          await registeredToolHandler({ collectionName: 'users', fields: [] }, mockExtra);

          expect(mockList).toHaveBeenCalledWith({
            collectionName: 'users',
            fields: [],
          });
        });

        it('should pass fields with other parameters', async () => {
          // Mock schema for field validation
          const mockSchema: schemaFetcher.ForestSchema = {
            collections: [
              {
                name: 'users',
                fields: [
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
                    field: 'name',
                    type: 'String',
                    isSortable: true,
                    enum: null,
                    reference: null,
                    isReadOnly: false,
                    isRequired: false,
                    isPrimaryKey: false,
                  },
                ],
              },
            ],
          };
          mockFetchForestSchema.mockResolvedValue(mockSchema);
          mockGetFieldsOfCollection.mockReturnValue(mockSchema.collections[0].fields);

          const filters = {
            aggregator: 'And',
            conditions: [{ field: 'active', operator: 'Equal', value: true }],
          };

          await registeredToolHandler(
            {
              collectionName: 'users',
              search: 'john',
              filters,
              sort: { field: 'name', ascending: true },
              fields: ['id', 'name'],
            },
            mockExtra,
          );

          expect(mockList).toHaveBeenCalledWith({
            collectionName: 'users',
            search: 'john',
            filters,
            sort: { field: 'name', ascending: true },
            fields: ['id', 'name'],
          });
        });

        it('should accept fields with @@@ separator for relation sub-fields', async () => {
          await registeredToolHandler(
            { collectionName: 'orders', fields: ['id', 'customer@@@name', 'customer@@@email'] },
            mockExtra,
          );

          expect(mockList).toHaveBeenCalledWith({
            collectionName: 'orders',
            fields: ['id', 'customer@@@name', 'customer@@@email'],
          });
        });
      });

      describe('pagination parameter', () => {
        it('should pass pagination when provided', async () => {
          await registeredToolHandler(
            { collectionName: 'users', pagination: { size: 10, number: 2 } },
            mockExtra,
          );

          expect(mockList).toHaveBeenCalledWith({
            collectionName: 'users',
            pagination: { size: 10, number: 2 },
          });
        });

        it('should pass pagination with only size', async () => {
          await registeredToolHandler(
            { collectionName: 'users', pagination: { size: 25 } },
            mockExtra,
          );

          expect(mockList).toHaveBeenCalledWith({
            collectionName: 'users',
            pagination: { size: 25 },
          });
        });

        it('should pass pagination with only page number', async () => {
          await registeredToolHandler(
            { collectionName: 'users', pagination: { number: 3 } },
            mockExtra,
          );

          expect(mockList).toHaveBeenCalledWith({
            collectionName: 'users',
            pagination: { number: 3 },
          });
        });

        it('should pass pagination with other parameters', async () => {
          const filters = { field: 'active', operator: 'Equal', value: true };

          await registeredToolHandler(
            {
              collectionName: 'users',
              search: 'john',
              filters,
              sort: { field: 'name', ascending: true },
              pagination: { size: 20, number: 1 },
            },
            mockExtra,
          );

          expect(mockList).toHaveBeenCalledWith({
            collectionName: 'users',
            search: 'john',
            filters,
            sort: { field: 'name', ascending: true },
            pagination: { size: 20, number: 1 },
          });
        });
      });

      describe('enableCount parameter', () => {
        let listMock: jest.Mock;
        let countMock: jest.Mock;
        let collectionMock: jest.Mock;

        beforeEach(() => {
          listMock = jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]);
          countMock = jest.fn().mockResolvedValue(42);
          collectionMock = jest.fn().mockReturnValue({ list: listMock, count: countMock });
          mockBuildClient.mockReturnValue({
            rpcClient: { collection: collectionMock },
            authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
          } as unknown as ReturnType<typeof buildClient>);
        });

        it('should not call count when enableCount is false (default)', async () => {
          const result = await registeredToolHandler({ collectionName: 'users' }, mockExtra);

          expect(listMock).toHaveBeenCalled();
          expect(countMock).not.toHaveBeenCalled();
          expect(result).toEqual({
            content: [{ type: 'text', text: JSON.stringify({ records: [{ id: 1 }, { id: 2 }] }) }],
          });
        });

        it('should call both list and count when enableCount is true', async () => {
          const result = await registeredToolHandler(
            { collectionName: 'users', enableCount: true },
            mockExtra,
          );

          expect(listMock).toHaveBeenCalled();
          expect(countMock).toHaveBeenCalled();
          expect(result).toEqual({
            content: [
              {
                type: 'text',
                text: JSON.stringify({ records: [{ id: 1 }, { id: 2 }], totalCount: 42 }),
              },
            ],
          });
        });

        it('should pass the same options to both list and count', async () => {
          const filters = { field: 'status', operator: 'Equal', value: 'active' };

          await registeredToolHandler(
            {
              collectionName: 'users',
              filters,
              search: 'test',
              enableCount: true,
            },
            mockExtra,
          );

          expect(listMock).toHaveBeenCalledWith({
            collectionName: 'users',
            filters,
            search: 'test',
            enableCount: true,
          });
          expect(countMock).toHaveBeenCalledWith({
            collectionName: 'users',
            filters,
            search: 'test',
            enableCount: true,
          });
        });

        it('should execute list and count in parallel', async () => {
          // Track call order
          const callOrder: string[] = [];
          listMock.mockImplementation(async () => {
            callOrder.push('list-start');
            await new Promise<void>(resolve => {
              setTimeout(resolve, 10);
            });
            callOrder.push('list-end');

            return [{ id: 1 }];
          });
          countMock.mockImplementation(async () => {
            callOrder.push('count-start');
            await new Promise<void>(resolve => {
              setTimeout(resolve, 10);
            });
            callOrder.push('count-end');

            return 10;
          });

          await registeredToolHandler({ collectionName: 'users', enableCount: true }, mockExtra);

          // Both should start before either ends (parallel execution)
          expect(callOrder.indexOf('list-start')).toBeLessThan(callOrder.indexOf('list-end'));
          expect(callOrder.indexOf('count-start')).toBeLessThan(callOrder.indexOf('count-end'));
          // Both starts should happen before both ends
          expect(callOrder.indexOf('list-start') < 2 && callOrder.indexOf('count-start') < 2).toBe(
            true,
          );
        });
      });

      it('should parse filters sent as JSON string (LLM workaround)', async () => {
        const filters = {
          aggregator: 'And',
          conditions: [{ field: 'status', operator: 'Equal', value: 'active' }],
        };
        const filtersAsString = JSON.stringify(filters);

        // Simulate MCP SDK behavior: parse input through schema before calling handler
        const inputSchema = registeredToolConfig.inputSchema as Record<
          string,
          {
            parse: (value: unknown) => unknown;
            optional: () => { parse: (value: unknown) => unknown };
          }
        >;
        const parsedFilters = inputSchema.filters.parse(filtersAsString);

        // Verify the preprocess correctly parsed the JSON string into an object
        expect(parsedFilters).toEqual(filters);
      });

      it('should handle filters as object when not sent as string', async () => {
        const filters = { field: 'name', operator: 'Equal', value: 'John' };

        await registeredToolHandler(
          {
            collectionName: 'users',
            filters,
          },
          mockExtra,
        );

        expect(mockList).toHaveBeenCalledWith({
          collectionName: 'users',
          filters,
        });
      });

      it('should throw validation error when filters is malformed JSON string', () => {
        const malformedJson = '{ invalid json }';

        const inputSchema = registeredToolConfig.inputSchema as Record<
          string,
          { parse: (value: unknown) => unknown }
        >;

        expect(() => inputSchema.filters.parse(malformedJson)).toThrow();
      });

      it('should throw validation error when filters is a plain string', () => {
        const plainString = 'not a json object';

        const inputSchema = registeredToolConfig.inputSchema as Record<
          string,
          { parse: (value: unknown) => unknown }
        >;

        expect(() => inputSchema.filters.parse(plainString)).toThrow();
      });
    });

    describe('error handling', () => {
      let mockList: jest.Mock;
      let mockCollection: jest.Mock;

      beforeEach(() => {
        mockList = jest.fn();
        mockCollection = jest.fn().mockReturnValue({ list: mockList });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);
      });

      it('should parse error with nested error.text structure in message', async () => {
        // The RPC client throws an Error with message containing JSON: { error: { text: '...' } }
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

        await expect(registeredToolHandler({ collectionName: 'users' }, mockExtra)).rejects.toThrow(
          'Invalid filters provided',
        );
      });

      it('should parse error with direct text property in message', async () => {
        // The RPC client throws an Error with message containing JSON: { text: '...' }
        const errorPayload = {
          text: JSON.stringify({
            errors: [{ name: 'ValidationError', detail: 'Direct text error' }],
          }),
        };
        const agentError = new Error(JSON.stringify(errorPayload));
        mockList.mockRejectedValue(agentError);

        await expect(registeredToolHandler({ collectionName: 'users' }, mockExtra)).rejects.toThrow(
          'Direct text error',
        );
      });

      it('should use message property from parsed JSON when no text field', async () => {
        // The RPC client throws an Error with message containing JSON: { message: '...' }
        const errorPayload = {
          message: 'Error message from JSON payload',
        };
        const agentError = new Error(JSON.stringify(errorPayload));
        mockList.mockRejectedValue(agentError);

        await expect(registeredToolHandler({ collectionName: 'users' }, mockExtra)).rejects.toThrow(
          'Error message from JSON payload',
        );
      });

      it('should fall back to error.message when message is not valid JSON', async () => {
        // The RPC client throws an Error with a plain string message (not JSON)
        const agentError = new Error('Plain error message');
        mockList.mockRejectedValue(agentError);

        await expect(registeredToolHandler({ collectionName: 'users' }, mockExtra)).rejects.toThrow(
          'Plain error message',
        );
      });

      it('should handle string errors thrown directly', async () => {
        // Some libraries throw string errors directly
        mockList.mockRejectedValue('Connection failed');

        await expect(registeredToolHandler({ collectionName: 'users' }, mockExtra)).rejects.toThrow(
          'Connection failed',
        );
      });

      it('should provide helpful error message for Invalid sort errors', async () => {
        // The RPC client throws an "Invalid sort" error
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

        // Mock schema fetcher to return collection fields
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
            field: 'name',
            type: 'String',
            isSortable: true,
            enum: null,
            reference: null,
            isReadOnly: false,
            isRequired: false,
            isPrimaryKey: false,
          },
          {
            field: 'email',
            type: 'String',
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

        await expect(registeredToolHandler({ collectionName: 'users' }, mockExtra)).rejects.toThrow(
          'The sort field provided is invalid for this collection. Available fields for the collection users are: id, name, email.',
        );

        expect(mockFetchForestSchema).toHaveBeenCalledWith('https://api.forestadmin.com');
        expect(mockGetFieldsOfCollection).toHaveBeenCalledWith(mockSchema, 'users');
      });
    });
  });
});
