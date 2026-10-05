/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IncomingMessage, ServerResponse } from 'http';

import { DataSourceCustomizer } from '@forestadmin/datasource-customizer';
import * as McpServer from '@forestadmin/mcp-server';
import express from 'express';
import Koa from 'koa';
import request from 'supertest';

import * as factories from './__factories__';
import Agent from '../src/agent';
import { BFF_DEPRECATION_LINK, BFF_DEPRECATION_LOG_INTERVAL_MS } from '../src/bff-routes';

const PEER_VERSION: string =
  jest.requireActual('../package.json').peerDependencies['@forestadmin/agent-bff'];

const mockMakeRoutes = jest.fn();

jest.mock('../src/routes', () => ({
  __esModule: true,
  default: (...args) => mockMakeRoutes(...args),
}));

jest.mock('@forestadmin/datasource-customizer');

const mockBuildBff = jest.fn();
let mockBffVersion = '';

jest.mock('@forestadmin/agent-bff', () => ({
  __esModule: true,
  IN_PROCESS_AGENT_URL: 'http://in-process.agent',
  parseConfig: () => ({}),
  buildBff: (options: unknown) => mockBuildBff(options),
  claimsBffPath: (...args: unknown[]) =>
    jest.requireActual('@forestadmin/agent-bff').claimsBffPath(...args),
  get version() {
    return mockBffVersion;
  },
}));

type Req = IncomingMessage & { originalUrl?: string };

function echo(service: string) {
  return (req: Req, res: ServerResponse) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ service, url: req.url, originalUrl: req.originalUrl }));
  };
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>(done => {
    resolve = done;
  });

  return { promise, resolve };
}

async function until(condition: () => boolean) {
  while (!condition()) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise(resolve => {
      setImmediate(resolve);
    });
  }
}

let mcpServerSpy: jest.SpyInstance;
let mockGetHttpCallback: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockBffVersion = PEER_VERSION;

  mockMakeRoutes.mockReturnValue([{ setupRoutes: jest.fn(), bootstrap: jest.fn() }]);
  mockBuildBff.mockResolvedValue({ callback: echo('api'), invalidate: jest.fn() });
  jest
    .mocked(DataSourceCustomizer.prototype.getDataSource)
    .mockResolvedValue(factories.dataSource.build());

  mockGetHttpCallback = jest.fn().mockResolvedValue(echo('mcp'));
  mcpServerSpy = jest
    .spyOn(McpServer, 'ForestMCPServer')
    .mockImplementation(() => ({ getHttpCallback: mockGetHttpCallback } as any));
});

afterEach(() => mcpServerSpy.mockRestore());

function buildAgent(overrides: Record<string, unknown> = {}) {
  const logger = jest.fn();
  const agent = new Agent(
    factories.forestAdminHttpDriverOptions.build({ logger, skipSchemaUpdate: true, ...overrides }),
  );

  return { agent, logger };
}

function onExpress(agent: Agent) {
  const app = express();
  agent.mountOnExpress(app);

  return app;
}

function onKoa(agent: Agent) {
  const app = new Koa();
  agent.mountOnKoa(app);

  return app.callback();
}

