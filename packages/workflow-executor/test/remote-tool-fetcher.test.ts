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

function makeRemoteTool(sourceId: string): RemoteTool {
  return { sourceId } as unknown as RemoteTool;
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

  it('skips entries with undefined id even when the requested id is undefined-like', () => {
    const configs = { legacy: cfg(undefined), 'srv-a': cfg('id-A') };

    // Undefined-id entries are never scoped in; the legacy fallback bypasses scoping entirely.
    expect(scopeConfigsToServer(configs, 'id-A')).toEqual({ 'srv-a': cfg('id-A') });
  });
});

// ---------------------------------------------------------------------------
// RemoteToolFetcher.fetch
// ---------------------------------------------------------------------------

describe('RemoteToolFetcher.fetch', () => {
  it('passes the full Record to loadRemoteTools when mcpServerId is undefined (legacy)', async () => {
    const configs = { 'srv-a': cfg('id-A'), 'srv-b': cfg('id-B') };
    const { fetcher, aiModelPort } = makeFetcher({
      workflowPort: { getMcpServerConfigs: jest.fn().mockResolvedValue(configs) },
    });

    await fetcher.fetch();

    expect(aiModelPort.loadRemoteTools).toHaveBeenCalledWith(configs);
  });

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

  it('returns an empty array and skips loadRemoteTools when the scoped Record is empty', async () => {
    const { fetcher, aiModelPort } = makeFetcher({
      workflowPort: { getMcpServerConfigs: jest.fn().mockResolvedValue({}) },
    });

    const tools = await fetcher.fetch('id-A');

    expect(tools).toEqual([]);
    expect(aiModelPort.loadRemoteTools).not.toHaveBeenCalled();
  });

  it('warns about unidentified configs before reporting the missing target server', async () => {
    const { fetcher, logger } = makeFetcher({
      workflowPort: {
        getMcpServerConfigs: jest
          .fn()
          .mockResolvedValue({ 'srv-a': cfg('id-A'), legacy: cfg(undefined) }),
      },
    });

    await fetcher.fetch('id-missing');

    expect(logger.warn).toHaveBeenCalledWith(
      'MCP configs without id cannot be scoped — check orchestrator migration',
      { requestedMcpServerId: 'id-missing', unidentifiedConfigNames: ['legacy'] },
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'MCP step targets a server not advertised by the orchestrator',
      { requestedMcpServerId: 'id-missing', availableMcpServerIds: ['id-A'] },
    );
  });

  it('does not warn about unidentified configs when no mcpServerId is set (legacy fallback)', async () => {
    const { fetcher, logger } = makeFetcher({
      workflowPort: {
        getMcpServerConfigs: jest.fn().mockResolvedValue({ legacy: cfg(undefined) }),
      },
    });

    await fetcher.fetch();

    expect(logger.warn).not.toHaveBeenCalledWith(
      'MCP configs without id cannot be scoped — check orchestrator migration',
      expect.anything(),
    );
  });

  it('warns distinctly when orchestrator returns no MCP configs at all', async () => {
    const { fetcher, logger } = makeFetcher({
      workflowPort: { getMcpServerConfigs: jest.fn().mockResolvedValue({}) },
    });

    await fetcher.fetch('id-A');

    expect(logger.warn).toHaveBeenCalledWith(
      'MCP step targets a server but orchestrator returned no MCP configs',
      { requestedMcpServerId: 'id-A', availableMcpServerIds: [] },
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

  it('logs an error listing failed config names when loadRemoteTools returns fewer tools than scoped entries', async () => {
    const { fetcher, logger } = makeFetcher({
      workflowPort: {
        getMcpServerConfigs: jest
          .fn()
          .mockResolvedValue({ 'srv-a': cfg('id-A'), 'srv-b': cfg('id-A') }),
      },
      aiModelPort: {
        loadRemoteTools: jest.fn().mockResolvedValue([makeRemoteTool('srv-a')]),
      },
    });

    await fetcher.fetch('id-A');

    expect(logger.error).toHaveBeenCalledWith('MCP servers failed to load tools', {
      requestedMcpServerId: 'id-A',
      failedConfigNames: ['srv-b'],
    });
  });

  it('reports requestedMcpServerId as null in the partial-failure log for the legacy fallback', async () => {
    const { fetcher, logger } = makeFetcher({
      workflowPort: {
        getMcpServerConfigs: jest.fn().mockResolvedValue({ 'srv-a': cfg('id-A') }),
      },
      aiModelPort: { loadRemoteTools: jest.fn().mockResolvedValue([]) },
    });

    await fetcher.fetch();

    expect(logger.error).toHaveBeenCalledWith('MCP servers failed to load tools', {
      requestedMcpServerId: null,
      failedConfigNames: ['srv-a'],
    });
  });

  it('does not log a partial-failure error when every scoped entry produced a tool', async () => {
    const { fetcher, logger } = makeFetcher({
      workflowPort: {
        getMcpServerConfigs: jest.fn().mockResolvedValue({ 'srv-a': cfg('id-A') }),
      },
      aiModelPort: {
        loadRemoteTools: jest.fn().mockResolvedValue([makeRemoteTool('srv-a')]),
      },
    });

    await fetcher.fetch('id-A');

    expect(logger.error).not.toHaveBeenCalled();
  });

  // Forest integrations set sourceId to a hardcoded literal ('zendesk', 'snowflake', ...) that
  // does not necessarily match the Record key — a sourceId-vs-key comparison would always flag
  // them as failed on the happy path.
  it('does not flag a Forest integration whose sourceId differs from the Record key', async () => {
    const forestConfig = {
      isForestConnector: true as const,
      name: 'zendesk',
    } as unknown as ToolConfig;
    const { fetcher, logger } = makeFetcher({
      workflowPort: {
        getMcpServerConfigs: jest.fn().mockResolvedValue({ 'zendesk-prod': forestConfig }),
      },
      aiModelPort: {
        loadRemoteTools: jest.fn().mockResolvedValue([makeRemoteTool('zendesk')]),
      },
    });

    await fetcher.fetch();

    expect(logger.error).not.toHaveBeenCalled();
  });

  it('flags only the MCP config when a Forest connector and a failed MCP entry coexist', async () => {
    const forestConfig = {
      isForestConnector: true as const,
      name: 'zendesk',
    } as unknown as ToolConfig;
    const { fetcher, logger } = makeFetcher({
      workflowPort: {
        getMcpServerConfigs: jest.fn().mockResolvedValue({
          'zendesk-prod': forestConfig,
          'srv-a': cfg('id-A'),
        }),
      },
      aiModelPort: {
        loadRemoteTools: jest.fn().mockResolvedValue([makeRemoteTool('zendesk')]),
      },
    });

    await fetcher.fetch();

    expect(logger.error).toHaveBeenCalledWith('MCP servers failed to load tools', {
      requestedMcpServerId: null,
      failedConfigNames: ['srv-a'],
    });
  });

  it('returns the tools produced by loadRemoteTools verbatim', async () => {
    const remoteTools = [makeRemoteTool('srv-a'), makeRemoteTool('srv-b')];
    const { fetcher } = makeFetcher({
      workflowPort: {
        getMcpServerConfigs: jest
          .fn()
          .mockResolvedValue({ 'srv-a': cfg('id-A'), 'srv-b': cfg('id-A') }),
      },
      aiModelPort: { loadRemoteTools: jest.fn().mockResolvedValue(remoteTools) },
    });

    const result = await fetcher.fetch('id-A');

    expect(result).toBe(remoteTools);
  });
});
