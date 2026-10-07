/* eslint-disable @typescript-eslint/no-explicit-any */
import type { GatewayOptions } from '../src/types';
import type { UploadStorage } from '@forestadmin/mcp-server';
import type { IncomingMessage, ServerResponse } from 'http';

import { DataSourceCustomizer } from '@forestadmin/datasource-customizer';
import * as McpServer from '@forestadmin/mcp-server';

import * as factories from './__factories__';
import Agent from '../src/agent';

const mockMakeRoutes = jest.fn();

jest.mock('../src/routes', () => ({
  __esModule: true,
  default: (...args) => mockMakeRoutes(...args),
}));

jest.mock('@forestadmin/datasource-customizer');

const mockParseConfig = jest.fn();
const mockBuildBff = jest.fn();

jest.mock('@forestadmin/agent-bff', () => ({
  __esModule: true,
  IN_PROCESS_AGENT_URL: 'http://in-process.agent',
  parseConfig: (env: unknown) => mockParseConfig(env),
  buildBff: (options: unknown) => mockBuildBff(options),
  claimsBffPath: () => true,
  version: jest.requireActual('../package.json').peerDependencies['@forestadmin/agent-bff'],
}));

let mcpServerSpy: jest.SpyInstance;
let mockGetHttpCallback: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();

  mockMakeRoutes.mockReturnValue([{ setupRoutes: jest.fn(), bootstrap: jest.fn() }]);
  mockParseConfig.mockReturnValue({});
  mockBuildBff.mockResolvedValue({ callback: jest.fn(), invalidate: jest.fn() });
  jest
    .mocked(DataSourceCustomizer.prototype.getDataSource)
    .mockResolvedValue(factories.dataSource.build());

  mockGetHttpCallback = jest.fn().mockResolvedValue(jest.fn());
  mcpServerSpy = jest
    .spyOn(McpServer, 'ForestMCPServer')
    .mockImplementation(() => ({ getHttpCallback: mockGetHttpCallback } as any));
});

const runningAgents: Agent[] = [];

afterEach(async () => {
  mcpServerSpy.mockRestore();
  await Promise.all(runningAgents.splice(0).map(agent => agent.stop()));
});

function buildAgent(prefix = '') {
  const logger = jest.fn();
  const agent = new Agent(
    factories.forestAdminHttpDriverOptions.build({ prefix, logger, skipSchemaUpdate: true }),
  );

  return { agent, logger };
}

function answeringWith(body: string) {
  return (_req: IncomingMessage, res: ServerResponse) => res.end(body);
}

async function startOnPort(agent: Agent) {
  runningAgents.push(agent);
  agent.mountOnStandaloneServer(0, '127.0.0.1');
  await agent.start();

  return async (path: string) => {
    const response = await fetch(`http://127.0.0.1:${agent.standaloneServerPort}${path}`);

    return { status: response.status, body: await response.text() };
  };
}

function gatewayLog(logger: jest.Mock, service: 'MCP' | 'API'): string {
  const line = logger.mock.calls
    .map(([, message]) => message as string)
    .find(message => message.startsWith(`[Gateway] ${service}:`));

  if (!line) throw new Error(`No [Gateway] ${service} boot log line`);

  return line;
}

