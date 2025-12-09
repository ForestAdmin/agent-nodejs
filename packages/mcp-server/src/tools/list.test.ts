import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import declareListTool from './list.js';
import createActivityLog from '../utils/activity-logs-creator.js';
import buildClient from '../utils/agent-caller.js';

jest.mock('../utils/agent-caller.js');
jest.mock('../utils/activity-logs-creator.js');

const mockBuildClient = buildClient as jest.MockedFunction<typeof buildClient>;
const mockCreateActivityLog = createActivityLog as jest.MockedFunction<typeof createActivityLog>;

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

    mockCreateActivityLog.mockResolvedValue(undefined);
  });

  describe('tool registration', () => {
    it('should register a tool named "list"', () => {
      declareListTool(mcpServer, 'https://api.forestadmin.com');

      expect(mcpServer.registerTool).toHaveBeenCalledWith(
        'list',
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should register tool with correct title and description', () => {
      declareListTool(mcpServer, 'https://api.forestadmin.com');

      expect(registeredToolConfig.title).toBe('List data from the customer agent');
      expect(registeredToolConfig.description).toBe(
        'Retrieve a list of data from the specified collection in the customer agent.',
      );
    });

    it('should define correct input schema', () => {
      declareListTool(mcpServer, 'https://api.forestadmin.com');

      expect(registeredToolConfig.inputSchema).toHaveProperty('collectionName');
      expect(registeredToolConfig.inputSchema).toHaveProperty('search');
      expect(registeredToolConfig.inputSchema).toHaveProperty('filters');
      expect(registeredToolConfig.inputSchema).toHaveProperty('sort');
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
      declareListTool(mcpServer, 'https://api.forestadmin.com');
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

    it('should return results as JSON text content', async () => {
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
        content: [{ type: 'text', text: JSON.stringify(mockData) }],
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

      it('should create activity log with "index" action type for basic list', async () => {
        await registeredToolHandler({ collectionName: 'users' }, mockExtra);

        expect(mockCreateActivityLog).toHaveBeenCalledWith(
          'https://api.forestadmin.com',
          mockExtra,
          'index',
          { collectionName: 'users' },
        );
      });

      it('should create activity log with "search" action type when search is provided', async () => {
        await registeredToolHandler({ collectionName: 'users', search: 'john' }, mockExtra);

        expect(mockCreateActivityLog).toHaveBeenCalledWith(
          'https://api.forestadmin.com',
          mockExtra,
          'search',
          { collectionName: 'users' },
        );
      });

      it('should create activity log with "filter" action type when filters are provided', async () => {
        await registeredToolHandler(
          {
            collectionName: 'users',
            filters: { field: 'status', operator: 'Equal', value: 'active' },
          },
          mockExtra,
        );

        expect(mockCreateActivityLog).toHaveBeenCalledWith(
          'https://api.forestadmin.com',
          mockExtra,
          'filter',
          { collectionName: 'users' },
        );
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

        expect(mockCreateActivityLog).toHaveBeenCalledWith(
          'https://api.forestadmin.com',
          mockExtra,
          'search',
          { collectionName: 'users' },
        );
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

      it('should call list with empty parameters for basic request', async () => {
        await registeredToolHandler({ collectionName: 'users' }, mockExtra);

        expect(mockList).toHaveBeenCalledWith({});
      });

      it('should pass search parameter to list', async () => {
        await registeredToolHandler({ collectionName: 'users', search: 'test query' }, mockExtra);

        expect(mockList).toHaveBeenCalledWith({ search: 'test query' });
      });

      it('should pass filters wrapped in conditionTree', async () => {
        const filters = { field: 'name', operator: 'Equal', value: 'John' };

        await registeredToolHandler({ collectionName: 'users', filters }, mockExtra);

        expect(mockList).toHaveBeenCalledWith({
          filters: { conditionTree: filters },
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
          sort: { field: 'createdAt', ascending: false },
        });
      });

      it('should not pass sort when only field is provided', async () => {
        await registeredToolHandler(
          {
            collectionName: 'users',
            sort: { field: 'createdAt' },
          },
          mockExtra,
        );

        expect(mockList).toHaveBeenCalledWith({});
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
          search: 'john',
          filters: { conditionTree: filters },
          sort: { field: 'name', ascending: true },
        });
      });
    });
  });
});
