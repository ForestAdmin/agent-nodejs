import type { AiModelPort } from '../src/ports/ai-model-port';
import type { Logger } from '../src/ports/logger-port';
import type { WorkflowPort } from '../src/ports/workflow-port';
import type { RemoteTool, ToolConfig } from '@forestadmin/ai-proxy';

import RemoteToolFetcher, { scopeConfigsToServer } from '../src/remote-tool-fetcher';

function createMockWorkflowPort(): jest.Mocked<Pick<WorkflowPort, 'getMcpServerConfigs'>> {
  return { getMcpServerConfigs: jest.fn().mockResolvedValue({}) };
}

function createMockAiModelPort(): jest.Mocked<Pick<AiModelPort, 'loadRemoteTools'>> {
  return { loadRemoteTools: jest.fn().mockResolvedValue([]) };
}

function createMockLogger(): jest.Mocked<Required<Logger>> {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

function makeRemoteTool(sourceId: string, mcpServerId?: string): RemoteTool {
  return { sourceId, mcpServerId } as unknown as RemoteTool;
}

function makeFetcher(overrides?: {
  workflowPort?: Partial<jest.Mocked<Pick<WorkflowPort, 'getMcpServerConfigs'>>>;
  aiModelPort?: Partial<jest.Mocked<Pick<AiModelPort, 'loadRemoteTools'>>>;
  logger?: jest.Mocked<Required<Logger>>;
}) {
  const workflowPort = { ...createMockWorkflowPort(), ...overrides?.workflowPort };
  const aiModelPort = { ...createMockAiModelPort(), ...overrides?.aiModelPort };
  const logger = overrides?.logger ?? createMockLogger();
  const fetcher = new RemoteToolFetcher(
    workflowPort as unknown as WorkflowPort,
    aiModelPort as unknown as AiModelPort,
    logger,
  );

  return { fetcher, workflowPort, aiModelPort, logger };
}

const cfg = (id: string | undefined): ToolConfig =>
  ({ id, url: 'https://x.example', type: 'http' as const, headers: {} } as unknown as ToolConfig);

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

    await fetcher.fetch('id-A');

    expect(aiModelPort.loadRemoteTools).toHaveBeenCalledWith({ 'srv-a': cfg('id-A') });
  });

  it('returns no tools and an undefined serverName, skipping loadRemoteTools, when the scoped Record is empty', async () => {
    const { fetcher, aiModelPort } = makeFetcher({
      workflowPort: { getMcpServerConfigs: jest.fn().mockResolvedValue({}) },
    });

    const result = await fetcher.fetch('id-A');

    expect(result).toEqual({ tools: [], serverName: undefined });
    expect(aiModelPort.loadRemoteTools).not.toHaveBeenCalled();
  });

  it('resolves serverName from the scoped Record key', async () => {
    const remoteTools = [makeRemoteTool('srv-a', 'id-A')];
    const { fetcher } = makeFetcher({
      workflowPort: {
        getMcpServerConfigs: jest.fn().mockResolvedValue({ 'srv-a': cfg('id-A') }),
      },
      aiModelPort: { loadRemoteTools: jest.fn().mockResolvedValue(remoteTools) },
    });

    const result = await fetcher.fetch('id-A');

    expect(result).toEqual({ tools: remoteTools, serverName: 'srv-a' });
  });

  it('warns about the missing target with the list of advertised ids when no config matches', async () => {
    const { fetcher, logger } = makeFetcher({
      workflowPort: {
        getMcpServerConfigs: jest
          .fn()
          .mockResolvedValue({ 'srv-a': cfg('id-A'), 'srv-b': cfg('id-B') }),
      },
    });

    await fetcher.fetch('id-missing');

    expect(logger.warn).toHaveBeenCalledWith(
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

    await fetcher.fetch('id-A');

    expect(logger.warn).toHaveBeenCalledWith(
      'MCP step targets a server but orchestrator returned no MCP configs',
      { requestedMcpServerId: 'id-A', mcpServerName: undefined, availableMcpServerIds: [] },
    );
    expect(logger.warn).not.toHaveBeenCalledWith(
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

    await fetcher.fetch('id-A');

    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('flags the scoped MCP config when no tool was loaded for its id', async () => {
    const { fetcher, logger } = makeFetcher({
      workflowPort: {
        getMcpServerConfigs: jest.fn().mockResolvedValue({ 'srv-a': cfg('id-A') }),
      },
      aiModelPort: { loadRemoteTools: jest.fn().mockResolvedValue([]) },
    });

    await fetcher.fetch('id-A');

    expect(logger.error).toHaveBeenCalledWith('MCP servers failed to load tools', {
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

    await fetcher.fetch('id-A');

    expect(logger.error).not.toHaveBeenCalled();
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

    await fetcher.fetch('id-zendesk');

    expect(logger.error).not.toHaveBeenCalled();
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

    await fetcher.fetch('id-zendesk');

    expect(logger.error).toHaveBeenCalledWith('MCP servers failed to load tools', {
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

    const result = await fetcher.fetch('id-A');

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

    await expect(fetcher.fetch('id-A')).rejects.toThrow('MCP unreachable');
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('propagates a rejection from getMcpServerConfigs without calling loadRemoteTools', async () => {
    const { fetcher, aiModelPort } = makeFetcher({
      workflowPort: {
        getMcpServerConfigs: jest.fn().mockRejectedValue(new Error('orchestrator down')),
      },
    });

    await expect(fetcher.fetch('id-A')).rejects.toThrow('orchestrator down');
    expect(aiModelPort.loadRemoteTools).not.toHaveBeenCalled();
  });
});
