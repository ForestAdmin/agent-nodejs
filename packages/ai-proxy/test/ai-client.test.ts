import type { ToolProvider } from '../src/tool-provider';
import type { Logger } from '@forestadmin/datasource-toolkit';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

import { AIModelNotSupportedError, AINotConfiguredError, AiClient } from '../src';
import { createToolProviders } from '../src/tool-provider-factory';

jest.mock('../src/tool-provider-factory', () => ({
  createToolProviders: jest.fn().mockReturnValue([]),
}));

const mockedCreateToolProviders = createToolProviders as jest.MockedFunction<
  typeof createToolProviders
>;

function mockProvider(overrides: Partial<ToolProvider> = {}): ToolProvider {
  return {
    loadTools: jest.fn().mockResolvedValue([]),
    checkConnection: jest.fn().mockResolvedValue(true as const),
    dispose: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const createBaseChatModelMock = jest.fn().mockReturnValue({} as BaseChatModel);
jest.mock('../src/create-base-chat-model', () => ({
  createBaseChatModel: (...args: unknown[]) => createBaseChatModelMock(...args),
}));

describe('Model validation', () => {
  it('throws AIModelNotSupportedError for unsupported models', () => {
    expect(
      () =>
        new AiClient({
          aiConfigurations: [{ name: 'test', provider: 'openai', apiKey: 'dev', model: 'gpt-4' }],
        }),
    ).toThrow(AIModelNotSupportedError);
  });

  it('accepts supported models', () => {
    expect(
      () =>
        new AiClient({
          aiConfigurations: [{ name: 'test', provider: 'openai', apiKey: 'dev', model: 'gpt-4o' }],
        }),
    ).not.toThrow();
  });
});

describe('getModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a BaseChatModel by calling createBaseChatModel', () => {
    const fakeModel = { fake: true } as unknown as BaseChatModel;
    createBaseChatModelMock.mockReturnValue(fakeModel);

    const client = new AiClient({
      aiConfigurations: [{ name: 'gpt4', provider: 'openai', apiKey: 'dev', model: 'gpt-4o' }],
    });

    const result = client.getModel('gpt4');

    expect(createBaseChatModelMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'gpt4', provider: 'openai', model: 'gpt-4o' }),
    );
    expect(result).toBe(fakeModel);
  });

  it('returns cached instance on second call with same name', () => {
    const fakeModel = { fake: true } as unknown as BaseChatModel;
    createBaseChatModelMock.mockReturnValue(fakeModel);

    const client = new AiClient({
      aiConfigurations: [{ name: 'gpt4', provider: 'openai', apiKey: 'dev', model: 'gpt-4o' }],
    });

    const first = client.getModel('gpt4');
    const second = client.getModel('gpt4');

    expect(first).toBe(second);
    expect(createBaseChatModelMock).toHaveBeenCalledTimes(1);
  });

  it('uses first configuration when aiName is not provided', () => {
    const fakeModel = { fake: true } as unknown as BaseChatModel;
    createBaseChatModelMock.mockReturnValue(fakeModel);

    const client = new AiClient({
      aiConfigurations: [
        { name: 'gpt4', provider: 'openai', apiKey: 'dev', model: 'gpt-4o' },
        { name: 'gpt4mini', provider: 'openai', apiKey: 'dev', model: 'gpt-4o-mini' },
      ],
    });

    client.getModel();

    expect(createBaseChatModelMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'gpt4', model: 'gpt-4o' }),
    );
  });

  it('throws AINotConfiguredError when aiConfigurations is empty', () => {
    const client = new AiClient({});

    expect(() => client.getModel()).toThrow(AINotConfiguredError);
  });

  it('throws AINotConfiguredError when constructed with no arguments', () => {
    const client = new AiClient();

    expect(() => client.getModel()).toThrow(AINotConfiguredError);
  });

  it('creates separate cached instances for different AI names', () => {
    const fakeModel1 = { id: 1 } as unknown as BaseChatModel;
    const fakeModel2 = { id: 2 } as unknown as BaseChatModel;
    createBaseChatModelMock.mockReturnValueOnce(fakeModel1).mockReturnValueOnce(fakeModel2);

    const client = new AiClient({
      aiConfigurations: [
        { name: 'gpt4', provider: 'openai', apiKey: 'dev', model: 'gpt-4o' },
        { name: 'gpt4mini', provider: 'openai', apiKey: 'dev', model: 'gpt-4o-mini' },
      ],
    });

    const result1 = client.getModel('gpt4');
    const result2 = client.getModel('gpt4mini');

    expect(result1).not.toBe(result2);
    expect(createBaseChatModelMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to first config and caches by resolved name', () => {
    const fakeModel = { fake: true } as unknown as BaseChatModel;
    createBaseChatModelMock.mockReturnValue(fakeModel);
    const mockLogger = jest.fn();

    const client = new AiClient({
      aiConfigurations: [{ name: 'gpt4', provider: 'openai', apiKey: 'dev', model: 'gpt-4o' }],
      logger: mockLogger,
    });

    const result = client.getModel('non-existent');

    expect(mockLogger).toHaveBeenCalledWith(
      'Warn',
      expect.stringContaining("AI configuration 'non-existent' not found"),
    );
    expect(createBaseChatModelMock).toHaveBeenCalledWith(expect.objectContaining({ name: 'gpt4' }));
    expect(result).toBe(fakeModel);
  });
});

