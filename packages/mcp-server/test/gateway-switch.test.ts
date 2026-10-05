import type { GatewayHandler } from '../src/gateway-switch';
import type { HttpCallback } from '../src/server';
import type { IncomingMessage, ServerResponse } from 'http';

import * as http from 'http';
import request from 'supertest';

import createMockForestServerClient from './helpers/forest-server-client';
import MockServer from './test-utils/mock-server';
import createGatewaySwitch from '../src/gateway-switch';
import { makeIsMcpRoute } from '../src/mcp-paths';
import ForestMCPServer from '../src/server';

type Seen = { target: string; method?: string; url?: string; originalUrl?: string };
type Mode = 'embedded' | 'standalone';
type Services = 'mcp' | 'api' | 'mcp,api';
type Method = 'get' | 'post' | 'options' | 'head';
type Row = [
  method: Method,
  url: string,
  services: Services,
  expected: string | number,
  to?: string,
];

const API_EXACT_PATHS = new Set(['/docs', '/docs/redoc.standalone.js', '/health']);

function stubClaimsBffPath(pathname: string): boolean {
  return pathname === '/agent' || pathname.startsWith('/agent/') || API_EXACT_PATHS.has(pathname);
}

function recorder(target: string, seen: Seen[]): HttpCallback {
  return (req, res) => {
    const { originalUrl } = req as IncomingMessage & { originalUrl?: string };
    seen.push({ target, method: req.method, url: req.url, originalUrl });
    res.setHeader('x-target', target);
    res.end(target);
  };
}

function hostNext(mode: Mode, res: ServerResponse): () => void {
  return () => {
    res.statusCode = mode === 'embedded' ? 200 : 404;
    res.setHeader('x-target', mode === 'embedded' ? 'host' : 'none');
    res.end();
  };
}

function serve(gateway: GatewayHandler, mode: Mode): http.Server {
  return http.createServer((req, res) => {
    const next = hostNext(mode, res);

    if (gateway.matches(req.url ?? '/')) gateway.callback(req, res, next);
    else next();
  });
}

function stubGateway(basePath: string, services: Services, seen: Seen[]): GatewayHandler {
  return createGatewaySwitch({
    basePath,
    mcp: services.includes('mcp')
      ? { matches: makeIsMcpRoute(basePath), callback: recorder('mcp', seen) }
      : undefined,
    api: services.includes('api')
      ? { matches: stubClaimsBffPath, callback: recorder('api', seen) }
      : undefined,
  });
}

