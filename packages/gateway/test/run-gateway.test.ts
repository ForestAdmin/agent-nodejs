import type { FakeForestServer } from './helpers/fake-forest-server';
import type { BFFHttpServer, Logger } from '@forestadmin/agent-bff';

import request from 'supertest';

import { runGateway, version } from '../src';
import startFakeForestServer from './helpers/fake-forest-server';
import {
  ALLOWED_ORIGIN,
  ENCRYPTION_KEY,
  gatewayEnv,
  getAvailablePort,
} from './helpers/gateway-env';

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
    gateway = await startGateway({ FOREST_GATEWAY_SERVICES: 'api', FOREST_AGENT_URL: undefined });
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
    const gateway = await startGateway({ FOREST_GATEWAY_API_TOKEN_ENCRYPTION_KEY: undefined });

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

  it('should warn about a legacy listener variable it reads', async () => {
    const port = await getAvailablePort();
    const gateway = await startGateway({ PORT: undefined, MCP_SERVER_PORT: String(port) });

    try {
      expect(gateway.logger).toHaveBeenCalledWith(
        'Warn',
        'MCP_SERVER_PORT is a legacy name: use PORT instead',
      );
      expect((await request(`http://127.0.0.1:${port}`).get('/health')).status).toBe(200);
    } finally {
      await gateway.server.stop();
    }
  });
});