describe.each(['', '/ai'])('addGateway() routing with basePath "%s"', basePath => {
  async function startedGateway() {
    const { agent } = buildAgent();
    agent.addGateway({ basePath, mcp: true, api: {} });
    const app = onExpress(agent);
    await agent.start();

    return { agent, app };
  }

  it('should serve the MCP and the stripped API health side by side', async () => {
    const { agent, app } = await startedGateway();

    expect((await request(app).get(`${basePath}/mcp`)).body).toMatchObject({ service: 'mcp' });
    expect((await request(app).get(`${basePath}/api/health`)).body).toEqual({
      service: 'api',
      url: '/health',
      originalUrl: `${basePath}/api/health`,
    });
    await agent.stop();
  });

  it('should hand the API its data path and keep the probe query', async () => {
    const { agent, app } = await startedGateway();

    const list = await request(app).post(`${basePath}/api/agent/v1/books/list`);
    const probe = await request(app).get(`${basePath}/api/health?probe=1`);

    expect(list.body).toMatchObject({ service: 'api', url: '/agent/v1/books/list' });
    expect(probe.body).toMatchObject({ service: 'api', url: '/health?probe=1' });
    await agent.stop();
  });

  it('should leave unclaimed API paths to the host', async () => {
    const { agent, app } = await startedGateway();

    expect((await request(app).post(`${basePath}/api/oauth/token`)).status).toBe(404);
    expect((await request(app).get(`${basePath}/api/unknown`)).status).toBe(404);
    expect((await request(app).get(`${basePath}/api/docs`)).status).toBe(404);
    await agent.stop();
  });

  it('should dispatch the shared OAuth routes on the service parameter', async () => {
    const { agent, app } = await startedGateway();

    const api = await request(app).post(`${basePath}/oauth/token?service=api`);
    const mcp = await request(app).post(`${basePath}/oauth/token`);

    expect(api.body).toEqual({
      service: 'api',
      url: '/oauth/token?service=api',
      originalUrl: `${basePath}/oauth/token?service=api`,
    });
    expect(mcp.body).toMatchObject({ service: 'mcp', url: `${basePath}/oauth/token` });
    await agent.stop();
  });

  it('should serve the new MCP once restart() has rebuilt it', async () => {
    const { agent, app } = await startedGateway();
    mockGetHttpCallback.mockResolvedValue(echo('mcp-restarted'));

    await agent.restart();

    expect((await request(app).get(`${basePath}/mcp`)).body.service).toBe('mcp-restarted');
    await agent.stop();
  });

  it('should keep serving the previous MCP while restart() builds the new one', async () => {
    const { agent, app } = await startedGateway();
    const rebuilt = deferred<ReturnType<typeof echo>>();
    mockGetHttpCallback.mockReturnValue(rebuilt.promise);

    const restarting = agent.restart();
    await until(() => mockGetHttpCallback.mock.calls.length === 2);

    expect((await request(app).get(`${basePath}/mcp`)).body.service).toBe('mcp');
    rebuilt.resolve(echo('mcp-restarted'));
    await restarting;
    expect((await request(app).get(`${basePath}/mcp`)).body.service).toBe('mcp-restarted');
    await agent.stop();
  });
});

describe('addGateway() with a basePath', () => {
  it('should leave the root /api paths to the host', async () => {
    const { agent } = buildAgent();
    agent.addGateway({ basePath: '/ai', api: {} });
    const app = onExpress(agent);
    await agent.start();

    expect((await request(app).post('/ai/api/agent/v1/books/list')).body.service).toBe('api');
    expect((await request(app).post('/api/agent/v1/books/list')).status).toBe(404);
    expect((await request(app).get('/api/health')).status).toBe(404);
    await agent.stop();
  });
});

describe('the API callback behind the switch', () => {
  it('should serve an already stripped request as-is, without ever calling next', async () => {
    const { agent } = buildAgent();
    agent.addGateway({ api: {} });
    onExpress(agent);
    await agent.start();
    const bffCallback = jest.fn();
    (agent as any).embeddedBff.bff.callback = bffCallback;
    const next = jest.fn();
    const req = { url: '/api/health', headers: {} } as Req;

    (agent as any).rootMiddleware.handlers.get('gateway').callback(req, {}, next);

    expect(bffCallback).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/health', originalUrl: '/api/health' }),
      {},
    );
    expect(next).not.toHaveBeenCalled();
    await agent.stop();
  });
});

