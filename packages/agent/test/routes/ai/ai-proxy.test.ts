import type { AiRouter } from '@forestadmin/datasource-toolkit';

import {
  BadRequestError,
  NotFoundError,
  UnprocessableError,
} from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import AiProxyRoute from '../../../src/routes/ai/ai-proxy';
import { HttpCode, RouteType } from '../../../src/types';
import * as factories from '../../__factories__';

describe('AiProxyRoute', () => {
  const options = factories.forestAdminHttpDriverOptions.build();
  const services = factories.forestAdminHttpDriverServices.build();
  const router = factories.router.mockAllMethods().build();

  let mockRoute: jest.Mock;
  let aiRouter: AiRouter;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRoute = jest.fn();
    aiRouter = { route: mockRoute };
  });

  describe('constructor', () => {
    test('should have RouteType.PrivateRoute', () => {
      const route = new AiProxyRoute(services, options, aiRouter);

      expect(route.type).toBe(RouteType.PrivateRoute);
    });
  });

  describe('setupRoutes', () => {
    test('should register POST route at /_internal/ai-proxy/:route', () => {
      const route = new AiProxyRoute(services, options, aiRouter);
      route.setupRoutes(router);

      expect(router.post).toHaveBeenCalledWith('/_internal/ai-proxy/:route', expect.any(Function));
    });
  });

  describe('handleAiProxy', () => {
    test('should return 200 with response body on successful request', async () => {
      const route = new AiProxyRoute(services, options, aiRouter);
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

    test('should pass route, body, query, mcpServerConfigs and requestHeaders to router', async () => {
      const route = new AiProxyRoute(services, options, aiRouter);
      mockRoute.mockResolvedValueOnce({});

      const context = createMockContext({
        customProperties: {
          params: { route: 'ai-query' },
        },
        requestBody: { messages: [{ role: 'user', content: 'Hello' }] },
      });
      context.query = { 'ai-name': 'gpt4' };

      await (route as any).handleAiProxy(context);

      expect(mockRoute).toHaveBeenCalledWith({
        route: 'ai-query',
        body: { messages: [{ role: 'user', content: 'Hello' }] },
        query: { 'ai-name': 'gpt4' },
        mcpServerConfigs: undefined,
        requestHeaders: context.request.headers,
      });
    });

    test('should pass mcpServerConfigs from forestAdminClient to router', async () => {
      const route = new AiProxyRoute(services, options, aiRouter);
      mockRoute.mockResolvedValueOnce({});

      const mcpConfigs = {
        configs: {
          server1: { type: 'http' as const, url: 'https://server1.com' },
        },
      };
      jest
        .spyOn(options.forestAdminClient.mcpServerConfigService, 'getConfiguration')
        .mockResolvedValueOnce(mcpConfigs);

      const context = createMockContext({
        customProperties: {
          params: { route: 'ai-query' },
        },
        requestBody: { messages: [] },
      });
      context.query = {};

      await (route as any).handleAiProxy(context);

      expect(mockRoute).toHaveBeenCalledWith(
        expect.objectContaining({
          mcpServerConfigs: mcpConfigs,
          requestHeaders: context.request.headers,
        }),
      );
    });

    describe('error handling', () => {
      test('should convert error with status 422 to UnprocessableError with original message', async () => {
        const route = new AiProxyRoute(services, options, aiRouter);
        const error = new Error('AI is not configured') as Error & { status: number };
        error.status = 422;
        mockRoute.mockRejectedValueOnce(error);

        const context = createMockContext({
          customProperties: {
            params: { route: 'ai-query' },
            query: {},
          },
          requestBody: {},
        });

        await expect((route as any).handleAiProxy(context)).rejects.toMatchObject({
          name: 'UnprocessableError',
          message: 'AI is not configured',
        });
      });

      test('should convert error with status 404 to NotFoundError', async () => {
        const route = new AiProxyRoute(services, options, aiRouter);
        const error = new Error('Resource not found') as Error & { status: number };
        error.status = 404;
        mockRoute.mockRejectedValueOnce(error);

        const context = createMockContext({
          customProperties: {
            params: { route: 'ai-query' },
            query: {},
          },
          requestBody: {},
        });

        await expect((route as any).handleAiProxy(context)).rejects.toThrow(NotFoundError);
      });

      test('should convert error with status 400 to BadRequestError', async () => {
        const route = new AiProxyRoute(services, options, aiRouter);
        const error = new Error('Invalid input') as Error & { status: number };
        error.status = 400;
        mockRoute.mockRejectedValueOnce(error);

        const context = createMockContext({
          customProperties: {
            params: { route: 'ai-query' },
            query: {},
          },
          requestBody: {},
        });

        await expect((route as any).handleAiProxy(context)).rejects.toThrow(BadRequestError);
      });

      test('should convert error with other 4xx/5xx status to UnprocessableError', async () => {
        const route = new AiProxyRoute(services, options, aiRouter);
        const error = new Error('Server error') as Error & { status: number };
        error.status = 500;
        mockRoute.mockRejectedValueOnce(error);

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
        const route = new AiProxyRoute(services, options, aiRouter);
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

      test('should log AI proxy errors before converting them', async () => {
        const mockLogger = jest.fn();
        const optionsWithLogger = factories.forestAdminHttpDriverOptions.build({
          logger: mockLogger,
        });
        const route = new AiProxyRoute(services, optionsWithLogger, aiRouter);

        const error = new Error('Some AI error') as Error & { status: number };
        error.status = 422;
        mockRoute.mockRejectedValueOnce(error);

        const context = createMockContext({
          customProperties: {
            params: { route: 'ai-query' },
            query: {},
          },
          requestBody: {},
        });

        await expect((route as any).handleAiProxy(context)).rejects.toThrow(UnprocessableError);

        expect(mockLogger).toHaveBeenCalledWith(
          'Error',
          'AI proxy error: Some AI error',
          expect.any(Error),
        );
      });
    });
  });
});
