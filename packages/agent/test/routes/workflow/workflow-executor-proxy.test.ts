import { createMockContext } from '@shopify/jest-koa-mocks';
import http from 'http';

import WorkflowExecutorProxyRoute from '../../../src/routes/workflow/workflow-executor-proxy';
import { RouteType } from '../../../src/types';
import * as factories from '../../__factories__';

describe('WorkflowExecutorProxyRoute', () => {
  const services = factories.forestAdminHttpDriverServices.build();
  const router = factories.router.mockAllMethods().build();

  let executorServer: http.Server;
  let executorPort: number;
  let receivedHeaders: Record<string, string | string[] | undefined> = {};
  let receivedUrl: string | undefined;
  let receivedMethod: string | undefined;
  let receivedBody: string | undefined;

  // Start a real HTTP server to act as the workflow executor
  beforeAll(async () => {
    executorServer = http.createServer((req, res) => {
      receivedHeaders = { ...req.headers };
      receivedUrl = req.url;
      receivedMethod = req.method;
      const chunks: Uint8Array[] = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        receivedBody = Buffer.concat(chunks).toString('utf-8');

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('X-Forest-Executor-Version', '1.2.3');
        // Hop-by-hop response header — the proxy must drop it rather than forward it.
        res.setHeader('Transfer-Encoding', 'chunked');

        if (req.url?.includes('not-found')) {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Run not found or unavailable' }));
        } else if (req.method === 'GET' && req.url?.match(/^\/runs\/[\w-]+(\/.*)?(\?.*)?$/)) {
          res.writeHead(200);
          res.end(JSON.stringify({ steps: [{ stepId: 's1', status: 'success' }] }));
        } else if (req.method === 'POST' && req.url?.match(/^\/runs\/[\w-]+\/trigger(\?.*)?$/)) {
          const parsed = receivedBody ? JSON.parse(receivedBody) : {};
          res.writeHead(200);
          res.end(JSON.stringify({ triggered: true, received: parsed }));
        } else {
          // Echo for any other verb/sub-path so generic-forwarding tests can assert it arrived.
          res.writeHead(200);
          res.end(JSON.stringify({ method: req.method, url: req.url }));
        }
      });
    });

    await new Promise<void>((resolve, reject) => {
      executorServer.listen(0, () => {
        executorPort = (executorServer.address() as { port: number }).port;
        resolve();
      });
      executorServer.on('error', reject);
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      executorServer.close(err => (err ? reject(err) : resolve()));
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    receivedHeaders = {};
    receivedUrl = undefined;
    receivedMethod = undefined;
    receivedBody = undefined;
  });

  const buildOptions = (url: string) =>
    factories.forestAdminHttpDriverOptions.build({ workflowExecutorUrl: url });

  const buildRoute = (url: string) => new WorkflowExecutorProxyRoute(services, buildOptions(url));

  const callHandleProxy = (route: WorkflowExecutorProxyRoute, context: unknown) =>
    (route as unknown as { handleProxy: (ctx: unknown) => Promise<void> }).handleProxy(context);

  // Build a mock context for the catch-all route: `path` is the wildcard segment.
  const buildContext = (
    path: string,
    extra: Parameters<typeof createMockContext>[0] = {},
  ): ReturnType<typeof createMockContext> => {
    const context = createMockContext({ customProperties: { params: { path } }, ...extra });

    return context;
  };

  describe('constructor', () => {
    test('should have RouteType.PrivateRoute', () => {
      expect(buildRoute('http://localhost:4001').type).toBe(RouteType.PrivateRoute);
    });
  });

  describe('setupRoutes', () => {
    test('registers a single catch-all route for every verb', () => {
      buildRoute('http://localhost:4001').setupRoutes(router);

      expect(router.all).toHaveBeenCalledWith(
        '/_internal/workflow-executions/:path(.*)',
        expect.any(Function),
      );
      expect(router.get).not.toHaveBeenCalled();
      expect(router.post).not.toHaveBeenCalled();
      expect(router.patch).not.toHaveBeenCalled();
    });
  });

  describe('handleProxy — generic forwarding', () => {
    test('forwards a GET under /runs and returns the executor response', async () => {
      const route = buildRoute(`http://localhost:${executorPort}`);

      const context = buildContext('run-123');
      await callHandleProxy(route, context);

      expect(receivedMethod).toBe('GET');
      expect(receivedUrl).toBe('/runs/run-123');
      expect(context.response.status).toBe(200);
      expect(context.response.body).toEqual({ steps: [{ stepId: 's1', status: 'success' }] });
    });

    test('forwards a POST trigger with the raw body untouched (no reshaping)', async () => {
      const route = buildRoute(`http://localhost:${executorPort}`);

      const rawBody = '{"pendingData":{"answer":"yes"}}';
      const context = buildContext('run-456/trigger', { method: 'POST' });
      (context.request as unknown as { rawBody: string }).rawBody = rawBody;

      await callHandleProxy(route, context);

      expect(receivedMethod).toBe('POST');
      expect(receivedUrl).toBe('/runs/run-456/trigger');
      expect(receivedBody).toBe(rawBody);
      expect(context.response.body).toEqual({
        triggered: true,
        received: { pendingData: { answer: 'yes' } },
      });
    });

    test('forwards any verb and any future sub-path without a dedicated route', async () => {
      const route = buildRoute(`http://localhost:${executorPort}`);

      const context = buildContext('run-123/cancel', { method: 'DELETE' });
      await callHandleProxy(route, context);

      expect(receivedMethod).toBe('DELETE');
      expect(receivedUrl).toBe('/runs/run-123/cancel');
      expect(context.response.status).toBe(200);
    });

    test('forwards query params to the executor', async () => {
      const route = buildRoute(`http://localhost:${executorPort}`);

      const context = buildContext('run-123');
      Object.defineProperty(context, 'querystring', { value: 'foo=bar&page=2' });

      await callHandleProxy(route, context);

      expect(receivedUrl).toBe('/runs/run-123?foo=bar&page=2');
    });

    test('forwards the executor error status and body verbatim', async () => {
      const route = buildRoute(`http://localhost:${executorPort}`);

      const context = buildContext('not-found');
      await callHandleProxy(route, context);

      expect(context.response.status).toBe(404);
      expect(context.response.body).toEqual({ error: 'Run not found or unavailable' });
    });
  });

  describe('handleProxy — headers', () => {
    test('forwards all client headers except hop-by-hop / host / content-length', async () => {
      const route = buildRoute(`http://localhost:${executorPort}`);

      const context = buildContext('run-123', {
        headers: {
          authorization: 'Bearer jwt-token-value',
          cookie: 'forest_session_token=cookie-token',
          'x-custom-header': 'custom-value',
          // hop-by-hop (te) and a client-recomputed header (content-length) — must be dropped.
          // `te` is used rather than `connection` because Node's http client re-adds Connection itself.
          te: 'trailers',
          'content-length': '999',
        },
      });

      await callHandleProxy(route, context);

      expect(receivedHeaders.authorization).toBe('Bearer jwt-token-value');
      expect(receivedHeaders.cookie).toBe('forest_session_token=cookie-token');
      expect(receivedHeaders['x-custom-header']).toBe('custom-value');
      expect(receivedHeaders.te).toBeUndefined();
      expect(receivedHeaders['content-length']).not.toBe('999');
    });

    test('forwards executor response headers (e.g. the version gate) except hop-by-hop', async () => {
      const route = buildRoute(`http://localhost:${executorPort}`);

      const context = buildContext('run-123');
      await callHandleProxy(route, context);

      expect(context.response.get('X-Forest-Executor-Version')).toBe('1.2.3');
      // Hop-by-hop response header must not be forwarded.
      expect(context.response.get('Transfer-Encoding')).toBe('');
    });
  });

  describe('handleProxy — path traversal protection (security boundary)', () => {
    it.each([
      '..',
      '../mcp-oauth-credentials',
      'run-123/../../mcp-oauth-credentials',
      '%2e%2e/mcp-oauth-credentials',
      '/runs/run-123',
    ])('rejects %p and never forwards to the executor', async evilPath => {
      const route = buildRoute(`http://localhost:${executorPort}`);

      await expect(callHandleProxy(route, buildContext(evilPath))).rejects.toThrow();
      expect(receivedUrl).toBeUndefined();
    });
  });

  describe('handleProxy — executor unreachable', () => {
    test('rejects when the executor cannot be reached', async () => {
      const route = buildRoute('http://localhost:1');

      await expect(callHandleProxy(route, buildContext('run-789'))).rejects.toThrow();
    });
  });
});
