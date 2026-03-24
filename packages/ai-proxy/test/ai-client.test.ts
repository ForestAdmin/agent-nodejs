import type { Logger } from '@forestadmin/datasource-toolkit';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

import { AIModelNotSupportedError, AINotConfiguredError, AiClient } from '../src';
import McpClient from '../src/mcp-client';

jest.mock('../src/mcp-client', () => {
  return jest.fn().mockImplementation(() => ({
    loadTools: jest.fn().mockResolvedValue([]),
    closeConnections: jest.fn(),
  }));
});

const MockedMcpClient = McpClient as jest.MockedClass<typeof McpClient>;

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

  it('creates an McpClient and returns loaded tools', async () => {
    const fakeTools = [{ name: 'tool1' }];
    jest.mocked(McpClient).mockImplementation(
      () =>
        ({
          loadTools: jest.fn().mockResolvedValue(fakeTools),
          closeConnections: jest.fn(),
        } as unknown as McpClient),
    );

    const client = new AiClient({});
    const mcpConfig = { configs: { server1: { command: 'test', args: [] } } };

    const result = await client.loadRemoteTools(mcpConfig);

    expect(MockedMcpClient).toHaveBeenCalledWith(mcpConfig, undefined);
    expect(result).toBe(fakeTools);
  });

  it('closes previous client before creating a new one', async () => {
    const closeConnectionsMock1 = jest.fn();
    const closeConnectionsMock2 = jest.fn();

    jest
      .mocked(McpClient)
      .mockImplementationOnce(
        () =>
          ({
            loadTools: jest.fn().mockResolvedValue([]),
            closeConnections: closeConnectionsMock1,
          } as unknown as McpClient),
      )
      .mockImplementationOnce(
        () =>
          ({
            loadTools: jest.fn().mockResolvedValue([]),
            closeConnections: closeConnectionsMock2,
          } as unknown as McpClient),
      );

    const client = new AiClient({});
    const mcpConfig = { configs: { server1: { command: 'test', args: [] } } };

    await client.loadRemoteTools(mcpConfig);
    await client.loadRemoteTools(mcpConfig);

    expect(closeConnectionsMock1).toHaveBeenCalledTimes(1);
    expect(MockedMcpClient).toHaveBeenCalledTimes(2);
  });

  it('passes the logger to McpClient', async () => {
    const customLogger: Logger = jest.fn();
    jest.mocked(McpClient).mockImplementation(
      () =>
        ({
          loadTools: jest.fn().mockResolvedValue([]),
          closeConnections: jest.fn(),
        } as unknown as McpClient),
    );

    const client = new AiClient({ logger: customLogger });
    const mcpConfig = { configs: { server1: { command: 'test', args: [] } } };

    await client.loadRemoteTools(mcpConfig);

    expect(MockedMcpClient).toHaveBeenCalledWith(mcpConfig, customLogger);
  });

  it('still creates a new client when closing the previous one fails', async () => {
    const mockLogger = jest.fn();
    const closeError = new Error('Close failed');
    const fakeTools = [{ name: 'tool1' }];

    jest
      .mocked(McpClient)
      .mockImplementationOnce(
        () =>
          ({
            loadTools: jest.fn().mockResolvedValue([]),
            closeConnections: jest.fn().mockRejectedValue(closeError),
          } as unknown as McpClient),
      )
      .mockImplementationOnce(
        () =>
          ({
            loadTools: jest.fn().mockResolvedValue(fakeTools),
            closeConnections: jest.fn(),
          } as unknown as McpClient),
      );

    const client = new AiClient({ logger: mockLogger });
    const mcpConfig = { configs: { server1: { command: 'test', args: [] } } };

    await client.loadRemoteTools(mcpConfig);
    const result = await client.loadRemoteTools(mcpConfig);

    expect(result).toBe(fakeTools);
    expect(MockedMcpClient).toHaveBeenCalledTimes(2);
    expect(mockLogger).toHaveBeenCalledWith(
      'Error',
      'Error closing previous MCP connection',
      closeError,
    );
  });

  it('wraps non-Error thrown values when closing previous client fails', async () => {
    const mockLogger = jest.fn();

    jest
      .mocked(McpClient)
      .mockImplementationOnce(
        () =>
          ({
            loadTools: jest.fn().mockResolvedValue([]),
            closeConnections: jest.fn().mockRejectedValue('string error'),
          } as unknown as McpClient),
      )
      .mockImplementationOnce(
        () =>
          ({
            loadTools: jest.fn().mockResolvedValue([]),
            closeConnections: jest.fn(),
          } as unknown as McpClient),
      );

    const client = new AiClient({ logger: mockLogger });
    const mcpConfig = { configs: { server1: { command: 'test', args: [] } } };

    await client.loadRemoteTools(mcpConfig);
    await client.loadRemoteTools(mcpConfig);

    expect(mockLogger).toHaveBeenCalledWith(
      'Error',
      'Error closing previous MCP connection',
      expect.objectContaining({ message: 'string error' }),
    );
  });

  it('does not store mcpClient reference when loadTools fails', async () => {
    const loadToolsError = new Error('loadTools failed');

    jest.mocked(McpClient).mockImplementation(
      () =>
        ({
          loadTools: jest.fn().mockRejectedValue(loadToolsError),
          closeConnections: jest.fn(),
        } as unknown as McpClient),
    );

    const client = new AiClient({});
    const mcpConfig = { configs: { server1: { command: 'test', args: [] } } };

    await expect(client.loadRemoteTools(mcpConfig)).rejects.toThrow(loadToolsError);

    // closeConnections should be a no-op since mcpClient was never stored
    await expect(client.closeConnections()).resolves.toBeUndefined();
  });
});

