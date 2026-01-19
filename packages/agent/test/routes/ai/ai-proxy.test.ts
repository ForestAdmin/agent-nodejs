// eslint-disable-next-line import/no-extraneous-dependencies
import {
  AIError,
  AINotConfiguredError,
  AIToolNotFoundError,
  AIUnprocessableError,
} from '@forestadmin/ai-proxy';
import { UnprocessableError } from '@forestadmin/datasource-toolkit';
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

    test('should pass route, body, query and mcpConfigs to router', async () => {
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

      test('should convert AIToolNotFoundError to UnprocessableError', async () => {
        const route = new AiProxyRoute(services, options, aiConfigurations);
        mockRoute.mockRejectedValueOnce(new AIToolNotFoundError('tool-name'));

        const context = createMockContext({
          customProperties: {
            params: { route: 'invoke-remote-tool' },
            query: { 'tool-name': 'unknown-tool' },
          },
          requestBody: {},
        });

        await expect((route as any).handleAiProxy(context)).rejects.toThrow(UnprocessableError);
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
        mockRoute.mockRejectedValue(unknownError);

        const context = createMockContext({
          customProperties: {
            params: { route: 'ai-query' },
          },
          requestBody: {},
        });
        context.query = {};

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const promise = (route as any).handleAiProxy(context);

        await expect(promise).rejects.toBe(unknownError);
        expect(unknownError).not.toBeInstanceOf(UnprocessableError);
      });
    });
  });
});