const rowsFor = (P: string): Row[] => [
  ['post', `${P}/oauth/token?service=api`, 'mcp,api', 'api', '/oauth/token?service=api'],
  [
    'get',
    `${P}/oauth/authorize?x=1&service=api`,
    'mcp,api',
    'api',
    '/oauth/authorize?x=1&service=api',
  ],
  ['options', `${P}/oauth/token?service=api`, 'mcp,api', 'api', '/oauth/token?service=api'],
  ['post', `${P}/oauth/token?service=api`, 'api', 'api', '/oauth/token?service=api'],
  ['post', `${P}/oauth/token`, 'mcp,api', 'mcp', `${P}/oauth/token`],
  ['options', `${P}/oauth/token`, 'mcp,api', 'mcp', `${P}/oauth/token`],
  ['get', `${P}/oauth/authorize?client_id=c`, 'mcp', 'mcp', `${P}/oauth/authorize?client_id=c`],
  ['post', `${P}/oauth/token?service=foo`, 'mcp,api', 400],
  ['post', `${P}/oauth/token?service=`, 'mcp,api', 400],
  ['post', `${P}/oauth/token?service=api&service=api`, 'mcp,api', 400],
  ['post', `${P}/oauth/token?service=API`, 'mcp', 400],
  ['options', `${P}/oauth/token?service=foo`, 'mcp', 400],
  ['post', `${P}/oauth/token?service=api`, 'mcp', 404],
  ['options', `${P}/oauth/token?service=api`, 'mcp', 404],
  ['get', `${P}/oauth/callback?service=github`, 'api', 'host'],
  ['get', `${P}/oauth/callback`, 'api', 'host'],
  ['get', `${P}/oauth?service=api`, 'mcp,api', 'host'],
  ['get', `${P}/oauth/?service=api`, 'mcp,api', 'host'],
  ['get', `${P}/oauth/`, 'mcp,api', 'host'],
  ['get', `${P}/oauth/?service=foo`, 'mcp,api', 'host'],
  ['options', `${P}/oauth/?service=api`, 'mcp,api', 'host'],
  ['post', `${P}/oauth//token?service=api`, 'mcp,api', 'host'],
  ['post', `${P}/oauth//token`, 'mcp', 'host'],
  ['post', `${P}/oauth/token?service=%61pi`, 'mcp,api', 'api', '/oauth/token?service=%61pi'],
  ['post', `${P}/oauth/token?service=api&service=`, 'api', 'host'],
  ['head', `${P}/oauth/token?service=foo`, 'mcp', 400],
  ['head', `${P}/oauth/token?service=api`, 'mcp', 404],
  ['get', `${P}/oauth`, 'mcp,api', 'host'],
  ['post', `${P}/api/agent/v1/books/list`, 'mcp,api', 'api', '/agent/v1/books/list'],
  ['get', `${P}/api/agent/v1/books?limit=5`, 'api', 'api', '/agent/v1/books?limit=5'],
  ['get', `${P}/api/agent/openapi.json`, 'api', 'api', '/agent/openapi.json'],
  ['get', `${P}/api/agent`, 'api', 'api', '/agent'],
  ['get', `${P}/api/health`, 'api', 'api', '/health'],
  ['head', `${P}/api/health`, 'api', 'api', '/health'],
  ['get', `${P}/api/health?probe=1`, 'api', 'api', '/health?probe=1'],
  ['get', `${P}/api/docs`, 'api', 'api', '/docs'],
  ['get', `${P}/api/docs/redoc.standalone.js`, 'api', 'api', '/docs/redoc.standalone.js'],
  ['options', `${P}/api/agent/v1/books/list`, 'api', 'api', '/agent/v1/books/list'],
  ['get', `${P}/api`, 'api', 'host'],
  ['get', `${P}/api/`, 'api', 'host'],
  ['get', `${P}/api/other`, 'mcp,api', 'host'],
  ['get', `${P}/api/health/`, 'api', 'host'],
  ['get', `${P}/api/healthz`, 'api', 'host'],
  ['get', `${P}/api/agents`, 'api', 'host'],
  ['post', `${P}/api/oauth/token?service=api`, 'mcp,api', 'host'],
  ['get', `${P}/api/agent/v1/books`, 'mcp', 'host'],
  ['post', `${P}/apix/agent/v1/books`, 'api', 'host'],
  ['post', `${P}/mcp`, 'mcp,api', 'mcp', `${P}/mcp`],
  ['post', `${P}/mcp?service=api`, 'mcp,api', 'mcp', `${P}/mcp?service=api`],
  ['post', `${P}/mcp`, 'api', 'host'],
  [
    'get',
    `/.well-known/oauth-authorization-server${P}`,
    'mcp',
    'mcp',
    `/.well-known/oauth-authorization-server${P}`,
  ],
  [
    'get',
    `/.well-known/oauth-protected-resource${P}/mcp`,
    'mcp',
    'mcp',
    `/.well-known/oauth-protected-resource${P}/mcp`,
  ],
  ['get', `/.well-known/oauth-authorization-server${P}`, 'api', 'host'],
];

const rowsOutsidePrefix = (P: string): Row[] => [
  ['post', '/mcp', 'mcp,api', 'host'],
  ['get', '/oauth/login', 'mcp,api', 'host'],
  ['post', '/oauth/token?service=api', 'mcp,api', 'host'],
  ['post', '/oauth/token?service=foo', 'mcp,api', 'host'],
  ['get', '/api/health', 'mcp,api', 'host'],
  ['get', '/.well-known/oauth-authorization-server', 'mcp,api', 'host'],
  ['post', `${P}x/oauth/token?service=api`, 'mcp,api', 'host'],
  ['get', `${P}x/api/health`, 'mcp,api', 'host'],
];

function expectedOutcome(mode: Mode, [method, url, , expected, to]: Row) {
  if (expected === 'host') {
    return {
      status: mode === 'embedded' ? 200 : 404,
      target: mode === 'embedded' ? 'host' : 'none',
      error: undefined,
      seen: [],
    };
  }

  if (typeof expected === 'number') {
    const error = expected === 400 ? 'invalid_request' : 'not_found';

    return {
      status: expected,
      target: undefined,
      error: method === 'head' ? undefined : error,
      seen: [],
    };
  }

  return {
    status: 200,
    target: expected,
    error: undefined,
    seen: [
      {
        target: expected,
        method: method.toUpperCase(),
        url: to,
        originalUrl: expected === 'api' ? url : undefined,
      },
    ],
  };
}