describe('loadRemoteTools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates to createToolProviders and returns the flattened tools', async () => {
    const mcpTools = [{ name: 'mcp-tool' }];
    const integrationTools = [{ name: 'zendesk-tool' }];
    mockedCreateToolProviders.mockReturnValue([
      mockProvider({ loadTools: jest.fn().mockResolvedValue(mcpTools) }),
      mockProvider({ loadTools: jest.fn().mockResolvedValue(integrationTools) }),
    ]);

    const client = new AiClient({});
    const configs = {
      'mcp-1': { url: 'http://example.com' },
    } as never;

    const result = await client.loadRemoteTools(configs);

    expect(mockedCreateToolProviders).toHaveBeenCalledWith(configs, undefined);
    expect(result).toEqual([...mcpTools, ...integrationTools]);
  });

  it('disposes the previously-loaded providers before loading new ones', async () => {
    const firstDispose = jest.fn().mockResolvedValue(undefined);
    const secondDispose = jest.fn().mockResolvedValue(undefined);

    mockedCreateToolProviders
      .mockReturnValueOnce([mockProvider({ dispose: firstDispose })])
      .mockReturnValueOnce([mockProvider({ dispose: secondDispose })]);

    const client = new AiClient({});
    await client.loadRemoteTools({});
    await client.loadRemoteTools({});

    expect(firstDispose).toHaveBeenCalledTimes(1);
    expect(secondDispose).not.toHaveBeenCalled();
    expect(mockedCreateToolProviders).toHaveBeenCalledTimes(2);
  });

  it('passes the logger to createToolProviders', async () => {
    const logger: Logger = jest.fn();
    mockedCreateToolProviders.mockReturnValue([]);

    const client = new AiClient({ logger });
    await client.loadRemoteTools({});

    expect(mockedCreateToolProviders).toHaveBeenCalledWith({}, logger);
  });

  it('logs and continues when disposing a previous provider fails', async () => {
    const logger: Logger = jest.fn();
    const closeError = new Error('Close failed');

    mockedCreateToolProviders
      .mockReturnValueOnce([mockProvider({ dispose: jest.fn().mockRejectedValue(closeError) })])
      .mockReturnValueOnce([
        mockProvider({ loadTools: jest.fn().mockResolvedValue([{ name: 'next' }]) }),
      ]);

    const client = new AiClient({ logger });
    await client.loadRemoteTools({});
    const result = await client.loadRemoteTools({});

    expect(result).toEqual([{ name: 'next' }]);
    expect(logger).toHaveBeenCalledWith(
      'Error',
      'Error closing previous remote tool connection',
      closeError,
    );
  });

  it('does not retain providers when loadTools fails', async () => {
    const dispose = jest.fn().mockResolvedValue(undefined);
    const loadError = new Error('loadTools failed');
    mockedCreateToolProviders.mockReturnValue([
      mockProvider({ loadTools: jest.fn().mockRejectedValue(loadError), dispose }),
    ]);

    const client = new AiClient({});
    await expect(client.loadRemoteTools({})).rejects.toThrow(loadError);

    // closeConnections must be a no-op since providers were never stored.
    await expect(client.closeConnections()).resolves.toBeUndefined();
    expect(dispose).not.toHaveBeenCalled();
  });
});

describe('closeConnections', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('disposes every stored provider', async () => {
    const firstDispose = jest.fn().mockResolvedValue(undefined);
    const secondDispose = jest.fn().mockResolvedValue(undefined);
    mockedCreateToolProviders.mockReturnValue([
      mockProvider({ dispose: firstDispose }),
      mockProvider({ dispose: secondDispose }),
    ]);

    const client = new AiClient({});
    await client.loadRemoteTools({});

    await client.closeConnections();

    expect(firstDispose).toHaveBeenCalledTimes(1);
    expect(secondDispose).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when no providers have been loaded', async () => {
    const client = new AiClient({});

    await expect(client.closeConnections()).resolves.toBeUndefined();
  });

  it('logs and clears the reference when dispose throws', async () => {
    const logger: Logger = jest.fn();
    const closeError = new Error('close failed');
    const dispose = jest.fn().mockRejectedValue(closeError);
    mockedCreateToolProviders.mockReturnValue([mockProvider({ dispose })]);

    const client = new AiClient({ logger });
    await client.loadRemoteTools({});

    await client.closeConnections();

    expect(logger).toHaveBeenCalledWith(
      'Error',
      'Error during remote tool connection cleanup',
      closeError,
    );

    // Second call is a no-op because the reference was cleared.
    await expect(client.closeConnections()).resolves.toBeUndefined();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('wraps non-Error rejections during cleanup', async () => {
    const logger: Logger = jest.fn();
    mockedCreateToolProviders.mockReturnValue([
      mockProvider({ dispose: jest.fn().mockRejectedValue('string error') }),
    ]);

    const client = new AiClient({ logger });
    await client.loadRemoteTools({});

    await client.closeConnections();

    expect(logger).toHaveBeenCalledWith(
      'Error',
      'Error during remote tool connection cleanup',
      expect.objectContaining({ message: 'string error' }),
    );
  });

  it('is safe to call twice', async () => {
    const dispose = jest.fn().mockResolvedValue(undefined);
    mockedCreateToolProviders.mockReturnValue([mockProvider({ dispose })]);

    const client = new AiClient({});
    await client.loadRemoteTools({});

    await client.closeConnections();
    await client.closeConnections();

    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
