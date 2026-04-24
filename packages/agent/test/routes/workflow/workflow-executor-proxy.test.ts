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

  // Start a real HTTP server to act as the workflow executor
  beforeAll(async () => {
    executorServer = http.createServer((req, res) => {
      receivedHeaders = { ...req.headers };
      const chunks: Uint8Array[] = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');

        res.setHeader('Content-Type', 'application/json');

        if (req.url?.includes('not-found')) {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Run not found or unavailable' }));
        } else if (req.method === 'GET' && req.url?.match(/^\/runs\/[\w-]+$/)) {
          res.writeHead(200);
          res.end(JSON.stringify({ steps: [{ stepId: 's1', status: 'success' }] }));
        } else if (req.method === 'POST' && req.url?.match(/^\/runs\/[\w-]+\/trigger$/)) {
          const parsed = body ? JSON.parse(body) : {};
          res.writeHead(200);
          res.end(JSON.stringify({ triggered: true, received: parsed }));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Not found' }));
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
  });

  const buildOptions = (url: string) =>
    factories.forestAdminHttpDriverOptions.build({ workflowExecutorUrl: url });

  describe('constructor', () => {
    test('should have RouteType.PrivateRoute', () => {
      const route = new WorkflowExecutorProxyRoute(services, buildOptions('http://localhost:4001'));

      expect(route.type).toBe(RouteType.PrivateRoute);
    });
  });

  describe('setupRoutes', () => {
    test('registers GET and POST routes (PATCH pending-data retired)', () => {
      const route = new WorkflowExecutorProxyRoute(services, buildOptions('http://localhost:4001'));
      route.setupRoutes(router);

      expect(router.get).toHaveBeenCalledWith(
        '/_internal/workflow-executions/:runId',
        expect.any(Function),
      );
      expect(router.post).toHaveBeenCalledWith(
        '/_internal/workflow-executions/:runId/trigger',
        expect.any(Function),
      );
      expect(router.patch).not.toHaveBeenCalled();
    });
  });

  describe('handleProxy', () => {
    test('should forward GET /runs/:runId and return executor response', async () => {
      const route = new WorkflowExecutorProxyRoute(
        services,
        buildOptions(`http://localhost:${executorPort}`),
      );

      const context = createMockContext({
        customProperties: { params: { runId: 'run-123' } },
      });
      Object.defineProperty(context, 'path', {
        value: '/_internal/workflow-executions/run-123',
      });

      await (route as unknown as { handleProxy: (ctx: unknown) => Promise<void> }).handleProxy(
        context,
      );

      expect(context.response.status).toBe(200);
      expect(context.response.body).toEqual({
        steps: [{ stepId: 's1', status: 'success' }],
      });
    });

    test('should forward POST /runs/:runId/trigger and pass body', async () => {
      const route = new WorkflowExecutorProxyRoute(
        services,
        buildOptions(`http://localhost:${executorPort}`),
      );

      const context = createMockContext({
        method: 'POST',
        customProperties: { params: { runId: 'run-456' } },
        requestBody: { pendingData: { answer: 'yes' } },
      });
      Object.defineProperty(context, 'path', {
        value: '/_internal/workflow-executions/run-456/trigger',
      });

      await (route as unknown as { handleProxy: (ctx: unknown) => Promise<void> }).handleProxy(
        context,
      );

      expect(context.response.status).toBe(200);
      expect(context.response.body).toEqual({
        triggered: true,
        received: { pendingData: { answer: 'yes' } },
      });
    });

    test('should forward error status from executor', async () => {
      const route = new WorkflowExecutorProxyRoute(
        services,
        buildOptions(`http://localhost:${executorPort}`),
      );

      const context = createMockContext({
        customProperties: { params: { runId: 'not-found' } },
      });
      Object.defineProperty(context, 'path', {
        value: '/_internal/workflow-executions/not-found',
      });

      await (route as unknown as { handleProxy: (ctx: unknown) => Promise<void> }).handleProxy(
        context,
      );

      expect(context.response.status).toBe(404);
      expect(context.response.body).toEqual({ error: 'Run not found or unavailable' });
    });

    test('should forward Authorization and Cookie headers to the executor', async () => {
      const route = new WorkflowExecutorProxyRoute(
        services,
        buildOptions(`http://localhost:${executorPort}`),
      );

      const context = createMockContext({
        customProperties: { params: { runId: 'run-123' } },
        headers: {
          authorization: 'Bearer jwt-token-value',
          cookie: 'forest_session_token=cookie-token',
        },
      });
      Object.defineProperty(context, 'path', {
        value: '/_internal/workflow-executions/run-123',
      });

      await (route as unknown as { handleProxy: (ctx: unknown) => Promise<void> }).handleProxy(
        context,
      );

      expect(receivedHeaders.authorization).toBe('Bearer jwt-token-value');
      expect(receivedHeaders.cookie).toBe('forest_session_token=cookie-token');
    });

    test('should not add empty auth headers when the request has none', async () => {
      const route = new WorkflowExecutorProxyRoute(
        services,
        buildOptions(`http://localhost:${executorPort}`),
      );

      const context = createMockContext({
        customProperties: { params: { runId: 'run-123' } },
      });
      Object.defineProperty(context, 'path', {
        value: '/_internal/workflow-executions/run-123',
      });

      await (route as unknown as { handleProxy: (ctx: unknown) => Promise<void> }).handleProxy(
        context,
      );

      expect(receivedHeaders.authorization).toBeUndefined();
      expect(receivedHeaders.cookie).toBeUndefined();
    });

    test('should reject when executor is unreachable', async () => {
      const route = new WorkflowExecutorProxyRoute(services, buildOptions('http://localhost:1'));

      const context = createMockContext({
        customProperties: { params: { runId: 'run-789' } },
      });
      Object.defineProperty(context, 'path', {
        value: '/_internal/workflow-executions/run-789',
      });

      await expect(
        (route as unknown as { handleProxy: (ctx: unknown) => Promise<void> }).handleProxy(context),
      ).rejects.toThrow();
    });
  });
});