describe('Agent.addGateway', () => {
  it('should return the agent so it can be chained', () => {
    const { agent } = buildAgent();

    expect(agent.addGateway({ mcp: true })).toBe(agent);
  });

  describe('when neither addGateway() nor an alias is called', () => {
    it('should start with no error, no Gateway log and no Gateway route', async () => {
      const { agent, logger } = buildAgent();

      const request = await startOnPort(agent);

      expect(mcpServerSpy).not.toHaveBeenCalled();
      expect(mockParseConfig).not.toHaveBeenCalled();
      expect(logger).not.toHaveBeenCalledWith('Info', expect.stringContaining('[Gateway]'));
      expect((await request('/mcp')).status).toBe(404);
      expect((await request('/api/health')).status).toBe(404);
    });
  });

  describe('boot log', () => {
    it('should list the MCP and API routes at the root with an empty basePath', async () => {
      const { agent, logger } = buildAgent();
      agent.addGateway({ mcp: true, api: { tokenEncryptionKey: 'key' } });

      await agent.start();

      expect(gatewayLog(logger, 'MCP')).toBe(
        '[Gateway] MCP: /mcp, /mcp/uploads, /oauth/*, /.well-known/oauth-authorization-server, /.well-known/oauth-protected-resource/mcp',
      );
      expect(gatewayLog(logger, 'API')).toBe(
        '[Gateway] API: /api/agent/*, /api/health, /oauth/*?service=api',
      );
    });

    it('should list /api/docs only when openapiEnabled is set', async () => {
      const { agent, logger } = buildAgent();
      agent.addGateway({ api: { tokenEncryptionKey: 'key', openapiEnabled: true } });

      await agent.start();

      expect(gatewayLog(logger, 'API')).toBe(
        '[Gateway] API: /api/agent/*, /api/health, /api/docs, /oauth/*?service=api',
      );
    });

    it('should say "API OAuth off" and list no ?service=api route without tokenEncryptionKey', async () => {
      const { agent, logger } = buildAgent();
      agent.addGateway({ api: {} });

      await agent.start();

      expect(gatewayLog(logger, 'API')).toBe(
        '[Gateway] API: /api/agent/*, /api/health (API OAuth off: no tokenEncryptionKey)',
      );
    });

    it('should prefix every route with the basePath and claim only the suffixed .well-known subtrees', async () => {
      const { agent, logger } = buildAgent();
      agent.addGateway({ basePath: '/ai', mcp: true, api: { tokenEncryptionKey: 'key' } });

      await agent.start();

      expect(gatewayLog(logger, 'MCP')).toBe(
        '[Gateway] MCP: /ai/mcp, /ai/mcp/uploads, /ai/oauth/*, ' +
          '/.well-known/oauth-authorization-server/ai, /.well-known/oauth-protected-resource/ai/mcp',
      );
      expect(gatewayLog(logger, 'API')).toBe(
        '[Gateway] API: /ai/api/agent/*, /ai/api/health, /ai/oauth/*?service=api',
      );
    });

    it.each<[string, Exclude<GatewayOptions['mcp'], boolean | undefined>]>([
      ['are off', { fileUploads: false }],
      ['go to an external storage', { fileUploads: { storage: {} as UploadStorage } }],
      ['are left out of enabledTools', { enabledTools: ['list'] }],
    ])('should not list the uploads route when file uploads %s', async (_case, mcp) => {
      const { agent, logger } = buildAgent();
      agent.addGateway({ mcp });

      await agent.start();

      expect(gatewayLog(logger, 'MCP')).toBe(
        '[Gateway] MCP: /mcp, /oauth/*, /.well-known/oauth-authorization-server, /.well-known/oauth-protected-resource/mcp',
      );
    });

    it('should warn that the allowlist protects nothing when no OAuth route is served', async () => {
      const { agent, logger } = buildAgent();
      agent.addGateway({ allowedOAuthClients: ['claude.ai'], api: {} });

      await agent.start();

      expect(logger).toHaveBeenCalledWith(
        'Warn',
        '[Gateway] allowedOAuthClients is set but no OAuth route is served (MCP off, API OAuth off).',
      );
    });

    it.each<[string, GatewayOptions]>([
      ['the MCP is on', { allowedOAuthClients: ['claude.ai'], mcp: true, api: {} }],
      [
        'API OAuth is on',
        { allowedOAuthClients: ['claude.ai'], api: { tokenEncryptionKey: 'key' } },
      ],
      ['no allowlist is set', { api: {} }],
    ])('should not warn about the allowlist when %s', async (_case, options) => {
      const { agent, logger } = buildAgent();
      agent.addGateway(options);

      await agent.start();

      expect(logger).not.toHaveBeenCalledWith(
        'Warn',
        expect.stringContaining('allowedOAuthClients is set'),
      );
    });

    it('should log only the enabled service', async () => {
      const { agent, logger } = buildAgent();
      agent.addGateway({ mcp: true, api: false });

      await agent.start();

      expect(gatewayLog(logger, 'MCP')).toBe(
        '[Gateway] MCP: /mcp, /mcp/uploads, /oauth/*, /.well-known/oauth-authorization-server, /.well-known/oauth-protected-resource/mcp',
      );
      expect(() => gatewayLog(logger, 'API')).toThrow();
    });
  });

  describe('services', () => {
    it('should start the API with its defaults when api is true', async () => {
      const { agent } = buildAgent();
      agent.addGateway({ api: true });

      await agent.start();

      expect(mockParseConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          BFF_TOKEN_ENCRYPTION_KEY: undefined,
          BFF_ALLOWED_ORIGINS: undefined,
          BFF_OPENAPI_ENABLED: 'false',
        }),
      );
    });

    it('should hand the MCP its options, the normalized basePath and the Gateway allowlist', async () => {
      const { agent } = buildAgent();
      agent.addGateway({
        basePath: 'ai/',
        allowedOAuthClients: ['dust.tt'],
        mcp: { enabledTools: ['list'], tokenTtl: { accessTokenSeconds: 900 } },
      });

      await agent.start();

      expect(mcpServerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          basePath: '/ai',
          allowedOAuthClients: ['dust.tt'],
          enabledTools: ['list'],
          tokenTtl: { accessTokenSeconds: 900 },
        }),
      );
    });

    it('should hand the API the Gateway allowlist when only the API is on', async () => {
      const { agent } = buildAgent();
      agent.addGateway({ allowedOAuthClients: ['claude.ai'], api: { tokenEncryptionKey: 'key' } });

      await agent.start();

      expect(mockBuildBff).toHaveBeenCalledWith(
        expect.objectContaining({ basePath: '/api', allowedOAuthClients: ['claude.ai'] }),
      );
    });

    it('should hand the same allowlist to both services', async () => {
      const { agent } = buildAgent();
      agent.addGateway({
        allowedOAuthClients: ['claude.ai'],
        mcp: true,
        api: { tokenEncryptionKey: 'key' },
      });

      await agent.start();

      expect(mcpServerSpy).toHaveBeenCalledWith(
        expect.objectContaining({ allowedOAuthClients: ['claude.ai'] }),
      );
      expect(mockBuildBff).toHaveBeenCalledWith(
        expect.objectContaining({ allowedOAuthClients: ['claude.ai'] }),
      );
    });

    it('should hand the API no allowlist when the Gateway has none', async () => {
      const { agent } = buildAgent();
      agent.addGateway({ api: { tokenEncryptionKey: 'key' } });

      await agent.start();

      expect(mockBuildBff).toHaveBeenCalledWith(
        expect.objectContaining({ allowedOAuthClients: undefined }),
      );
    });

    it('should not load the MCP server when only the API is on', async () => {
      const { agent } = buildAgent();
      agent.addGateway({ api: {} });

      await agent.start();

      expect(mcpServerSpy).not.toHaveBeenCalled();
    });

    it('should surface the MCP domain-root rejection from start()', async () => {
      const { agent } = buildAgent();
      const rejection = new Error(
        'basePath "/ai" requires the agent to be served at the domain root, but its base URL ' +
          'has a path ("/app"). Remove the basePath or mount the agent at the root.',
      );
      mockGetHttpCallback.mockRejectedValue(rejection);
      agent.addGateway({ basePath: '/ai', mcp: true });

      await expect(agent.start()).rejects.toThrow(rejection.message);
      expect(mcpServerSpy).toHaveBeenCalledWith(expect.objectContaining({ basePath: '/ai' }));
    });
  });

  describe('option checks', () => {
    it.each(['basePath', 'allowedOAuthClients'])(
      'should refuse a nested mcp.%s, naming the top-level option',
      option => {
        const { agent } = buildAgent();
        const options = { mcp: { [option]: option === 'basePath' ? '/x' : ['dust.tt'] } };

        expect(() => agent.addGateway(options as unknown as GatewayOptions)).toThrow(
          `addGateway({ ${option} })`,
        );
      },
    );

    it('should refuse an invalid basePath at start(), naming basePath and the format, before mounting', async () => {
      const { agent } = buildAgent();
      agent.addGateway({ basePath: 'a b', mcp: true }).mountOnStandaloneServer(0, '127.0.0.1');

      await expect(agent.start()).rejects.toThrow(
        'Invalid basePath "a b": use a plain path prefix like "/mcp" ' +
          '(letters, digits, "-" and "_" only).',
      );
      expect(agent.standaloneServerPort).toBeUndefined();
      expect(mcpServerSpy).not.toHaveBeenCalled();
    });

    it.each([{}, { mcp: false, api: false }])(
      'should fail start() with a clear error when no service is on (%j)',
      async options => {
        const { agent } = buildAgent();
        agent.addGateway(options);

        await expect(agent.start()).rejects.toThrow(
          'addGateway() enables no service: pass mcp, api, or both',
        );
      },
    );
  });

  describe('call guards', () => {
    it('should refuse a second call', () => {
      const { agent } = buildAgent();
      agent.addGateway({ mcp: true });

      expect(() => agent.addGateway({ api: {} })).toThrow('addGateway can only be called once.');
    });

    it('should refuse a call once start() has begun', async () => {
      const { agent } = buildAgent();
      await agent.start();

      expect(() => agent.addGateway({ mcp: true })).toThrow(
        'addGateway must be called before start(): the agent is already starting.',
      );
    });

    const mixing = 'cannot be combined with';

    it('should refuse addGateway() after mountAiMcpServer()', () => {
      const { agent } = buildAgent();
      agent.mountAiMcpServer();

      expect(() => agent.addGateway({ api: {} })).toThrow(mixing);
    });

    it('should refuse mountAiMcpServer() after addGateway()', () => {
      const { agent } = buildAgent();
      agent.addGateway({ api: {} });

      expect(() => agent.mountAiMcpServer()).toThrow(mixing);
    });

    it('should refuse addGateway() after addBff()', () => {
      const { agent } = buildAgent();
      agent.addBff();

      expect(() => agent.addGateway({ mcp: true })).toThrow(mixing);
    });

    it('should refuse addBff() after addGateway()', () => {
      const { agent } = buildAgent();
      agent.addGateway({ mcp: true });

      expect(() => agent.addBff()).toThrow(mixing);
    });
  });

  describe('route overlap with the agent', () => {
    it.each`
      prefix         | options                                   | message
      ${''}          | ${{ basePath: '/forest', mcp: true }}     | ${'basePath "/forest" overlaps the agent routes on /forest'}
      ${'api'}       | ${{ basePath: '/api/forest/x', api: {} }} | ${'basePath "/api/forest/x" overlaps the agent routes on /api/forest'}
      ${'mcp'}       | ${{ mcp: true }}                          | ${'The agent routes on /mcp/forest overlap /mcp, claimed by the Gateway MCP'}
      ${'oauth'}     | ${{ mcp: true }}                          | ${'The agent routes on /oauth/forest overlap /oauth, claimed by the Gateway MCP'}
      ${'ai/mcp'}    | ${{ basePath: '/ai', mcp: true }}         | ${'The agent routes on /ai/mcp/forest overlap /ai/mcp, claimed by the Gateway MCP'}
      ${'api/agent'} | ${{ api: {} }}                            | ${'The agent routes on /api/agent/forest overlap /api/agent, claimed by the Gateway API'}
    `('should refuse prefix "$prefix" with $options', async ({ prefix, options, message }) => {
      const { agent } = buildAgent(prefix);
      agent.addGateway(options);

      await expect(agent.start()).rejects.toThrow(message);
    });

    it.each`
      prefix          | options
      ${'api'}        | ${{ mcp: true }}
      ${'api'}        | ${{ api: {} }}
      ${'api/docs'}   | ${{ api: { openapiEnabled: true } }}
      ${'api/health'} | ${{ api: {} }}
      ${'mcp'}        | ${{ api: {} }}
      ${'api/agent'}  | ${{ mcp: true }}
      ${'mcp'}        | ${{ basePath: '/ai', mcp: true }}
      ${''}           | ${{ basePath: '/forestx', mcp: true }}
      ${'mcpx'}       | ${{ mcp: true }}
    `('should accept prefix "$prefix" with $options', async ({ prefix, options }) => {
      const { agent } = buildAgent(prefix);
      agent.addGateway(options);

      await expect(agent.start()).resolves.toBeUndefined();
    });
  });
});

