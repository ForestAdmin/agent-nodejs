import type { FakeForestServer } from './helpers/fake-forest-server';
import type { BFFHttpServer, Logger } from '@forestadmin/agent-bff';

import request from 'supertest';

import { runGateway, version } from '../src';
import startFakeForestServer from './helpers/fake-forest-server';
import { ALLOWED_ORIGIN, gatewayEnv, getAvailablePort } from './helpers/gateway-env';

const SIGNALS: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

interface RunningGateway {
  port: number;
  url: string;
  server: BFFHttpServer;
  logger: jest.Mock;
}

let forest: FakeForestServer;
let listenersBefore: Map<NodeJS.Signals, Set<(...args: unknown[]) => void>>;

async function startGateway(overrides: NodeJS.ProcessEnv = {}): Promise<RunningGateway> {
  const port = await getAvailablePort();
  const logger = jest.fn();
  const server = await runGateway(
    gatewayEnv(forest.url, port, overrides),
    logger as unknown as Logger,
  );

  return { port, url: `http://127.0.0.1:${port}`, server, logger };
}

beforeAll(async () => {
  forest = await startFakeForestServer();
  listenersBefore = new Map(
    SIGNALS.map(signal => [
      signal,
      new Set(process.listeners(signal) as ((...args: unknown[]) => void)[]),
    ]),
  );
});

afterAll(async () => {
  for (const signal of SIGNALS) {
    for (const listener of process.listeners(signal)) {
      if (!listenersBefore.get(signal)?.has(listener as (...args: unknown[]) => void)) {
        process.removeListener(signal, listener);
      }
    }
  }

  await forest.close();
});

describe.each(['', '/ai'])('both services under base path "%s"', P => {
  let gateway: RunningGateway;

  beforeAll(async () => {
    gateway = await startGateway({ FOREST_GATEWAY_BASE_PATH: P });
  });

  afterAll(async () => {
    await gateway.server.stop();
  });

  it('should serve the MCP endpoint', async () => {
    const response = await request(gateway.url).post(`${P}/mcp`).send({});

    expect(response.status).toBe(401);
    expect(response.headers['x-powered-by']).toBe('Express');
  });

  it('should serve the API agent routes under /api', async () => {
    const response = await request(gateway.url).get(`${P}/api/agent/v1/books`);

    expect(response.status).toBe(401);
    expect(response.headers['x-forest-bff-version']).toBeDefined();
  });

  it('should let the MCP serve the token endpoint when no service is given', async () => {
    const response = await request(gateway.url)
      .post(`${P}/oauth/token`)
      .type('form')
      .send({ grant_type: 'authorization_code' });

    expect(response.status).toBe(400);
    expect(response.headers['x-powered-by']).toBe('Express');
    expect(response.headers['x-forest-bff-version']).toBeUndefined();
    expect(response.body.error).toBe('invalid_request');
  });

  it('should let the API serve the token endpoint with service=api', async () => {
    const response = await request(gateway.url)
      .post(`${P}/oauth/token?service=api`)
      .type('form')
      .send({ grant_type: 'authorization_code' });

    expect(response.status).toBe(400);
    expect(response.headers['x-forest-bff-version']).toBeDefined();
  });

  it("should answer the API's CORS preflight on its token endpoint", async () => {
    const response = await request(gateway.url)
      .options(`${P}/oauth/token?service=api`)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'POST');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(response.headers['x-forest-bff-version']).toBeDefined();
  });

  it('should serve the MCP discovery metadata under the base path suffix', async () => {
    const response = await request(gateway.url).get(`/.well-known/oauth-authorization-server${P}`);

    expect(response.status).toBe(200);
    expect(response.body.token_endpoint).toBe(`http://localhost:${gateway.port}${P}/oauth/token`);
  });

  it('should not serve the API token endpoint under /api', async () => {
    const response = await request(gateway.url).post(`${P}/api/oauth/token`);

    expect(response.status).toBe(404);
  });

  it('should not alias the API agent routes at the root', async () => {
    const response = await request(gateway.url).get('/agent/v1/books');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: 'not_found',
      error_description: 'No Gateway service serves this path.',
    });
  });

  it('should serve the API health, docs and docs bundle', async () => {
    const [health, docs, bundle] = await Promise.all([
      request(gateway.url).get(`${P}/api/health`),
      request(gateway.url).get(`${P}/api/docs`),
      request(gateway.url).get(`${P}/api/docs/redoc.standalone.js`),
    ]);

    expect([health.status, docs.status, bundle.status]).toEqual([200, 200, 200]);
    expect(docs.text).toContain(`${P}/api/docs/redoc.standalone.js`);
  });

  it('should point the docs page at the OpenAPI document under /api', async () => {
    const response = await request(gateway.url).get(`${P}/api/docs`);

    expect(response.text).toContain(`${P}/api/agent/openapi.json`);
  });

  it('should report both services healthy on the root /health', async () => {
    const response = await request(gateway.url).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      healthy: true,
      version,
      services: {
        mcp: 'ok',
        api: { status: 'ok', configured: { oauth: true, ai: true, cors: true, openapi: true } },
      },
    });
  });

  it.each([
    ['the MCP', 'post', `${P}/oauth/token`],
    ['the API', 'get', `${P}/api/health`],
    ['the root health', 'get', '/health'],
    ['the fallback', 'get', '/nowhere'],
  ])('should send the gateway version on %s', async (_, method, path) => {
    const response = await request(gateway.url)[method](path);

    expect(response.headers['x-forest-gateway-version']).toBe(version);
  });
});

