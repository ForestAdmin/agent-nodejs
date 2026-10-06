import type { GatewayOptions } from '../../src/types';

import express from 'express';
import Fastify from 'fastify';
import jsonwebtoken from 'jsonwebtoken';
import Koa from 'koa';
import { tmpdir } from 'os';
import path from 'path';
import request from 'supertest';

import Agent from '../../src/agent';
import { BFF_DEPRECATION_LINK } from '../../src/bff-routes';
import MockForestServer from '../__helper__/mock-forest-server';
import SearchDataSource from '../bff/fixtures/search-datasource';

const AUTH_SECRET = 'test-auth-secret-32-chars-min!!!';
const ENV_SECRET = '0'.repeat(64);
const TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
const BOOT_TIMEOUT_MS = 30_000;
const ALLOWED_ORIGIN = 'https://my-app.com';
const CLIENT_ID = 'test-client';
const REDIRECT_URI = 'http://localhost:3000/callback';
const CODE_VERIFIER = 'v'.repeat(43);
const CODE_CHALLENGE = 'c'.repeat(43);
const TIMEZONE = 'Europe/Paris';
const LIST_BODY = { projection: ['id', 'title'] };

let codeCount = 0;

const nextCode = () => {
  codeCount += 1;

  return `forest-code-${codeCount}`;
};

const COLLECTION_PERMISSIONS = {
  collection: {
    browseEnabled: true,
    readEnabled: true,
    editEnabled: true,
    addEnabled: true,
    deleteEnabled: true,
    exportEnabled: true,
  },
  actions: {},
};

const COLLECTIONS = [
  {
    name: 'books',
    fields: [
      { field: 'id', type: 'Number', isPrimaryKey: true },
      { field: 'title', type: 'String' },
      { field: 'authorId', type: 'Number' },
    ],
  },
];

function forestAccessToken(): string {
  return jsonwebtoken.sign({ meta: { renderingId: 1 } }, 'forest-server-secret', {
    expiresIn: '1h',
  });
}

function startMockForestServer(): MockForestServer {
  return new MockForestServer()
    .get('/liana/v4/permissions/environment', { collections: { books: COLLECTION_PERMISSIONS } })
    .post('/oauth/token', () => ({
      access_token: forestAccessToken(),
      refresh_token: 'forest-refresh-token',
    }))
    .get(/\/liana\/v2\/renderings\/\d+\/authorization/, {
      data: {
        id: '1',
        attributes: {
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'User',
          teams: ['admin'],
          role: 'admin',
          permission_level: 'admin',
          tags: [],
        },
      },
    })
    .setupDefaultRoutes({ envSecret: ENV_SECRET, collections: COLLECTIONS })
    .setupSuperagentMock()
    .setupFetchMock();
}

function buildAgent(name: string): Agent {
  return new Agent({
    authSecret: AUTH_SECRET,
    envSecret: ENV_SECRET,
    forestServerUrl: 'https://api.forestadmin.com',
    forestAppUrl: 'https://app.forestadmin.com',
    isProduction: false,
    schemaPath: path.join(tmpdir(), `.forestadmin-schema-gateway-${name}-${Date.now()}.json`),
    logger: () => undefined,
  }).addDataSource(async () => new SearchDataSource());
}

const API_OPTIONS = {
  allowedOrigins: [ALLOWED_ORIGIN],
  tokenEncryptionKey: TOKEN_ENCRYPTION_KEY,
  openapiEnabled: true,
};

async function startOn(agent: Agent, hostRoutes?: (app: express.Express) => void) {
  const app = express();
  agent.mountOnExpress(app);
  hostRoutes?.(app);
  await agent.start();

  return app;
}

function oauth(oauthBase: string, query = '') {
  const separator = query ? '&' : '?';

  return {
    authorize: (app: express.Express) =>
      request(app).get(`${oauthBase}/authorize${query}`).query({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        code_challenge: CODE_CHALLENGE,
        code_challenge_method: 'S256',
        state: 'state-1',
      }),
    token: (app: express.Express, body: Record<string, string>) =>
      request(app)
        .post(`${oauthBase}/token${query}`)
        .set('Content-Type', 'application/json')
        .send({ client_id: CLIENT_ID, ...body }),
    separator,
  };
}

async function signIn(app: express.Express, oauthBase: string, query = ''): Promise<string> {
  const response = await oauth(oauthBase, query).token(app, {
    grant_type: 'authorization_code',
    code: nextCode(),
    code_verifier: CODE_VERIFIER,
    redirect_uri: REDIRECT_URI,
  });

  return response.body.access_token;
}

function listBooks(app: express.Express, url: string, token: string) {
  return request(app)
    .post(url)
    .set('Authorization', `Bearer ${token}`)
    .set('X-Forest-Timezone', TIMEZONE)
    .send(LIST_BODY);
}

function preflight(app: express.Express, url: string) {
  return request(app)
    .options(url)
    .set('Origin', ALLOWED_ORIGIN)
    .set('Access-Control-Request-Method', 'POST');
}

