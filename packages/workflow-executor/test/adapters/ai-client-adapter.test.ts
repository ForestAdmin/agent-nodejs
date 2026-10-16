import type { AiProxyLogger } from '../../src/adapters/to-ai-proxy-logger';
import type { Logger } from '../../src/ports/logger-port';

import AiClientAdapter from '../../src/adapters/ai-client-adapter';

const mockGetModel = jest.fn().mockReturnValue({ invoke: jest.fn() });
const mockLoadRemoteTools = jest.fn().mockResolvedValue([]);
const mockLoadRemoteToolsWithFailures = jest.fn().mockResolvedValue({ tools: [], failures: [] });
const mockCloseConnections = jest.fn().mockResolvedValue(undefined);
const mockProbeCredentials = jest.fn().mockResolvedValue(undefined);
const mockAiClientConstructor = jest.fn();

jest.mock('@forestadmin/ai-proxy', () => ({
  AiClient: jest.fn().mockImplementation((...args: unknown[]) => {
    mockAiClientConstructor(...args);

    return {
      getModel: mockGetModel,
      loadRemoteTools: mockLoadRemoteTools,
      loadRemoteToolsWithFailures: mockLoadRemoteToolsWithFailures,
      closeConnections: mockCloseConnections,
      probeCredentials: mockProbeCredentials,
    };
  }),
}));

describe('AiClientAdapter', () => {
  beforeEach(() => jest.clearAllMocks());

  it('delegates probeCredentials to AiClient', async () => {
    const adapter = new AiClientAdapter([
      { name: 'default', provider: 'bedrock' as const, model: 'eu.anthropic.claude-sonnet-5' },
    ]);

    await adapter.probeCredentials();

    expect(mockProbeCredentials).toHaveBeenCalledTimes(1);
  });

  // The AWS message names what to fix (which chain was searched, the Docker mount trap), so losing
  // it to a generic port error would leave the operator with "probeCredentials failed" and nothing
  // to act on.
  it('keeps the provider message when the probe fails', async () => {
    mockProbeCredentials.mockRejectedValueOnce(
      new Error('no AWS credentials could be resolved: the standard chain found none'),
    );
    const adapter = new AiClientAdapter([
      { name: 'default', provider: 'bedrock' as const, model: 'eu.anthropic.claude-sonnet-5' },
    ]);

    await expect(adapter.probeCredentials()).rejects.toThrow('the standard chain found none');
  });

  it('delegates getModel to AiClient with aiConfigName from step definition', () => {
    const adapter = new AiClientAdapter([
      { name: 'my-config', provider: 'openai' as const, model: 'gpt-4o', apiKey: 'sk-test' },
    ]);

    adapter.getModel({ aiConfigName: 'my-config' });

    expect(mockGetModel).toHaveBeenCalledWith('my-config');
  });

  it('delegates getModel without aiConfigName when not set', () => {
    const adapter = new AiClientAdapter([
      { name: 'default', provider: 'openai' as const, model: 'gpt-4o', apiKey: 'sk-test' },
    ]);

    adapter.getModel();

    expect(mockGetModel).toHaveBeenCalledWith(undefined);
  });

  it('delegates loadRemoteTools to AiClient', async () => {
    const adapter = new AiClientAdapter([]);
    const configs = {};

    await adapter.loadRemoteTools(configs);

    expect(mockLoadRemoteTools).toHaveBeenCalledWith(configs);
  });

  it('delegates loadRemoteToolsWithFailures to AiClient', async () => {
    const adapter = new AiClientAdapter([]);
    const configs = {};

    await adapter.loadRemoteToolsWithFailures(configs);

    expect(mockLoadRemoteToolsWithFailures).toHaveBeenCalledWith(configs);
  });

  it('delegates closeConnections to AiClient', async () => {
    const adapter = new AiClientAdapter([]);

    await adapter.closeConnections();

    expect(mockCloseConnections).toHaveBeenCalled();
  });

  describe('logger', () => {
    const buildAdapter = (logger?: Logger) => new AiClientAdapter([], logger);

    const aiProxyLoggerGivenToClient = () =>
      (mockAiClientConstructor.mock.calls[0][0] as { logger?: AiProxyLogger }).logger;

    it("routes ai-proxy's MCP diagnostics to the executor logger with the cause flattened", () => {
      const executorLogger = jest.fn();
      buildAdapter(executorLogger);
      const cause = new Error('401 Unauthorized');

      aiProxyLoggerGivenToClient()?.('Error', 'Error loading tools for notion', cause);

      expect(executorLogger).toHaveBeenCalledWith('Error', 'Error loading tools for notion', {
        error: '401 Unauthorized',
        stack: cause.stack,
      });
    });

    it('leaves AiClient without a logger when the adapter is built without one', () => {
      buildAdapter();

      expect(aiProxyLoggerGivenToClient()).toBeUndefined();
    });
  });
});