describe('Agent.mountAiMcpServer (deprecated alias)', () => {
  it('should keep the last configuration when called twice, at the root', async () => {
    const { agent } = buildAgent();
    mockGetHttpCallback.mockResolvedValue(answeringWith('mcp'));
    agent.mountAiMcpServer({ enabledTools: ['list'] });
    agent.mountAiMcpServer({ enabledTools: ['describeCollection'] });

    const request = await startOnPort(agent);

    expect(mcpServerSpy).toHaveBeenCalledTimes(1);
    expect(mcpServerSpy).toHaveBeenCalledWith(
      expect.objectContaining({ enabledTools: ['describeCollection'], basePath: undefined }),
    );
    expect(await request('/mcp')).toEqual({ status: 200, body: 'mcp' });
  });

  it('should log a deprecation warning naming addGateway() on start', async () => {
    const { agent, logger } = buildAgent();
    agent.mountAiMcpServer();

    await agent.start();

    expect(logger).toHaveBeenCalledWith(
      'Warn',
      expect.stringMatching(/mountAiMcpServer\(\) is deprecated.*addGateway\(\{ mcp \}\)/),
    );
  });
});

describe('Agent.addBff (deprecated alias)', () => {
  it('should keep serving on /bff and claim nothing on /api', async () => {
    const { agent } = buildAgent();
    mockBuildBff.mockResolvedValue({ callback: answeringWith('bff'), invalidate: jest.fn() });
    agent.addBff();

    const request = await startOnPort(agent);

    expect(await request('/bff/agent/v1/books/list')).toEqual({ status: 200, body: 'bff' });
    expect((await request('/api/agent/v1/books/list')).status).toBe(404);
    expect((await request('/api/health')).status).toBe(404);
  });

  it('should hand the BFF no allowlist', async () => {
    const { agent } = buildAgent();
    agent.addBff({ tokenEncryptionKey: 'key' });

    await agent.start();

    expect(mockBuildBff).toHaveBeenCalledWith(
      expect.objectContaining({ basePath: '/bff', allowedOAuthClients: undefined }),
    );
  });
});
