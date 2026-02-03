// eslint-disable-next-line import/no-extraneous-dependencies
import {
  AIBadRequestError,
  AIError,
  AINotConfiguredError,
  AINotFoundError,
  AIToolNotFoundError,
  AIUnprocessableError,
} from '@forestadmin/ai-proxy';
import {
  BadRequestError,
  NotFoundError,
  UnprocessableError,
} from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import AiProxyRoute from '../../../src/routes/ai/ai-proxy';
import { HttpCode, RouteType } from '../../../src/types';
import * as factories from '../../__factories__';

const mockRoute = jest.fn();

jest.mock('@forestadmin/ai-proxy', () => {
  const actual = jest.requireActual('@forestadmin/ai-proxy');

  return {
    ...actual,
    Router: jest.fn().mockImplementation(() => ({
      route: mockRoute,
    })),
  };
});

describe('AiProxyRoute', () => {
  const options = factories.forestAdminHttpDriverOptions.build();
  const services = factories.forestAdminHttpDriverServices.build();
  const router = factories.router.mockAllMethods().build();
  const aiConfigurations = [
    {
      name: 'gpt4',
      provider: 'openai' as const,
      apiKey: 'test-key',
      model: 'gpt-4o',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should have RouteType.PrivateRoute', () => {
      const route = new AiProxyRoute(services, options, aiConfigurations);

      expect(route.type).toBe(RouteType.PrivateRoute);
    });
  });

  describe('setupRoutes', () => {
    test('should register POST route at /_internal/ai-proxy/:route', () => {
      const route = new AiProxyRoute(services, options, aiConfigurations);
      route.setupRoutes(router);

      expect(router.post).toHaveBeenCalledWith('/_internal/ai-proxy/:route', expect.any(Function));
    });
  });

  describe('handleAiProxy', () => {
    test('should return 200 with response body on successful request', async () => {
      const route = new AiProxyRoute(services, options, aiConfigurations);
      const expectedResponse = { result: 'success' };
      mockRoute.mockResolvedValueOnce(expectedResponse);

      const context = createMockContext({
        customProperties: {
          params: { route: 'ai-query' },
          query: {},
        },
        requestBody: { messages: [] },
      });

      await (route as any).handleAiProxy(context);

      expect(context.response.status).toBe(HttpCode.Ok);
      expect(context.response.body).toEqual(expectedResponse);
    });

    test('should pass route, body, query, mcpConfigs and tokensByMcpServerName to router', async () => {
      const route = new AiProxyRoute(services, options, aiConfigurations);
      mockRoute.mockResolvedValueOnce({});

      const context = createMockContext({
        customProperties: {
          params: { route: 'ai-query' },
        },
        requestBody: { messages: [{ role: 'user', content: 'Hello' }] },
      });
      // Set query directly on context as createMockContext doesn't handle it properly
      context.query = { 'ai-name': 'gpt4' };

      await (route as any).handleAiProxy(context);

      expect(mockRoute).toHaveBeenCalledWith({
        route: 'ai-query',
        body: { messages: [{ role: 'user', content: 'Hello' }] },
        query: { 'ai-name': 'gpt4' },
        mcpConfigs: undefined, // mcpServerConfigService.getConfiguration returns undefined in test
      });
    });

    test('should inject oauth tokens into mcpConfigs when header is provided', async () => {
      const route = new AiProxyRoute(services, options, aiConfigurations);
      mockRoute.mockResolvedValueOnce({});

      const mcpConfigs = {
        configs: {
          server1: { type: 'http' as const, url: 'https://server1.com' },
          server2: { type: 'http' as const, url: 'https://server2.com' },
        },
      };
      jest
        .spyOn(options.forestAdminClient.mcpServerConfigService, 'getConfiguration')
        .mockResolvedValueOnce(mcpConfigs);

      const tokens = { server1: 'Bearer token1', server2: 'Bearer token2' };
      const context = createMockContext({
        customProperties: {
          params: { route: 'ai-query' },
        },
        requestBody: { messages: [] },
        headers: { 'x-mcp-oauth-tokens': JSON.stringify(tokens) },
      });
      context.query = {};

      await (route as any).handleAiProxy(context);

      expect(mockRoute).toHaveBeenCalledWith(
        expect.objectContaining({
          mcpConfigs: {
            configs: {
              server1: {
                type: 'http',
                url: 'https://server1.com',
                headers: { Authorization: 'Bearer token1' },
              },
              server2: {
                type: 'http',
                url: 'https://server2.com',
                headers: { Authorization: 'Bearer token2' },
              },
            },
          },
        }),
      );
    });

    test('should throw BadRequestError when x-mcp-oauth-tokens header contains invalid JSON', async () => {
      const route = new AiProxyRoute(services, options, aiConfigurations);

      const context = createMockContext({
        customProperties: {
          params: { route: 'ai-query' },
        },
        requestBody: { messages: [] },
        headers: { 'x-mcp-oauth-tokens': '{ invalid json }' },
      });
      context.query = {};

      await expect((route as any).handleAiProxy(context)).rejects.toThrow(BadRequestError);
      await expect((route as any).handleAiProxy(context)).rejects.toThrow(
        'Invalid JSON in x-mcp-oauth-tokens header',
      );
    });

    describe('error handling', () => {
      test('should convert AINotConfiguredError to UnprocessableError', async () => {
        const route = new AiProxyRoute(services, options, aiConfigurations);
        mockRoute.mockRejectedValueOnce(new AINotConfiguredError());

        const context = createMockContext({
          customProperties: {
            params: { route: 'ai-query' },
            query: {},
          },
          requestBody: {},
        });

        await expect((route as any).handleAiProxy(context)).rejects.toThrow(UnprocessableError);
      });

      test('should convert AIToolNotFoundError to NotFoundError', async () => {
        const route = new AiProxyRoute(services, options, aiConfigurations);
        mockRoute.mockRejectedValueOnce(new AIToolNotFoundError('tool-name'));

        const context = createMockContext({
          customProperties: {
            params: { route: 'invoke-remote-tool' },
            query: { 'tool-name': 'unknown-tool' },
          },
          requestBody: {},
        });

        await expect((route as any).handleAiProxy(context)).rejects.toThrow(NotFoundError);
      });

      test('should convert AINotFoundError to NotFoundError', async () => {
        const route = new AiProxyRoute(services, options, aiConfigurations);
        mockRoute.mockRejectedValueOnce(new AINotFoundError('Resource not found'));

        const context = createMockContext({
          customProperties: {
            params: { route: 'ai-query' },
            query: {},
          },
          requestBody: {},
        });

        await expect((route as any).handleAiProxy(context)).rejects.toThrow(NotFoundError);
      });

      test('should convert AIBadRequestError to BadRequestError', async () => {
        const route = new AiProxyRoute(services, options, aiConfigurations);
        mockRoute.mockRejectedValueOnce(new AIBadRequestError('Invalid input'));

        const context = createMockContext({
          customProperties: {
            params: { route: 'ai-query' },
            query: {},
          },
          requestBody: {},
        });

        await expect((route as any).handleAiProxy(context)).rejects.toThrow(BadRequestError);
      });

      test('should convert AIUnprocessableError to UnprocessableError', async () => {
        const route = new AiProxyRoute(services, options, aiConfigurations);
        mockRoute.mockRejectedValueOnce(new AIUnprocessableError('Invalid input'));

        const context = createMockContext({
          customProperties: {
            params: { route: 'ai-query' },
            query: {},
          },
          requestBody: {},
        });

        await expect((route as any).handleAiProxy(context)).rejects.toThrow(UnprocessableError);
      });

      test('should convert generic AIError to UnprocessableError', async () => {
        const route = new AiProxyRoute(services, options, aiConfigurations);
        mockRoute.mockRejectedValueOnce(new AIError('Generic AI error'));

        const context = createMockContext({
          customProperties: {
            params: { route: 'ai-query' },
            query: {},
          },
          requestBody: {},
        });

        await expect((route as any).handleAiProxy(context)).rejects.toThrow(UnprocessableError);
      });

      test('should re-throw unknown errors unchanged', async () => {
        const route = new AiProxyRoute(services, options, aiConfigurations);
        const unknownError = new Error('Unknown error');
        mockRoute.mockRejectedValueOnce(unknownError);

        const context = createMockContext({
          customProperties: {
            params: { route: 'ai-query' },
          },
          requestBody: {},
        });
        context.query = {};

        const promise = (route as any).handleAiProxy(context);

        await expect(promise).rejects.toBe(unknownError);
        expect(unknownError).not.toBeInstanceOf(UnprocessableError);
      });
    });
  });
});