describe('createGatewaySwitch', () => {
  describe.each<Mode>(['embedded', 'standalone'])('%s mount', mode => {
    describe.each(['', '/ai', '/a/b'])('basePath "%s"', P => {
      const table = P ? [...rowsFor(P), ...rowsOutsidePrefix(P)] : rowsFor(P);

      it.each(table)('%s %s with [%s] should reach %s', async (...row: Row) => {
        const [method, url, services] = row;
        const seen: Seen[] = [];

        const response = await request(serve(stubGateway(P, services, seen), mode))[method](url);

        expect({
          status: response.status,
          target: response.headers['x-target'],
          error: response.body.error,
          seen,
        }).toEqual(expectedOutcome(mode, row));
      });
    });

    it('should not read service from a POST body', async () => {
      const seen: Seen[] = [];

      await request(serve(stubGateway('', 'mcp,api', seen), mode))
        .post('/oauth/token')
        .type('form')
        .send({ service: 'api', grant_type: 'authorization_code' });

      expect(seen).toEqual([
        { target: 'mcp', method: 'POST', url: '/oauth/token', originalUrl: undefined },
      ]);
    });
  });

  it.each([
    ['/oauth/token?service=api', '/oauth/token?service=api'],
    ['/api/agent/v1/books', '/agent/v1/books'],
    ['/api/docs', '/docs'],
    ['/api/health', '/health'],
  ])('should keep an originalUrl the host already set on %p', async (url, stripped) => {
    const seen: Seen[] = [];
    const gateway = stubGateway('', 'api', seen);
    const server = http.createServer((req, res) => {
      (req as IncomingMessage & { originalUrl?: string }).originalUrl = `/sub${req.url}`;
      gateway.callback(req, res, hostNext('embedded', res));
    });

    await request(server).post(url);

    expect(seen).toEqual([
      { target: 'api', method: 'POST', url: stripped, originalUrl: `/sub${url}` },
    ]);
  });

  it('should answer 404 itself when nobody claims the request and no next is given', async () => {
    const seen: Seen[] = [];
    const gateway = stubGateway('', 'mcp,api', seen);

    const response = await request(http.createServer(gateway.callback)).get('/api/other');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: 'not_found',
      error_description: 'No Gateway service serves this path.',
    });
    expect(seen).toEqual([]);
  });

  it('should call next when its callback is called directly with an unclaimed url', () => {
    const seen: Seen[] = [];
    const next = jest.fn();

    stubGateway('', 'mcp,api', seen).callback(
      { url: '/api/other' } as IncomingMessage,
      {} as ServerResponse,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(seen).toEqual([]);
  });

  it.each(['/oauth/token', '/oauth/token?service=foo'])(
    'should leave %p to the host when the MCP does not claim that basePath',
    async url => {
      const seen: Seen[] = [];
      const gateway = createGatewaySwitch({
        basePath: '',
        mcp: { matches: makeIsMcpRoute('/elsewhere'), callback: recorder('mcp', seen) },
      });

      const response = await request(serve(gateway, 'embedded')).post(url);

      expect(response.headers['x-target']).toBe('host');
      expect(seen).toEqual([]);
    },
  );

  it('should claim synchronously without calling any service', () => {
    const seen: Seen[] = [];
    const gateway = stubGateway('/ai', 'mcp,api', seen);

    expect(gateway.matches('/ai/oauth/token?service=api')).toBe(true);
    expect(gateway.matches('/ai/oauth/token?service=foo')).toBe(true);
    expect(gateway.matches('/ai/api/health')).toBe(true);
    expect(gateway.matches('/ai/mcp')).toBe(true);
    expect(gateway.matches('/ai/api/other')).toBe(false);
    expect(gateway.matches('/oauth/token')).toBe(false);
    expect(seen).toEqual([]);
  });

  it('should hand api.matches the pathname stripped of basePath/api and of the query', () => {
    const matches = jest.fn().mockReturnValue(false);
    const gateway = createGatewaySwitch({
      basePath: '/ai',
      api: { matches, callback: jest.fn() },
    });

    gateway.matches('/ai/api/agent/v1/books?filter=a/b#frag');

    expect(matches).toHaveBeenCalledWith('/agent/v1/books');
  });

  it('should hand mcp.matches the untouched url', () => {
    const matches = jest.fn().mockReturnValue(false);
    const gateway = createGatewaySwitch({ basePath: '/ai', mcp: { matches, callback: jest.fn() } });

    gateway.matches('/ai/mcp?x=1');

    expect(matches).toHaveBeenCalledWith('/ai/mcp?x=1');
  });

  it('should normalize basePath like the MCP mount path', async () => {
    const seen: Seen[] = [];
    const gateway = stubGateway('ai/', 'api', seen);

    await request(serve(gateway, 'standalone')).get('/ai/api/health');

    expect(seen).toEqual([
      { target: 'api', method: 'GET', url: '/health', originalUrl: '/ai/api/health' },
    ]);
  });

  it.each(['/a/../b', '/ai?x', '/a b', '/tenant/:id'])(
    'should reject the invalid basePath %p naming basePath, not MCP',
    basePath => {
      expect(() => createGatewaySwitch({ basePath })).toThrow(`Invalid basePath "${basePath}"`);
      expect(() => createGatewaySwitch({ basePath })).not.toThrow(/MCP/);
    },
  );
});