describe('base path /ai', () => {
  let gateway: RunningGateway;

  beforeAll(async () => {
    gateway = await startGateway({ FOREST_GATEWAY_BASE_PATH: '/ai' });
  });

  afterAll(async () => {
    await gateway.server.stop();
  });

  it.each([
    ['post', '/mcp'],
    ['get', '/api/agent/v1/books'],
    ['get', '/api/health'],
  ])('should answer 404 on %s %s at the root', async (method, path) => {
    const response = await request(gateway.url)[method](path);

    expect(response.status).toBe(404);
  });
});

describe('only the API', () => {
  let gateway: RunningGateway;

  beforeAll(async () => {
    gateway = await startGateway({ FOREST_GATEWAY_SERVICES: 'api' });
  });

  afterAll(async () => {
    await gateway.server.stop();
  });

  it('should fall back to the gateway 404 on the token endpoint without service', async () => {
    const response = await request(gateway.url).post('/oauth/token');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: 'not_found',
      error_description: 'No Gateway service serves this path.',
    });
  });

  it('should report the MCP disabled on the root /health', async () => {
    const response = await request(gateway.url).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.services.mcp).toBe('disabled');
  });
});

describe('only the MCP', () => {
  let gateway: RunningGateway;

  beforeAll(async () => {
    gateway = await startGateway({ FOREST_GATEWAY_SERVICES: 'mcp' });
  });

  afterAll(async () => {
    await gateway.server.stop();
  });

  it('should answer 404 on the API token endpoint', async () => {
    const response = await request(gateway.url).post('/oauth/token?service=api');

    expect(response.status).toBe(404);
  });

  it('should report the API disabled on the root /health', async () => {
    const response = await request(gateway.url).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.services).toEqual({ mcp: 'ok', api: 'disabled' });
  });

  it('should name the listener Forest Gateway in its logs', () => {
    expect(gateway.logger).toHaveBeenCalledWith('Info', 'Forest Gateway started', {
      port: expect.any(Number),
    });
    expect(gateway.logger).not.toHaveBeenCalledWith(
      'Info',
      'Forest BFF started',
      expect.anything(),
    );
  });
});

