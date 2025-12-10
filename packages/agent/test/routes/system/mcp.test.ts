import { createMockContext } from '@shopify/jest-koa-mocks';

import McpRoute from '../../../src/routes/system/mcp';
import { HttpCallback, RouteType } from '../../../src/types';
import * as factories from '../../__factories__';

describe('McpRoute', () => {
  const services = factories.forestAdminHttpDriverServices.build();
  const router = factories.router.mockAllMethods().build();

  beforeEach(() => {
    (router.all as jest.Mock).mockClear();
  });

  describe('when MCP server is disabled', () => {
    const options = factories.forestAdminHttpDriverOptions.build({
      mcpServer: { enabled: false },
    });

    test('should not register any routes', () => {
      const mcpRoute = new McpRoute(services, options);
      mcpRoute.setupRoutes(router);

      expect(router.all).not.toHaveBeenCalled();
    });
  });

  describe('when MCP server is enabled', () => {
    const options = factories.forestAdminHttpDriverOptions.build({
      mcpServer: { enabled: true },
    });

    test('should have PublicRoute type', () => {
      const mcpRoute = new McpRoute(services, options);

      expect(mcpRoute.type).toEqual(RouteType.PublicRoute);
    });

    test('should register MCP routes without affecting forest routes', () => {
      const mcpRoute = new McpRoute(services, options);
      mcpRoute.setupRoutes(router);

      // All MCP-related routes including .well-known
      expect(router.all).toHaveBeenCalledTimes(4);
      expect(router.all).toHaveBeenCalledWith('/.well-known/(.*)', expect.any(Function));
      expect(router.all).toHaveBeenCalledWith('/oauth/(.*)', expect.any(Function));
      expect(router.all).toHaveBeenCalledWith('/mcp', expect.any(Function));
      expect(router.all).toHaveBeenCalledWith('/mcp/(.*)', expect.any(Function));

      // Verify that /forest routes are NOT intercepted by MCP routes
      // MCP routes should only handle: /.well-known/*, /oauth/*, /mcp, /mcp/*
      // Forest routes like /forest, /forest/*, /_actions, etc. should NOT be handled
      const registeredRoutes = (router.all as jest.Mock).mock.calls.map(call => call[0]);
      expect(registeredRoutes).not.toContain('/forest');
      expect(registeredRoutes).not.toContain('/forest/(.*)');
      expect(registeredRoutes).not.toContain('/_actions');
      expect(registeredRoutes).not.toContain('/_actions/(.*)');
    });

    describe('handleRequest', () => {
      test('should return 503 when http callback is not set', async () => {
        const mcpRoute = new McpRoute(services, options);
        const context = createMockContext({
          url: '/mcp',
          method: 'POST',
        });

        await mcpRoute['handleRequest'](context);

        expect(context.status).toEqual(503);
        expect(context.body).toEqual({ error: 'MCP server not initialized' });
      });

      test('should call http callback with enhanced request when set', async () => {
        const mcpRoute = new McpRoute(services, options);
        let capturedReq: any = null;
        const mockHttpCallback: HttpCallback = jest.fn((req, res) => {
          capturedReq = req;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        });

        mcpRoute.setHttpCallback(mockHttpCallback);

        const context = createMockContext({
          url: '/mcp',
          method: 'POST',
          requestBody: { test: 'data' },
        });
        context.request.body = { test: 'data' };

        // Mock the res.once method since createMockContext doesn't provide it
        (context.res as any).once = jest.fn((event: string, callback: () => void) => {
          // Immediately call finish callback to simulate response completion
          if (event === 'finish') {
            setImmediate(callback);
          }

          return context.res;
        });

        await mcpRoute['handleRequest'](context);

        expect(mockHttpCallback).toHaveBeenCalled();
        // Check that the enhanced request has the expected properties
        expect(capturedReq.body).toEqual({ test: 'data' });
        expect(capturedReq._body).toBe(true);
        expect(capturedReq._parsedBody).toBe(true);
        expect(typeof capturedReq.get).toBe('function');
      });

      test('should return 404 when http callback calls next', async () => {
        const mcpRoute = new McpRoute(services, options);
        const mockHttpCallback: HttpCallback = jest.fn((_req, _res, next) => {
          // Call next without sending a response
          if (next) next();
        });

        mcpRoute.setHttpCallback(mockHttpCallback);

        const context = createMockContext({
          url: '/unknown',
          method: 'GET',
        });

        await mcpRoute['handleRequest'](context);

        expect(context.status).toEqual(404);
        expect(context.body).toEqual({ error: 'Not found' });
      });
    });

    describe('forest routes coexistence', () => {
      test('should not interfere with /forest routes when http callback calls next', async () => {
        const mcpRoute = new McpRoute(services, options);
        // Mock an MCP callback that calls next() for non-MCP routes
        const mockHttpCallback: HttpCallback = jest.fn((_req, _res, next) => {
          // Call next - simulating that this is not an MCP route
          if (next) next();
        });

        mcpRoute.setHttpCallback(mockHttpCallback);

        // Test various forest-like URLs
        const forestUrls = [
          '/forest/users',
          '/forest/users/1',
          '/forest/_actions/users/custom-action',
          '/forest/stats/users',
        ];

        for (const url of forestUrls) {
          const context = createMockContext({
            url,
            method: 'GET',
          });

          // eslint-disable-next-line no-await-in-loop
          await mcpRoute['handleRequest'](context);

          // Should return 404 (because the callback called next, not because it was blocked)
          // This verifies the route doesn't throw an error or behave unexpectedly
          expect(context.status).toEqual(404);
          expect(context.body).toEqual({ error: 'Not found' });
        }
      });

      test('should handle MCP routes while allowing forest routes to pass through', async () => {
        const mcpRoute = new McpRoute(services, options);
        const handledUrls: string[] = [];

        // Mock callback that records which URLs it receives
        const mockHttpCallback: HttpCallback = jest.fn((req, res) => {
          // The enhanced req from McpRoute has the path property set from ctx.path
          const path = (req as any).path || req.url || '/';
          handledUrls.push(path);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ handled: true }));
        });

        mcpRoute.setHttpCallback(mockHttpCallback);

        // Test MCP routes are handled
        const mcpUrls = ['/mcp', '/.well-known/oauth-authorization-server', '/oauth/authorize'];

        for (const url of mcpUrls) {
          const context = createMockContext({
            url,
            method: 'POST',
          });
          (context.res as any).once = jest.fn((event: string, callback: () => void) => {
            if (event === 'finish') setImmediate(callback);

            return context.res;
          });

          // eslint-disable-next-line no-await-in-loop
          await mcpRoute['handleRequest'](context);
        }

        // All MCP URLs should have been handled
        expect(handledUrls).toContain('/mcp');
        expect(handledUrls).toContain('/.well-known/oauth-authorization-server');
        expect(handledUrls).toContain('/oauth/authorize');
      });
    });
  });
});