describe('closeConnections', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('closes the McpClient', async () => {
    const closeConnectionsMock = jest.fn();
    jest.mocked(McpClient).mockImplementation(
      () =>
        ({
          loadTools: jest.fn().mockResolvedValue([]),
          closeConnections: closeConnectionsMock,
        } as unknown as McpClient),
    );

    const client = new AiClient({});
    await client.loadRemoteTools({ configs: { server1: { command: 'test', args: [] } } });

    await client.closeConnections();

    expect(closeConnectionsMock).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when no McpClient exists', async () => {
    const client = new AiClient({});

    await expect(client.closeConnections()).resolves.toBeUndefined();
  });

  it('logs error and clears reference when closeConnections throws', async () => {
    const mockLogger = jest.fn();
    const closeError = new Error('close failed');
    jest.mocked(McpClient).mockImplementation(
      () =>
        ({
          loadTools: jest.fn().mockResolvedValue([]),
          closeConnections: jest.fn().mockRejectedValue(closeError),
        } as unknown as McpClient),
    );

    const client = new AiClient({ logger: mockLogger });
    await client.loadRemoteTools({ configs: { server1: { command: 'test', args: [] } } });

    // Should not throw — error is caught and logged
    await client.closeConnections();

    expect(mockLogger).toHaveBeenCalledWith(
      'Error',
      'Error during MCP connection cleanup',
      closeError,
    );

    // Second call should be a no-op (reference cleared in finally block)
    await expect(client.closeConnections()).resolves.toBeUndefined();
  });

  it('wraps non-Error thrown values during cleanup', async () => {
    const mockLogger = jest.fn();
    jest.mocked(McpClient).mockImplementation(
      () =>
        ({
          loadTools: jest.fn().mockResolvedValue([]),
          closeConnections: jest.fn().mockRejectedValue('string error'),
        } as unknown as McpClient),
    );

    const client = new AiClient({ logger: mockLogger });
    await client.loadRemoteTools({ configs: { server1: { command: 'test', args: [] } } });

    await client.closeConnections();

    expect(mockLogger).toHaveBeenCalledWith(
      'Error',
      'Error during MCP connection cleanup',
      expect.objectContaining({ message: 'string error' }),
    );
  });

  it('is safe to call twice', async () => {
    const closeConnectionsMock = jest.fn();
    jest.mocked(McpClient).mockImplementation(
      () =>
        ({
          loadTools: jest.fn().mockResolvedValue([]),
          closeConnections: closeConnectionsMock,
        } as unknown as McpClient),
    );

    const client = new AiClient({});
    await client.loadRemoteTools({ configs: { server1: { command: 'test', args: [] } } });

    await client.closeConnections();
    await client.closeConnections();

    expect(closeConnectionsMock).toHaveBeenCalledTimes(1);
  });
});
