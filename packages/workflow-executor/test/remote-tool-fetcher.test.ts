import type OAuthTokenService from '../src/oauth/token-service';
import type { AiModelPort } from '../src/ports/ai-model-port';
import type { Logger } from '../src/ports/logger-port';
import type { WorkflowPort } from '../src/ports/workflow-port';
import type { RemoteTool, ToolConfig } from '@forestadmin/ai-proxy';

import { OAuthReauthRequiredError } from '../src/errors';
import RemoteToolFetcher, { scopeConfigsToServer } from '../src/remote-tool-fetcher';

const USER_ID = 1;

type AiModelMethods = Pick<AiModelPort, 'loadRemoteTools' | 'loadRemoteToolsWithFailures'>;

function createMockWorkflowPort(): jest.Mocked<Pick<WorkflowPort, 'getMcpServerConfigs'>> {
  return { getMcpServerConfigs: jest.fn().mockResolvedValue({}) };
}

function createMockAiModelPort(): jest.Mocked<AiModelMethods> {
  return {
    loadRemoteTools: jest.fn().mockResolvedValue([]),
    loadRemoteToolsWithFailures: jest.fn().mockResolvedValue({ tools: [], failures: [] }),
  };
}

function createMockLogger(): jest.MockedFunction<Logger> {
  return jest.fn();
}

function makeRemoteTool(sourceId: string, mcpServerId?: string): RemoteTool {
  return { sourceId, mcpServerId } as unknown as RemoteTool;
}

function makeFetcher(overrides?: {
  workflowPort?: Partial<jest.Mocked<Pick<WorkflowPort, 'getMcpServerConfigs'>>>;
  aiModelPort?: Partial<jest.Mocked<AiModelMethods>>;
  logger?: jest.MockedFunction<Logger>;
  tokenService?: OAuthTokenService;
}) {
  const workflowPort = { ...createMockWorkflowPort(), ...overrides?.workflowPort };
  const aiModelPort = { ...createMockAiModelPort(), ...overrides?.aiModelPort };
  const logger = overrides?.logger ?? createMockLogger();
  const tokenService =
    overrides?.tokenService ??
    ({
      getAccessToken: jest.fn().mockResolvedValue('access-token'),
    } as unknown as OAuthTokenService);
  const fetcher = new RemoteToolFetcher(
    workflowPort as unknown as WorkflowPort,
    aiModelPort as unknown as AiModelPort,
    logger,
    tokenService,
  );

  return { fetcher, workflowPort, aiModelPort, logger };
}

const cfg = (id: string | undefined): ToolConfig =>
  ({ id, url: 'https://x.example', type: 'http' as const, headers: {} } as unknown as ToolConfig);

const oauthCfg = (id: string): ToolConfig =>
  ({
    id,
    authType: 'oauth2',
    url: 'https://x.example',
    type: 'http' as const,
    headers: {},
  } as unknown as ToolConfig);

// ---------------------------------------------------------------------------
// scopeConfigsToServer (pure)
// ---------------------------------------------------------------------------