describe('configuration', () => {
  async function withGateway(
    overrides: NodeJS.ProcessEnv,
    check: (gateway: RunningGateway) => Promise<void> | void,
  ): Promise<void> {
    const gateway = await startGateway(overrides);

    try {
      await check(gateway);
    } finally {
      await gateway.server.stop();
    }
  }

  it('should start without the API encryption key, saying API sign-in is off', async () => {
    await withGateway(
      { FOREST_GATEWAY_BASE_PATH: '/ai', FOREST_GATEWAY_API_TOKEN_ENCRYPTION_KEY: undefined },
      async gateway => {
        const response = await request(gateway.url).get('/health');

        expect(response.body.services.api.configured.oauth).toBe(false);
        expect(gateway.logger).toHaveBeenCalledWith(
          'Warn',
          'API sign-in (/ai/oauth/*?service=api) is off',
          { set: 'FOREST_GATEWAY_API_TOKEN_ENCRYPTION_KEY' },
        );
      },
    );
  });

  it('should start the API degraded without an agent url, naming FOREST_AGENT_URL', async () => {
    await withGateway(
      { FOREST_GATEWAY_SERVICES: 'api', FOREST_AGENT_URL: undefined },
      async gateway => {
        const response = await request(gateway.url).get('/health');

        expect(response.status).toBe(503);
        expect(response.body.services.api.status).toBe('degraded');
        expect(gateway.logger).toHaveBeenCalledWith(
          'Warn',
          'Missing required configuration; /health will report degraded',
          { missing: ['FOREST_AGENT_URL'] },
        );
      },
    );
  });

  it('should start from a forest-bff configuration, never logging the encryption key', async () => {
    await withGateway(
      {
        FOREST_GATEWAY_SERVICES: 'api',
        FOREST_AGENT_URL: undefined,
        FOREST_GATEWAY_API_TOKEN_ENCRYPTION_KEY: undefined,
        FOREST_GATEWAY_API_ALLOWED_ORIGINS: undefined,
        AGENT_URL: 'https://agent.example.com',
        BFF_PUBLIC_URL: 'https://corp.example/api',
        BFF_TOKEN_ENCRYPTION_KEY: ENCRYPTION_KEY,
        BFF_ALLOWED_ORIGINS: ALLOWED_ORIGIN,
      },
      async gateway => {
        const response = await request(gateway.url).get('/health');
        const warnings = gateway.logger.mock.calls
          .filter(([level]) => level === 'Warn')
          .map(([, message]) => message);

        expect(response.status).toBe(200);
        expect(warnings).toEqual([
          'AGENT_URL is a legacy name: use FOREST_AGENT_URL instead',
          'BFF_PUBLIC_URL is a legacy name: use FOREST_GATEWAY_API_PUBLIC_URL instead',
          'BFF_TOKEN_ENCRYPTION_KEY is a legacy name: use FOREST_GATEWAY_API_TOKEN_ENCRYPTION_KEY instead',
          'BFF_ALLOWED_ORIGINS is a legacy name: use FOREST_GATEWAY_API_ALLOWED_ORIGINS instead',
        ]);
        expect(JSON.stringify(gateway.logger.mock.calls)).not.toContain(ENCRYPTION_KEY);
      },
    );
  });

  it('should start from the hosted API configuration under its Gateway names', async () => {
    const port = await getAvailablePort();
    const logger = jest.fn();
    const server = await runGateway(
      {
        FOREST_GATEWAY_SERVICES: 'api',
        PORT: String(port),
        FOREST_AGENT_URL: 'https://agent.example.com',
        FOREST_SERVER_URL: forest.url,
        FOREST_APP_URL: 'https://app.development.forestadmin.com',
        FOREST_AUTH_SECRET: 'auth-secret',
        FOREST_ENV_SECRET: 'env-secret',
        FOREST_GATEWAY_API_PUBLIC_URL: 'https://agent-bff.development.forestadmin.com/api',
        FOREST_GATEWAY_API_TOKEN_ENCRYPTION_KEY: ENCRYPTION_KEY,
        FOREST_GATEWAY_API_ALLOWED_ORIGINS: 'http://localhost:5173',
        FOREST_GATEWAY_API_DEFAULT_TIMEZONE: 'Europe/Paris',
        FOREST_GATEWAY_API_OPENAPI_ENABLED: 'true',
      },
      logger as unknown as Logger,
    );

    try {
      const response = await request(`http://127.0.0.1:${port}`).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.services.api.configured).toEqual({
        oauth: true,
        ai: true,
        cors: true,
        openapi: true,
      });
      expect(logger.mock.calls.filter(([level]) => level === 'Warn')).toEqual([]);
    } finally {
      await server.stop();
    }
  });

  it('should drop an invalid allowed origin, warning naming its key', async () => {
    await withGateway(
      { FOREST_GATEWAY_API_ALLOWED_ORIGINS: `${ALLOWED_ORIGIN},not-an-origin` },
      async gateway => {
        const response = await request(gateway.url)
          .options('/oauth/token?service=api')
          .set('Origin', ALLOWED_ORIGIN)
          .set('Access-Control-Request-Method', 'POST');

        expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
        expect(gateway.logger).toHaveBeenCalledWith(
          'Warn',
          'Ignoring malformed FOREST_GATEWAY_API_ALLOWED_ORIGINS entries',
          { entries: ['not-an-origin'] },
        );
      },
    );
  });

  it('should fail on an invalid MCP token TTL even when the MCP would be degraded', async () => {
    await expect(
      startGateway({
        FOREST_GATEWAY_SERVICES: 'mcp',
        FOREST_AUTH_SECRET: undefined,
        FOREST_MCP_ACCESS_TOKEN_TTL_SECONDS: 'soon',
      }),
    ).rejects.toThrow('Invalid FOREST_MCP_ACCESS_TOKEN_TTL_SECONDS');
  });

  it('should not load the upload storage module when uploads are off', async () => {
    await withGateway(
      {
        FOREST_GATEWAY_SERVICES: 'mcp',
        FOREST_MCP_FILE_UPLOADS: 'false',
        FOREST_MCP_UPLOAD_STORAGE_MODULE: './does-not-exist',
      },
      async gateway => {
        const response = await request(gateway.url).get('/health');

        expect(response.body.services.mcp).toBe('ok');
      },
    );
  });

  it('should keep the MCP healthy without a gateway url, warning naming it', async () => {
    await withGateway({ FOREST_GATEWAY_SERVICES: 'mcp' }, async gateway => {
      const response = await request(gateway.url).get('/health');

      expect(response.body.services.mcp).toBe('ok');
      expect(gateway.logger).toHaveBeenCalledWith(
        'Warn',
        `FOREST_GATEWAY_URL is not set: MCP clients are told http://localhost:${gateway.port}`,
      );
    });
  });

  it('should fail once on an agent url with a query string, without its value', async () => {
    await expect(
      startGateway({ FOREST_AGENT_URL: 'https://agent.example.com?token=do-not-print-me' }),
    ).rejects.toThrow(
      'Invalid FOREST_AGENT_URL: expected an absolute http(s) URL with no query string or fragment.',
    );
  });
});