describe('createGatewaySwitch with the real MCP callback', () => {
  const originalFetch = global.fetch;

  beforeAll(() => {
    const forestServer = new MockServer();
    forestServer
      .get('/liana/environment', {
        data: { id: '12345', attributes: { api_endpoint: 'https://api.example.com' } },
      })
      .get('/liana/forest-schema', {
        data: [],
        meta: { liana: 'forest-express-sequelize', liana_version: '9.0.0', liana_features: null },
      })
      .get(/\/oauth\/register\//, { error: 'Client not found' }, 404);
    global.fetch = forestServer.fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe.each(['', '/ai'])('basePath "%s"', P => {
    let seen: Seen[];
    let server: http.Server;

    beforeAll(async () => {
      const mcp = new ForestMCPServer({
        envSecret: 'ENV_SECRET',
        authSecret: 'AUTH_SECRET',
        forestServerClient: createMockForestServerClient(),
        basePath: P,
        logger: jest.fn(),
      });
      const mcpCallback = await mcp.getHttpCallback(new URL('http://localhost:3000'));
      seen = [];
      server = serve(
        createGatewaySwitch({
          basePath: P,
          mcp: { matches: makeIsMcpRoute(P), callback: mcpCallback },
          api: { matches: stubClaimsBffPath, callback: recorder('api', seen) },
        }),
        'embedded',
      );
    });

    beforeEach(() => {
      seen.length = 0;
    });

    it('should let the MCP serve the token endpoint when no service is given', async () => {
      const response = await request(server)
        .post(`${P}/oauth/token`)
        .type('form')
        .send({ grant_type: 'authorization_code', service: 'api' });

      expect(response.status).toBe(400);
      expect(response.headers['x-powered-by']).toBe('Express');
      expect(response.body.error).toBe('invalid_request');
      expect(response.body.error_description).toContain('client_id');
      expect(seen).toEqual([]);
    });

    it('should let the MCP answer its own CORS preflight', async () => {
      const response = await request(server).options(`${P}/oauth/token`);

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(seen).toEqual([]);
    });

    it('should let the MCP serve its discovery metadata', async () => {
      const response = await request(server).get(`/.well-known/oauth-authorization-server${P}`);

      expect(response.status).toBe(200);
      expect(response.body.token_endpoint).toBe(`http://localhost:3000${P}/oauth/token`);
    });

    it('should send service=api to the API, not the MCP', async () => {
      const response = await request(server).post(`${P}/oauth/token?service=api`);

      expect(response.headers['x-target']).toBe('api');
      expect(seen).toEqual([
        {
          target: 'api',
          method: 'POST',
          url: '/oauth/token?service=api',
          originalUrl: `${P}/oauth/token?service=api`,
        },
      ]);
    });

    it('should leave /oauth/login to the host only when the MCP is under a basePath', async () => {
      const response = await request(server).get('/oauth/login');

      expect({
        target: response.headers['x-target'],
        poweredBy: response.headers['x-powered-by'],
        seen,
      }).toEqual(
        P
          ? { target: 'host', poweredBy: undefined, seen: [] }
          : { target: undefined, poweredBy: 'Express', seen: [] },
      );
    });
  });
});