describe.each([
  ['express', onExpress],
  ['koa', onKoa],
])('addGateway() lifecycle on %s', (_name, mount) => {
  it('should leave every Gateway path to the host before start()', async () => {
    const { agent } = buildAgent();
    agent.addGateway({ mcp: true, api: {} });
    const app = mount(agent);

    expect((await request(app).get('/mcp')).status).toBe(404);
    expect((await request(app).get('/api/health')).status).toBe(404);
  });

  it('should answer 503 on both services between prepare() and their build', async () => {
    const dataSource = deferred<ReturnType<typeof factories.dataSource.build>>();
    const getDataSource = jest.mocked(DataSourceCustomizer.prototype.getDataSource);
    getDataSource.mockReturnValue(dataSource.promise);
    const { agent } = buildAgent();
    agent.addGateway({ mcp: true, api: {} });
    const app = mount(agent);

    const starting = agent.start();
    await until(() => getDataSource.mock.calls.length > 0);

    const api = await request(app).get('/api/health');
    const mcp = await request(app).post('/mcp');
    const oauth = await request(app).post('/oauth/token');

    expect(api.status).toBe(503);
    expect(api.body.error.type).toBe('bff_not_started');
    expect([mcp.status, oauth.status]).toEqual([503, 503]);
    expect(mcp.body).toEqual({
      error: 'temporarily_unavailable',
      error_description: 'The MCP server is not started yet.',
    });
    dataSource.resolve(factories.dataSource.build());
    await starting;
    await agent.stop();
  });

  it('should answer 503 on both services once stopped', async () => {
    const { agent } = buildAgent();
    agent.addGateway({ mcp: true, api: {} });
    const app = mount(agent);
    await agent.start();

    await agent.stop();

    const api = await request(app).get('/api/health');
    const mcp = await request(app).post('/mcp');
    expect(api.status).toBe(503);
    expect(api.body.error.type).toBe('bff_stopped');
    expect(mcp.status).toBe(503);
    expect(mcp.body.error_description).toBe('The MCP server was stopped with the agent.');
  });

  it('should stay stopped when stop() lands before start() has mounted', async () => {
    const dataSource = deferred<ReturnType<typeof factories.dataSource.build>>();
    const getDataSource = jest.mocked(DataSourceCustomizer.prototype.getDataSource);
    getDataSource.mockReturnValue(dataSource.promise);
    const { agent } = buildAgent();
    agent.addGateway({ mcp: true, api: {} });
    const app = mount(agent);

    const starting = agent.start();
    await until(() => getDataSource.mock.calls.length > 0);
    await agent.stop();
    dataSource.resolve(factories.dataSource.build());
    await starting;

    expect((await request(app).get('/api/health')).body.error.type).toBe('bff_stopped');
    expect((await request(app).post('/mcp')).status).toBe(503);
    expect(mockBuildBff).not.toHaveBeenCalled();
  });

  it('should answer stopped on the MCP when stop() lands while the gateway is preparing', async () => {
    const { agent } = buildAgent();
    agent.addGateway({ mcp: true });
    const app = mount(agent);
    const preparing = deferred<void>();
    const prepare = (agent as any).prepareGateway.bind(agent);
    jest.spyOn(agent as any, 'prepareGateway').mockImplementation(async () => {
      await preparing.promise;
      await prepare();
    });
    const prepareCalls = jest.mocked((agent as any).prepareGateway).mock.calls;

    const starting = agent.start();
    await until(() => prepareCalls.length > 0);
    await agent.stop();
    preparing.resolve();
    await starting;

    const mcp = await request(app).post('/mcp');
    expect(mcp.status).toBe(503);
    expect(mcp.body.error_description).toBe('The MCP server was stopped with the agent.');
  });

  it('should not build the API when stop() lands after mount() but before its build', async () => {
    const executorStart = deferred<void>();
    const { agent } = buildAgent();
    agent.addGateway({ mcp: true, api: {} });
    const start = jest.fn(() => executorStart.promise);
    (agent as any).embeddedExecutor = { start, stop: jest.fn() };
    const app = mount(agent);

    const starting = agent.start();
    await until(() => start.mock.calls.length > 0);
    await agent.stop();
    executorStart.resolve();
    await starting;

    expect((await request(app).get('/api/health')).body.error.type).toBe('bff_stopped');
    expect((await request(app).post('/mcp')).status).toBe(503);
    expect(mockBuildBff).not.toHaveBeenCalled();
  });

  it('should keep the MCP stopped when a restart in flight completes after stop()', async () => {
    const { agent } = buildAgent();
    agent.addGateway({ mcp: true, api: {} });
    const app = mount(agent);
    await agent.start();
    const rebuilt = deferred<ReturnType<typeof echo>>();
    mockGetHttpCallback.mockReturnValue(rebuilt.promise);

    const remount = jest.spyOn(agent as any, 'remount');

    const restarting = agent.restart();
    await until(() => mockGetHttpCallback.mock.calls.length === 2);
    await agent.stop();
    rebuilt.resolve(echo('mcp-restarted'));
    await restarting;

    expect(remount).not.toHaveBeenCalled();

    expect((await request(app).post('/mcp')).status).toBe(503);
    expect((await request(app).get('/api/health')).status).toBe(503);
  });

  it('should leave /.well-known to the host in every window the MCP is not built', async () => {
    const dataSource = deferred<ReturnType<typeof factories.dataSource.build>>();
    const getDataSource = jest.mocked(DataSourceCustomizer.prototype.getDataSource);
    getDataSource.mockReturnValue(dataSource.promise);
    const { agent } = buildAgent();
    agent.addGateway({ mcp: true, api: {} });
    const app = mount(agent);
    const wellKnown = async () => (await request(app).get('/.well-known/acme-challenge/x')).status;

    const before = await wellKnown();
    const starting = agent.start();
    await until(() => getDataSource.mock.calls.length > 0);
    const during = await wellKnown();
    dataSource.resolve(factories.dataSource.build());
    await starting;
    await agent.stop();

    expect([before, during, await wellKnown()]).toEqual([404, 404, 404]);
  });

  it('should keep answering 503 when start() fails before mount()', async () => {
    mockGetHttpCallback.mockRejectedValue(new Error('MCP down'));
    const { agent } = buildAgent();
    agent.addGateway({ mcp: true, api: {} });
    const app = mount(agent);

    await expect(agent.start()).rejects.toThrow('MCP down');

    expect((await request(app).get('/api/health')).status).toBe(503);
    expect((await request(app).post('/mcp')).status).toBe(503);
    expect((await request(app).get('/.well-known/oauth-authorization-server')).status).toBe(404);
  });
});

