import { NotFoundError } from '@forestadmin/datasource-toolkit';
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

        // Never responds → exercises the client-side request timeout.
        if (req.url?.includes('hang')) return;

        // Empty 204 — JSON.parse('') throws, so the proxy must fall back to a raw passthrough.
        if (req.url?.includes('no-content')) {
          res.writeHead(204);
          res.end();

          return;
        }

        // Non-JSON body — the proxy must forward it verbatim (future text/plain executor route).
        if (req.url?.includes('plain-text')) {
          res.setHeader('Content-Type', 'text/plain');
          res.writeHead(200);
          res.end('hello world');

          return;
        }

        res.setHeader('Content-Type', 'application/json');
        // Arbitrary executor response header — the proxy must forward it untouched.
        res.setHeader('X-Executor-Custom', 'passthrough-value');
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

  // Build a mock context for the catch-all route: `path` is the wildcard segment, forwarded
  // verbatim to the executor root (so callers address runs as `runs/<id>`).
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
    test('registers a single catch-all mount for every verb', () => {
      buildRoute('http://localhost:4001').setupRoutes(router);

      expect(router.all).toHaveBeenCalledTimes(1);
      expect(router.all).toHaveBeenCalledWith(
        '/_internal/executor/:path(.*)',
        expect.any(Function),
      );
      expect(router.get).not.toHaveBeenCalled();
      expect(router.post).not.toHaveBeenCalled();
      expect(router.patch).not.toHaveBeenCalled();
    });
  });

  describe('handleProxy — generic forwarding', () => {
    test('forwards the sub-path verbatim to the executor root (no namespace prefix added)', async () => {
      const route = buildRoute(`http://localhost:${executorPort}`);

      const context = buildContext('mcp-oauth-credentials', { method: 'POST' });
      await callHandleProxy(route, context);

      expect(receivedMethod).toBe('POST');
      expect(receivedUrl).toBe('/mcp-oauth-credentials');
      // The agent must NOT inject a /runs (or any) namespace prefix.
      expect(receivedUrl).not.toBe('/runs/mcp-oauth-credentials');
      expect(context.response.status).toBe(200);
    });

    test('forwards a dotted path segment (a single dot is not treated as traversal)', async () => {
      const route = buildRoute(`http://localhost:${executorPort}`);

      const context = buildContext('mcp.tools/v1');
      await callHandleProxy(route, context);

      expect(receivedUrl).toBe('/mcp.tools/v1');
      expect(context.response.status).toBe(200);
    });

    test('forwards a run GET (caller includes runs/) and returns the executor response', async () => {
      const route = buildRoute(`http://localhost:${executorPort}`);

      const context = buildContext('runs/run-123');
      await callHandleProxy(route, context);

      expect(receivedMethod).toBe('GET');
      expect(receivedUrl).toBe('/runs/run-123');
      expect(context.response.status).toBe(200);
      expect(context.response.body).toEqual({ steps: [{ stepId: 's1', status: 'success' }] });
    });

    test('forwards a POST trigger with the raw body untouched (no reshaping)', async () => {
      const route = buildRoute(`http://localhost:${executorPort}`);

      const rawBody = '{"pendingData":{"answer":"yes"}}';
      const context = buildContext('runs/run-456/trigger', { method: 'POST' });
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

      const context = buildContext('mcp-tools/list/refresh', { method: 'DELETE' });
      await callHandleProxy(route, context);

      expect(receivedMethod).toBe('DELETE');
      expect(receivedUrl).toBe('/mcp-tools/list/refresh');
      expect(context.response.status).toBe(200);
    });

    test('forwards query params to the executor', async () => {
      const route = buildRoute(`http://localhost:${executorPort}`);

      const context = buildContext('mcp-tools/list');
      Object.defineProperty(context, 'querystring', { value: 'server=github&page=2' });

      await callHandleProxy(route, context);

      expect(receivedUrl).toBe('/mcp-tools/list?server=github&page=2');
    });

    test('forwards the executor error status and body verbatim', async () => {
      const route = buildRoute(`http://localhost:${executorPort}`);

      const context = buildContext('runs/not-found');
      await callHandleProxy(route, context);

      expect(context.response.status).toBe(404);
      expect(context.response.body).toEqual({ error: 'Run not found or unavailable' });
    });

    test('forwards a bodyless non-GET cleanly (empty body, no hang)', async () => {
      const route = buildRoute(`http://localhost:${executorPort}`);

      // No rawBody set → body is undefined; the request must still complete.
      const context = buildContext('mcp-oauth-credentials', { method: 'DELETE' });
      await callHandleProxy(route, context);

      expect(receivedMethod).toBe('DELETE');
      expect(receivedUrl).toBe('/mcp-oauth-credentials');
      expect(receivedBody).toBe('');
      expect(context.response.status).toBe(200);
    });

    test('passes a non-JSON executor body through untouched', async () => {
      const route = buildRoute(`http://localhost:${executorPort}`);

      const context = buildContext('plain-text');
      await callHandleProxy(route, context);

      expect(context.response.status).toBe(200);
      expect(context.response.body).toBe('hello world');
    });

    test('passes a 204 empty executor response through without throwing', async () => {
      const route = buildRoute(`http://localhost:${executorPort}`);

      const context = buildContext('no-content', { method: 'DELETE' });
      await callHandleProxy(route, context);

      expect(context.response.status).toBe(204);
      expect(context.response.body).toBe('');
    });
  });

  describe('handleProxy — headers', () => {
    test('forwards all client headers except hop-by-hop / host / content-length', async () => {
      const route = buildRoute(`http://localhost:${executorPort}`);

      const context = buildContext('runs/run-123', {
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

    test('forwards executor response headers except hop-by-hop', async () => {
      const route = buildRoute(`http://localhost:${executorPort}`);

      const context = buildContext('runs/run-123');
      await callHandleProxy(route, context);

      expect(context.response.get('X-Executor-Custom')).toBe('passthrough-value');
      // Hop-by-hop response header must not be forwarded.
      expect(context.response.get('Transfer-Encoding')).toBe('');
    });
  });

  // SSRF guard: the wildcard is forwarded verbatim, so it must never resolve off the executor
  // origin. A leading control char passes the string checks but the URL parser strips it,
  // collapsing e.g. `\t//evil.com` into `//evil.com` → another host; the final-origin check
  // rejects these.
  describe('handleProxy — SSRF guard (cannot escape the executor origin)', () => {
    it.each([
      '..',
      '../mcp-oauth-credentials',
      'run-123/../../mcp-oauth-credentials',
      '%2e%2e/mcp-oauth-credentials',
      '/absolute-escape',
      '\t//evil.com',
      '\n//evil.com',
      '\r//evil.com',
    ])('rejects %j with NotFoundError and never forwards to the executor', async evilPath => {
      const route = buildRoute(`http://localhost:${executorPort}`);

      // NotFoundError → 404, so an SSRF attempt never surfaces as a 500.
      await expect(callHandleProxy(route, buildContext(evilPath))).rejects.toThrow(NotFoundError);
      expect(receivedUrl).toBeUndefined();
    });
  });

  describe('handleProxy — executor unreachable', () => {
    test('rejects when the executor cannot be reached', async () => {
      const route = buildRoute('http://localhost:1');

      await expect(callHandleProxy(route, buildContext('runs/run-789'))).rejects.toThrow();
    });

    test('rejects when the executor does not respond before the timeout', async () => {
      const route = buildRoute(`http://localhost:${executorPort}`);
      // Shrink the timeout so the never-responding 'hang' endpoint trips it quickly.
      (route as unknown as { requestTimeoutMs: number }).requestTimeoutMs = 50;

      await expect(callHandleProxy(route, buildContext('hang'))).rejects.toThrow(/timed out/);
    });
  });
});