describe('an MCP missing a secret', () => {
  describe.each(['FOREST_AUTH_SECRET', 'FOREST_ENV_SECRET'])('without %s', missing => {
    let gateway: RunningGateway;

    beforeAll(async () => {
      gateway = await startGateway({ [missing]: undefined });
    });

    afterAll(async () => {
      await gateway.server.stop();
    });

    it.each([
      ['post', '/mcp'],
      ['post', '/oauth/token'],
      ['get', '/.well-known/oauth-authorization-server'],
    ])('should answer 503 on %s %s', async (method, path) => {
      const response = await request(gateway.url)[method](path);

      expect(response.status).toBe(503);
      expect(response.body.error).toBe('service_unavailable');
    });

    it('should report the MCP degraded on the root /health', async () => {
      const response = await request(gateway.url).get('/health');

      expect(response.status).toBe(503);
      expect(response.body.healthy).toBe(false);
      expect(response.body.services.mcp).toBe('degraded');
    });
  });

  it('should report 503 with only the MCP enabled', async () => {
    const gateway = await startGateway({
      FOREST_GATEWAY_SERVICES: 'mcp',
      FOREST_AUTH_SECRET: undefined,
    });

    try {
      const response = await request(gateway.url).get('/health');

      expect(response.status).toBe(503);
      expect(response.body.services).toEqual({ mcp: 'degraded', api: 'disabled' });
    } finally {
      await gateway.server.stop();
    }
  });
});

describe('a degraded API', () => {
  let gateway: RunningGateway;

  beforeAll(async () => {
    gateway = await startGateway({ FOREST_GATEWAY_SERVICES: 'api', AGENT_URL: undefined });
  });

  afterAll(async () => {
    await gateway.server.stop();
  });

  it('should report the same API state on /api/health and the root /health', async () => {
    const [apiHealth, rootHealth] = await Promise.all([
      request(gateway.url).get('/api/health'),
      request(gateway.url).get('/health'),
    ]);

    expect(apiHealth.status).toBe(503);
    expect(rootHealth.status).toBe(503);
    expect(rootHealth.body.services.api).toEqual({
      status: apiHealth.body.status,
      configured: apiHealth.body.configured,
    });
    expect(apiHealth.body.status).toBe('degraded');
  });
});

describe('an unreachable Forest server', () => {
  let gateway: RunningGateway;

  beforeAll(async () => {
    const closedPort = await getAvailablePort();
    gateway = await startGateway({ FOREST_SERVER_URL: `http://127.0.0.1:${closedPort}` });
  });

  afterAll(async () => {
    await gateway.server.stop();
  });

  it('should still report healthy on the root /health', async () => {
    const response = await request(gateway.url).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.healthy).toBe(true);
  });
});

describe('boot log', () => {
  it('should announce the API OAuth route when the encryption key is set', async () => {
    const gateway = await startGateway({ FOREST_GATEWAY_BASE_PATH: '/ai' });

    try {
      expect(gateway.logger).toHaveBeenCalledWith(
        'Info',
        'API service on /ai/api/agent/*',
        expect.objectContaining({ oauth: '/ai/oauth/*?service=api' }),
      );
    } finally {
      await gateway.server.stop();
    }
  });

  it('should say the API OAuth is off without the encryption key', async () => {
    const gateway = await startGateway({ BFF_TOKEN_ENCRYPTION_KEY: undefined });

    try {
      expect(gateway.logger).toHaveBeenCalledWith(
        'Info',
        'API service on /api/agent/*',
        expect.objectContaining({ oauth: 'API OAuth off' }),
      );
    } finally {
      await gateway.server.stop();
    }
  });

  it('should warn about a legacy listener variable it ignores', async () => {
    const gateway = await startGateway({ MCP_SERVER_PORT: '1234' });

    try {
      expect(gateway.logger).toHaveBeenCalledWith(
        'Warn',
        'MCP_SERVER_PORT is ignored by forest-gateway: use PORT instead',
      );
    } finally {
      await gateway.server.stop();
    }
  });
});