describe('addGateway() checks at start()', () => {
  it('should refuse another agent-bff version, naming both', async () => {
    mockBffVersion = '0.0.1';
    const { agent } = buildAgent();
    agent.addGateway({ api: {} });

    await expect(agent.start()).rejects.toThrow(
      `addGateway({ api }) requires @forestadmin/agent-bff ${PEER_VERSION}, found 0.0.1. ` +
        `Install it with \`npm install @forestadmin/agent-bff@${PEER_VERSION}\`.`,
    );
  });

  it('should leave addBff() free of the version check', async () => {
    mockBffVersion = '0.0.1';
    const { agent } = buildAgent();
    agent.addBff();

    await expect(agent.start()).resolves.toBeUndefined();
    await agent.stop();
  });

  it('should warn once about the IP whitelist, and not again on restart', async () => {
    const getIpWhitelistConfiguration = jest.fn().mockResolvedValue({ isFeatureEnabled: true });
    const forestAdminClient = factories.forestAdminClient.build({ getIpWhitelistConfiguration });
    const { agent, logger } = buildAgent({ forestAdminClient });
    agent.addGateway({ mcp: true });

    await agent.start();
    await agent.restart();

    const warnings = logger.mock.calls.filter(([, message]) => /IP whitelist/.test(message));
    expect(warnings).toEqual([['Warn', expect.stringMatching(/^\[MCP\] The IP whitelist/)]]);
  });

  it('should warn once with both services on, from the MCP only', async () => {
    const getIpWhitelistConfiguration = jest.fn().mockResolvedValue({ isFeatureEnabled: true });
    const forestAdminClient = factories.forestAdminClient.build({ getIpWhitelistConfiguration });
    const { agent, logger } = buildAgent({ forestAdminClient });
    agent.addGateway({ mcp: true, api: {} });

    await agent.start();

    const warnings = logger.mock.calls.filter(([, message]) => /IP whitelist/.test(message));
    expect(warnings).toEqual([['Warn', expect.stringMatching(/^\[MCP\] The IP whitelist/)]]);
    await agent.stop();
  });

  it('should log the API mount on its Gateway prefix', async () => {
    const { agent, logger } = buildAgent();
    agent.addGateway({ basePath: '/ai', api: {} });

    await agent.start();

    expect(logger).toHaveBeenCalledWith('Info', '[BFF] Embedded BFF mounted on /ai/api');
    expect(mockBuildBff).toHaveBeenCalledWith(expect.objectContaining({ basePath: '/ai/api' }));
    await agent.stop();
  });
});