describe('scopeConfigsToServer', () => {
  it('keeps only entries whose config.id matches the requested mcpServerId', () => {
    const configs = { 'srv-a': cfg('id-A'), 'srv-b': cfg('id-B') };

    expect(scopeConfigsToServer(configs, 'id-A')).toEqual({ 'srv-a': cfg('id-A') });
  });

  // Matching by Record key would let a renamed server collide with another config's id.
  it('matches by config.id, not by Record key', () => {
    const configs = { 'server-A': cfg('id-A'), 'server-B': cfg('server-A') };

    expect(scopeConfigsToServer(configs, 'server-A')).toEqual({
      'server-B': cfg('server-A'),
    });
  });

  it('returns an empty object when no config matches', () => {
    const configs = { 'srv-a': cfg('id-A') };

    expect(scopeConfigsToServer(configs, 'id-missing')).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// RemoteToolFetcher.fetch
// ---------------------------------------------------------------------------

describe('RemoteToolFetcher.fetch', () => {
  it('passes only the matching config to loadRemoteTools when mcpServerId is set', async () => {
    const { fetcher, aiModelPort } = makeFetcher({
      workflowPort: {
        getMcpServerConfigs: jest
          .fn()
          .mockResolvedValue({ 'srv-a': cfg('id-A'), 'srv-b': cfg('id-B') }),
      },
    });

    await fetcher.fetch('id-A', USER_ID);

    expect(aiModelPort.loadRemoteTools).toHaveBeenCalledWith({ 'srv-a': cfg('id-A') });
  });

  it('returns no tools and an undefined mcpServerName, skipping loadRemoteTools, when the scoped Record is empty', async () => {
    const { fetcher, aiModelPort } = makeFetcher({
      workflowPort: { getMcpServerConfigs: jest.fn().mockResolvedValue({}) },
    });

    const result = await fetcher.fetch('id-A', USER_ID);

    expect(result).toEqual({ tools: [], mcpServerName: undefined });
    expect(aiModelPort.loadRemoteTools).not.toHaveBeenCalled();
  });

  it('resolves mcpServerName from the scoped Record key', async () => {
    const remoteTools = [makeRemoteTool('srv-a', 'id-A')];
    const { fetcher } = makeFetcher({
      workflowPort: {
        getMcpServerConfigs: jest.fn().mockResolvedValue({ 'srv-a': cfg('id-A') }),
      },
      aiModelPort: { loadRemoteTools: jest.fn().mockResolvedValue(remoteTools) },
    });

    const result = await fetcher.fetch('id-A', USER_ID);

    expect(result).toEqual({ tools: remoteTools, mcpServerName: 'srv-a' });
  });

  it('warns about the missing target with the list of advertised ids when no config matches', async () => {
    const { fetcher, logger } = makeFetcher({
      workflowPort: {
        getMcpServerConfigs: jest
          .fn()
          .mockResolvedValue({ 'srv-a': cfg('id-A'), 'srv-b': cfg('id-B') }),
      },
    });

    await fetcher.fetch('id-missing', USER_ID);

    expect(logger).toHaveBeenCalledWith(
      'Warn',
      'MCP step targets a server not advertised by the orchestrator',
      {
        requestedMcpServerId: 'id-missing',
        mcpServerName: undefined,
        availableMcpServerIds: ['id-A', 'id-B'],
      },
    );
  });

  it('warns distinctly when orchestrator returns no MCP configs at all', async () => {
    const { fetcher, logger } = makeFetcher({
      workflowPort: { getMcpServerConfigs: jest.fn().mockResolvedValue({}) },
    });

    await fetcher.fetch('id-A', USER_ID);

    expect(logger).toHaveBeenCalledWith(
      'Warn',
      'MCP step targets a server but orchestrator returned no MCP configs',
      { requestedMcpServerId: 'id-A', mcpServerName: undefined, availableMcpServerIds: [] },
    );
    expect(logger).not.toHaveBeenCalledWith(
      'Warn',
      'MCP step targets a server not advertised by the orchestrator',
      expect.anything(),
    );
  });

  it('does not warn about the missing target when the scoped Record is non-empty', async () => {
    const { fetcher, logger } = makeFetcher({
      workflowPort: {
        getMcpServerConfigs: jest.fn().mockResolvedValue({ 'srv-a': cfg('id-A') }),
      },
    });

    await fetcher.fetch('id-A', USER_ID);

    expect(logger.mock.calls.find(c => c[0] === 'Warn')).toBeUndefined();
  });

  it('flags the scoped MCP config when no tool was loaded for its id', async () => {
    const { fetcher, logger } = makeFetcher({
      workflowPort: {
        getMcpServerConfigs: jest.fn().mockResolvedValue({ 'srv-a': cfg('id-A') }),
      },
      aiModelPort: { loadRemoteTools: jest.fn().mockResolvedValue([]) },
    });

    await fetcher.fetch('id-A', USER_ID);

    expect(logger).toHaveBeenCalledWith('Error', 'MCP servers failed to load tools', {
      requestedMcpServerId: 'id-A',
      mcpServerName: 'srv-a',
      failedConfigNames: ['srv-a'],
    });
  });

  it('does not log a partial-failure error when a tool carries the scoped config id', async () => {
    const { fetcher, logger } = makeFetcher({
      workflowPort: {
        getMcpServerConfigs: jest.fn().mockResolvedValue({ 'srv-a': cfg('id-A') }),
      },
      aiModelPort: {
        loadRemoteTools: jest.fn().mockResolvedValue([makeRemoteTool('srv-a', 'id-A')]),
      },
    });

    await fetcher.fetch('id-A', USER_ID);

    expect(logger.mock.calls.find(c => c[0] === 'Error')).toBeUndefined();
  });

  // Forest integrations carry a hardcoded sourceId (e.g. 'zendesk'); the partial-failure check
  // discriminates on tool.mcpServerId, which both providers populate from the orchestrator id.
  it('does not flag a Forest connector whose sourceId differs from the Record key', async () => {
    const forestConfig = {
      id: 'id-zendesk',
      isForestConnector: true as const,
      integrationName: 'Zendesk',
    } as unknown as ToolConfig;
    const { fetcher, logger } = makeFetcher({
      workflowPort: {
        getMcpServerConfigs: jest.fn().mockResolvedValue({ 'zendesk-prod': forestConfig }),
      },
      aiModelPort: {
        loadRemoteTools: jest.fn().mockResolvedValue([makeRemoteTool('zendesk', 'id-zendesk')]),
      },
    });

    await fetcher.fetch('id-zendesk', USER_ID);

    expect(logger.mock.calls.find(c => c[0] === 'Error')).toBeUndefined();
  });

  it('flags a Forest connector that fails to load entirely', async () => {
    const forestConfig = {
      id: 'id-zendesk',
      isForestConnector: true as const,
      integrationName: 'Zendesk',
    } as unknown as ToolConfig;
    const { fetcher, logger } = makeFetcher({
      workflowPort: {
        getMcpServerConfigs: jest.fn().mockResolvedValue({ 'zendesk-prod': forestConfig }),
      },
      aiModelPort: { loadRemoteTools: jest.fn().mockResolvedValue([]) },
    });

    await fetcher.fetch('id-zendesk', USER_ID);

    expect(logger).toHaveBeenCalledWith('Error', 'MCP servers failed to load tools', {
      requestedMcpServerId: 'id-zendesk',
      mcpServerName: 'zendesk-prod',
      failedConfigNames: ['zendesk-prod'],
    });
  });

  it('returns the tools produced by loadRemoteTools verbatim', async () => {
    const remoteTools = [makeRemoteTool('srv-a', 'id-A')];
    const { fetcher } = makeFetcher({
      workflowPort: {
        getMcpServerConfigs: jest.fn().mockResolvedValue({ 'srv-a': cfg('id-A') }),
      },
      aiModelPort: { loadRemoteTools: jest.fn().mockResolvedValue(remoteTools) },
    });

    const result = await fetcher.fetch('id-A', USER_ID);

    expect(result.tools).toBe(remoteTools);
  });

  it('propagates a rejection from loadRemoteTools without logging partial-failure', async () => {
    const { fetcher, logger } = makeFetcher({
      workflowPort: {
        getMcpServerConfigs: jest.fn().mockResolvedValue({ 'srv-a': cfg('id-A') }),
      },
      aiModelPort: {
        loadRemoteTools: jest.fn().mockRejectedValue(new Error('MCP unreachable')),
      },
    });

    await expect(fetcher.fetch('id-A', USER_ID)).rejects.toThrow('MCP unreachable');
    expect(logger.mock.calls.find(c => c[0] === 'Error')).toBeUndefined();
  });

  it('propagates a rejection from getMcpServerConfigs without calling loadRemoteTools', async () => {
    const { fetcher, aiModelPort } = makeFetcher({
      workflowPort: {
        getMcpServerConfigs: jest.fn().mockRejectedValue(new Error('orchestrator down')),
      },
    });

    await expect(fetcher.fetch('id-A', USER_ID)).rejects.toThrow('orchestrator down');
    expect(aiModelPort.loadRemoteTools).not.toHaveBeenCalled();
  });
});

describe('RemoteToolFetcher.fetch — OAuth2 servers', () => {
  const makeTokenService = (getAccessToken: jest.Mock): OAuthTokenService =>
    ({ getAccessToken } as unknown as OAuthTokenService);

  const authFailure = {
    server: 'srv-a',
    mcpServerId: 'id-A',
    kind: 'auth',
    error: new Error('401'),
  };

  it('acquires a token, injects it as a Bearer header, and returns the loaded tools + a reload hook', async () => {
    const tool = makeRemoteTool('srv-a', 'id-A');
    const getAccessToken = jest.fn().mockResolvedValue('tok-1');
    const loadRemoteToolsWithFailures = jest
      .fn()
      .mockResolvedValue({ tools: [tool], failures: [] });
    const { fetcher } = makeFetcher({
      workflowPort: {
        getMcpServerConfigs: jest.fn().mockResolvedValue({ 'srv-a': oauthCfg('id-A') }),
      },
      aiModelPort: { loadRemoteToolsWithFailures },
      tokenService: makeTokenService(getAccessToken),
    });

    const result = await fetcher.fetch('id-A', USER_ID);

    expect(getAccessToken).toHaveBeenCalledWith(USER_ID, 'id-A', { forceRefresh: false });
    expect(loadRemoteToolsWithFailures).toHaveBeenCalledWith({
      'srv-a': expect.objectContaining({ headers: { Authorization: 'Bearer tok-1' } }),
    });
    expect(result.tools).toEqual([tool]);
    expect(typeof result.reloadWithFreshAuth).toBe('function');
  });

  it('force-refreshes and retries list-tools once on an auth failure, then succeeds', async () => {
    const tool = makeRemoteTool('srv-a', 'id-A');
    const getAccessToken = jest.fn().mockResolvedValue('tok');
    const loadRemoteToolsWithFailures = jest
      .fn()
      .mockResolvedValueOnce({ tools: [], failures: [authFailure] })
      .mockResolvedValueOnce({ tools: [tool], failures: [] });
    const { fetcher } = makeFetcher({
      workflowPort: {
        getMcpServerConfigs: jest.fn().mockResolvedValue({ 'srv-a': oauthCfg('id-A') }),
      },
      aiModelPort: { loadRemoteToolsWithFailures },
      tokenService: makeTokenService(getAccessToken),
    });

    const result = await fetcher.fetch('id-A', USER_ID);

    expect(getAccessToken).toHaveBeenNthCalledWith(1, USER_ID, 'id-A', { forceRefresh: false });
    expect(getAccessToken).toHaveBeenNthCalledWith(2, USER_ID, 'id-A', { forceRefresh: true });
    expect(result.tools).toEqual([tool]);
  });

  it('raises OAuthReauthRequiredError when the auth failure persists after a forced refresh', async () => {
    const getAccessToken = jest.fn().mockResolvedValue('tok');
    const loadRemoteToolsWithFailures = jest
      .fn()
      .mockResolvedValue({ tools: [], failures: [authFailure] });
    const { fetcher } = makeFetcher({
      workflowPort: {
        getMcpServerConfigs: jest.fn().mockResolvedValue({ 'srv-a': oauthCfg('id-A') }),
      },
      aiModelPort: { loadRemoteToolsWithFailures },
      tokenService: makeTokenService(getAccessToken),
    });

    await expect(fetcher.fetch('id-A', USER_ID)).rejects.toBeInstanceOf(OAuthReauthRequiredError);
  });

  it('propagates OAuthReauthRequiredError from token acquisition (no stored credential)', async () => {
    const getAccessToken = jest.fn().mockRejectedValue(new OAuthReauthRequiredError('id-A'));
    const { fetcher } = makeFetcher({
      workflowPort: {
        getMcpServerConfigs: jest.fn().mockResolvedValue({ 'srv-a': oauthCfg('id-A') }),
      },
      tokenService: makeTokenService(getAccessToken),
    });

    await expect(fetcher.fetch('id-A', USER_ID)).rejects.toBeInstanceOf(OAuthReauthRequiredError);
  });

  it('reloadWithFreshAuth forces a refresh and returns freshly-authed tools', async () => {
    const tool = makeRemoteTool('srv-a', 'id-A');
    const getAccessToken = jest.fn().mockResolvedValue('tok');
    const loadRemoteToolsWithFailures = jest
      .fn()
      .mockResolvedValue({ tools: [tool], failures: [] });
    const { fetcher } = makeFetcher({
      workflowPort: {
        getMcpServerConfigs: jest.fn().mockResolvedValue({ 'srv-a': oauthCfg('id-A') }),
      },
      aiModelPort: { loadRemoteToolsWithFailures },
      tokenService: makeTokenService(getAccessToken),
    });

    const { reloadWithFreshAuth } = await fetcher.fetch('id-A', USER_ID);
    if (!reloadWithFreshAuth) throw new Error('expected reloadWithFreshAuth to be defined');
    getAccessToken.mockClear();
    const reloaded = await reloadWithFreshAuth();

    expect(getAccessToken).toHaveBeenCalledWith(USER_ID, 'id-A', { forceRefresh: true });
    expect(reloaded).toEqual([tool]);
  });

  it('leaves the token service untouched for a bearer/none server', async () => {
    const getAccessToken = jest.fn();
    const tool = makeRemoteTool('srv-a', 'id-A');
    const { fetcher, aiModelPort } = makeFetcher({
      workflowPort: { getMcpServerConfigs: jest.fn().mockResolvedValue({ 'srv-a': cfg('id-A') }) },
      aiModelPort: { loadRemoteTools: jest.fn().mockResolvedValue([tool]) },
      tokenService: makeTokenService(getAccessToken),
    });

    const result = await fetcher.fetch('id-A', USER_ID);

    expect(getAccessToken).not.toHaveBeenCalled();
    expect(aiModelPort.loadRemoteTools).toHaveBeenCalled();
    expect(result.reloadWithFreshAuth).toBeUndefined();
  });
});