function corsHeaders(headers: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(headers).filter(
      ([name]) => name.startsWith('access-control-') && name !== 'access-control-expose-headers',
    ),
  );
}

let mockForestServer: MockForestServer;
let legacy: Agent;
let legacyApp: express.Express;

beforeAll(async () => {
  mockForestServer = startMockForestServer();
  legacy = buildAgent('legacy').addBff(API_OPTIONS);
  legacyApp = await startOn(legacy);
}, BOOT_TIMEOUT_MS);

afterAll(async () => {
  await legacy?.stop();
  mockForestServer?.restore();
});

describe.each(['', '/ai'])('the embedded Gateway on basePath "%s"', basePath => {
  const apiBase = `${basePath}/api`;
  const apiOAuth = oauth(`${basePath}/oauth`, '?service=api');
  let agent: Agent;
  let app: express.Express;

  beforeAll(async () => {
    agent = buildAgent(`gateway${basePath.replace('/', '-')}`).addGateway({
      basePath,
      mcp: true,
      api: API_OPTIONS,
    });
    app = await startOn(agent, host => {
      host.post(`${apiBase}/oauth/token`, (_req, res) => {
        res.send('host');
      });
    });
  }, BOOT_TIMEOUT_MS);

  afterAll(async () => {
    await agent?.stop();
  });

  it('should answer the MCP and the API health', async () => {
    const mcp = await request(app).post(`${basePath}/mcp`);
    const health = await request(app).get(`${apiBase}/health?probe=1`);

    expect(mcp.status).toBe(401);
    expect(health.status).toBe(200);
    expect(health.body).toMatchObject({ status: 'ok', configured: { oauth: true, openapi: true } });
  });

  it('should list the records exactly as /bff does', async () => {
    const gatewayToken = await signIn(app, `${basePath}/oauth`, '?service=api');
    const legacyToken = await signIn(legacyApp, '/bff/oauth');

    const gateway = await listBooks(app, `${apiBase}/agent/v1/books/list`, gatewayToken);
    const legacyList = await listBooks(legacyApp, '/bff/agent/v1/books/list', legacyToken);

    expect(gateway.status).toBe(200);
    expect(gateway.body).toEqual(legacyList.body);
  });

  it('should redirect authorize to Forest, then exchange and refresh into API tokens', async () => {
    const authorize = await apiOAuth.authorize(app);
    const exchange = await apiOAuth.token(app, {
      grant_type: 'authorization_code',
      code: nextCode(),
      code_verifier: CODE_VERIFIER,
      redirect_uri: REDIRECT_URI,
    });
    const refresh = await apiOAuth.token(app, {
      grant_type: 'refresh_token',
      refresh_token: exchange.body.refresh_token,
    });

    expect(authorize.status).toBe(302);
    expect(authorize.headers.location).toMatch(
      /^https:\/\/app\.forestadmin\.com\/oauth\/authorize\?/,
    );
    expect(exchange.status).toBe(200);
    expect(jsonwebtoken.verify(exchange.body.access_token, AUTH_SECRET)).toMatchObject({
      type: 'bff_access',
    });
    expect(refresh.status).toBe(200);
    expect(refresh.body.refresh_token).not.toBe(exchange.body.refresh_token);
  });

  it('should answer the API and OAuth preflights with the API CORS, as /bff does', async () => {
    const api = await preflight(app, `${apiBase}/agent/v1/books/list`);
    const apiOAuthPreflight = await preflight(app, `${basePath}/oauth/token?service=api`);
    const legacyPreflight = await preflight(legacyApp, '/bff/agent/v1/books/list');

    expect(api.status).toBe(legacyPreflight.status);
    expect(corsHeaders(api.headers)).toEqual(corsHeaders(legacyPreflight.headers));
    expect(api.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(apiOAuthPreflight.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
  });

  it('should announce its own base on the docs page, and /bff its own', async () => {
    const page = await request(app).get(`${apiBase}/docs`);
    const legacyPage = await request(legacyApp).get('/bff/docs');

    expect(page.text).toContain(`${apiBase}/docs/redoc.standalone.js`);
    expect(legacyPage.text).toContain('/bff/docs/redoc.standalone.js');
  });

  it('should leave the unclaimed API paths and the agent routes to the host', async () => {
    expect((await request(app).post(`${apiBase}/oauth/token`)).text).toBe('host');
    expect((await request(app).get(`${apiBase}/unknown`)).status).toBe(404);
    expect((await request(app).get('/forest')).status).toBe(200);
  });

  it('should keep serving both services after a restart', async () => {
    await agent.restart();
    const token = await signIn(app, `${basePath}/oauth`, '?service=api');

    expect((await request(app).post(`${basePath}/mcp`)).status).toBe(401);
    expect((await listBooks(app, `${apiBase}/agent/v1/books/list`, token)).status).toBe(200);
  });
});

describe('the embedded Gateway on a basePath', () => {
  it(
    'should leave the root /api paths to the host',
    async () => {
      const agent = buildAgent('ai-only').addGateway({ basePath: '/ai', api: API_OPTIONS });
      const app = await startOn(agent);

      try {
        expect((await request(app).get('/ai/api/health')).status).toBe(200);
        expect((await request(app).get('/api/health')).status).toBe(404);
      } finally {
        await agent.stop();
      }
    },
    BOOT_TIMEOUT_MS,
  );
});

describe('the embedded Gateway without openapiEnabled', () => {
  it(
    'should leave a host /api/docs route to the host',
    async () => {
      const options: GatewayOptions = { api: { tokenEncryptionKey: TOKEN_ENCRYPTION_KEY } };
      const agent = buildAgent('no-docs').addGateway(options);
      const app = await startOn(agent, host => {
        host.get('/api/docs', (_req, res) => {
          res.send('host docs');
        });
      });

      try {
        expect((await request(app).get('/api/docs')).text).toBe('host docs');
      } finally {
        await agent.stop();
      }
    },
    BOOT_TIMEOUT_MS,
  );
});

describe('the embedded Gateway under a host sub-path', () => {
  it(
    'should keep the host prefix in the document and the docs links',
    async () => {
      const agent = buildAgent('sub-path').addGateway({ basePath: '/ai', api: API_OPTIONS });
      const mounted = express();
      agent.mountOnExpress(mounted);
      const hostApp = express();
      hostApp.use('/host', mounted);
      await agent.start();

      try {
        const token = await signIn(hostApp, '/host/ai/oauth', '?service=api');
        const document = await request(hostApp)
          .get('/host/ai/api/agent/openapi.json')
          .set('Authorization', `Bearer ${token}`);
        const page = await request(hostApp).get('/host/ai/api/docs');

        expect(document.body.servers[0].url).toBe('/host/ai/api');
        expect(page.text).toContain('/host/ai/api/agent/openapi.json');
        expect(page.text).toContain('/host/ai/api/docs/redoc.standalone.js');
      } finally {
        await agent.stop();
      }
    },
    BOOT_TIMEOUT_MS,
  );
});

describe('the deprecated /bff alias', () => {
  it('should mark its 404 and its preflight deprecated too', async () => {
    const notFound = await request(legacyApp).get('/bff/unknown');
    const preflightResponse = await preflight(legacyApp, '/bff/agent/v1/books/list');

    expect(notFound.status).toBe(404);
    [notFound, preflightResponse].forEach(response => {
      expect(response.headers.deprecation).toBe('@1791158400');
      expect(response.headers.link).toBe(`<${BFF_DEPRECATION_LINK}>; rel="deprecation"`);
    });
  });
});

describe('the embedded Gateway under a Koa host sub-path', () => {
  it(
    'should keep the host prefix in the docs links',
    async () => {
      const agent = buildAgent('koa-sub-path').addGateway({ basePath: '/ai', api: API_OPTIONS });
      const hostApp = new Koa();
      hostApp.use(async (ctx, next) => {
        if (ctx.path.startsWith('/host/')) ctx.url = ctx.url.slice('/host'.length);
        await next();
      });
      agent.mountOnKoa(hostApp);
      await agent.start();

      try {
        const page = await request(hostApp.callback()).get('/host/ai/api/docs');

        expect(page.text).toContain('/host/ai/api/docs/redoc.standalone.js');
      } finally {
        await agent.stop();
      }
    },
    BOOT_TIMEOUT_MS,
  );
});

describe.each(['', '/ai'])('the embedded Gateway smoke on basePath "%s"', basePath => {
  async function statusesOn(baseUrl: string) {
    const mcp = await request(baseUrl).post(`${basePath}/mcp`);
    const health = await request(baseUrl).get(`${basePath}/api/health`);

    return [mcp.status, health.status];
  }

  it(
    'should serve both services on mountOnFastify',
    async () => {
      const agent = buildAgent(`fastify${basePath.replace('/', '-')}`).addGateway({
        basePath,
        mcp: true,
        api: API_OPTIONS,
      });
      const app = Fastify();
      agent.mountOnFastify(app);
      await app.listen(0, '127.0.0.1');
      await agent.start();

      try {
        const { port } = app.server.address() as { port: number };
        expect(await statusesOn(`http://127.0.0.1:${port}`)).toEqual([401, 200]);
      } finally {
        await agent.stop();
        await app.close();
      }
    },
    BOOT_TIMEOUT_MS,
  );

  it(
    'should serve both services on mountOnStandaloneServer',
    async () => {
      const agent = buildAgent(`standalone${basePath.replace('/', '-')}`).addGateway({
        basePath,
        mcp: true,
        api: API_OPTIONS,
      });
      agent.mountOnStandaloneServer(0, '127.0.0.1');
      await agent.start();

      try {
        expect(await statusesOn(`http://127.0.0.1:${agent.standaloneServerPort}`)).toEqual([
          401, 200,
        ]);
      } finally {
        await agent.stop();
      }
    },
    BOOT_TIMEOUT_MS,
  );
});