describe('addBff() deprecated alias', () => {
  it('should strip /bff and mark every response deprecated', async () => {
    const { agent } = buildAgent();
    agent.addBff();
    const app = onExpress(agent);
    await agent.start();

    const response = await request(app).get('/bff/health');

    expect(response.body).toEqual({ service: 'api', url: '/health', originalUrl: '/bff/health' });
    expect(response.headers.deprecation).toBe('@1791158400');
    expect(response.headers.link).toBe(`<${BFF_DEPRECATION_LINK}>; rel="deprecation"`);
    expect(response.headers['access-control-expose-headers']).toBe('Deprecation, Link');
    expect((await request(app).get('/api/health')).status).toBe(404);
    await agent.stop();
  });

  it('should append its Link and exposed headers to the ones the host already set', async () => {
    const { agent } = buildAgent();
    agent.addBff();
    const app = express();
    app.use((_req, res, next) => {
      res.setHeader('Link', '<https://host.example/app.css>; rel="preload"');
      res.setHeader('Access-Control-Expose-Headers', 'X-Request-Id, Link');
      next();
    });
    agent.mountOnExpress(app);
    await agent.start();

    const response = await request(app).get('/bff/health');

    expect(response.headers.link).toBe(
      `<https://host.example/app.css>; rel="preload", <${BFF_DEPRECATION_LINK}>; rel="deprecation"`,
    );
    expect(response.headers['access-control-expose-headers']).toBe(
      'X-Request-Id, Link, Deprecation',
    );
    await agent.stop();
  });

  it('should mark a 503 answered before start() deprecated', async () => {
    const { agent } = buildAgent();
    agent.addBff();
    const app = onExpress(agent);

    const response = await request(app).get('/bff/health');

    expect(response.status).toBe(503);
    expect(response.headers.deprecation).toBe('@1791158400');
  });

  it('should keep the deprecation headers when the BFF clears its headers on an error', async () => {
    mockBuildBff.mockResolvedValue({
      callback: (_req: Req, res: ServerResponse) => {
        res.getHeaderNames().forEach(name => res.removeHeader(name));
        res.statusCode = 500;
        res.end();
      },
      invalidate: jest.fn(),
    });
    const { agent } = buildAgent();
    agent.addBff();
    const app = onExpress(agent);
    await agent.start();

    const response = await request(app).get('/bff/health');

    expect(response.status).toBe(500);
    expect(response.headers.deprecation).toBe('@1791158400');
    expect(response.headers.link).toBe(`<${BFF_DEPRECATION_LINK}>; rel="deprecation"`);
    await agent.stop();
  });

  it('should keep its throttle window across a restart', async () => {
    const { agent, logger } = buildAgent();
    agent.addBff();
    const app = onExpress(agent);
    await agent.start();

    await request(app).get('/bff/health');
    await agent.restart();
    await request(app).get('/bff/health');

    const deprecationLogs = logger.mock.calls.filter(([, message]) =>
      /\/bff\/\* is deprecated/.test(message),
    );
    expect(deprecationLogs).toHaveLength(1);
    await agent.stop();
  });

  it('should throttle the deprecation log to one line per interval', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(0);
    const { agent, logger } = buildAgent();
    agent.addBff();
    const app = onExpress(agent);
    await agent.start();
    const deprecationLogs = () =>
      logger.mock.calls.filter(([, message]) => /\/bff\/\* is deprecated/.test(message));

    await request(app).get('/bff/health');
    await request(app).get('/bff/health');
    now.mockReturnValue(BFF_DEPRECATION_LOG_INTERVAL_MS);
    await request(app).get('/bff/health');

    expect(deprecationLogs()).toHaveLength(2);
    now.mockRestore();
    await agent.stop();
  });
});
