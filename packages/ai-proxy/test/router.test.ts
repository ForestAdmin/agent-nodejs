import type { DispatchBody, InvokeRemoteToolArgs } from '../src';
import type { Logger } from '@forestadmin/datasource-toolkit';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

import { AIModelNotSupportedError, AINotConfiguredError, Router } from '../src';
import McpClient from '../src/mcp-client';
import ProviderDispatcher from '../src/provider-dispatcher';

const invokeToolMock = jest.fn();
const toolDefinitionsForFrontend = [{ name: 'tool-name', description: 'tool-description' }];

jest.mock('../src/remote-tools', () => {
  return {
    RemoteTools: jest.fn().mockImplementation(() => ({
      tools: [],
      toolDefinitionsForFrontend,
      invokeTool: invokeToolMock,
    })),
  };
});

const dispatchMock = jest.fn();
jest.mock('../src/provider-dispatcher', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      dispatch: dispatchMock,
    })),
  };
});

const ProviderDispatcherMock = ProviderDispatcher as jest.MockedClass<typeof ProviderDispatcher>;

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

describe('route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when the route is /ai-query', () => {
    it('calls the provider dispatcher', async () => {
      const router = new Router({
        aiConfigurations: [
          {
            name: 'gpt4',
            provider: 'openai',
            apiKey: 'dev',
            model: 'gpt-4o',
          },
        ],
      });

      await router.route({
        route: 'ai-query',
        body: { tools: [], tool_choice: 'required', messages: [] } as unknown as DispatchBody,
      });

      expect(dispatchMock).toHaveBeenCalledWith({
        tools: [],
        tool_choice: 'required',
        messages: [],
      });
    });

    it('selects the AI configuration by name when ai-name query is provided', async () => {
      const gpt4Config = {
        name: 'gpt4',
        provider: 'openai' as const,
        apiKey: 'dev',
        model: 'gpt-4o',
      };
      const gpt4MiniConfig = {
        name: 'gpt4mini',
        provider: 'openai' as const,
        apiKey: 'dev',
        model: 'gpt-4o-mini',
      };
      const router = new Router({
        aiConfigurations: [gpt4Config, gpt4MiniConfig],
      });

      await router.route({
        route: 'ai-query',
        query: { 'ai-name': 'gpt4mini' },
        body: { tools: [], tool_choice: 'required', messages: [] } as unknown as DispatchBody,
      });

      expect(ProviderDispatcherMock).toHaveBeenCalledWith(gpt4MiniConfig, expect.anything());
    });

    it('uses first configuration when ai-name query is not provided', async () => {
      const gpt4Config = {
        name: 'gpt4',
        provider: 'openai' as const,
        apiKey: 'dev',
        model: 'gpt-4o',
      };
      const gpt4MiniConfig = {
        name: 'gpt4mini',
        provider: 'openai' as const,
        apiKey: 'dev',
        model: 'gpt-4o-mini',
      };
      const router = new Router({
        aiConfigurations: [gpt4Config, gpt4MiniConfig],
      });

      await router.route({
        route: 'ai-query',
        body: { tools: [], tool_choice: 'required', messages: [] } as unknown as DispatchBody,
      });

      expect(ProviderDispatcherMock).toHaveBeenCalledWith(gpt4Config, expect.anything());
    });

    it('falls back to first configuration with warning when ai-name not found', async () => {
      const mockLogger = jest.fn();
      const gpt4Config = {
        name: 'gpt4',
        provider: 'openai' as const,
        apiKey: 'dev',
        model: 'gpt-4o',
      };
      const router = new Router({
        aiConfigurations: [gpt4Config],
        logger: mockLogger,
      });

      await router.route({
        route: 'ai-query',
        query: { 'ai-name': 'non-existent' },
        body: { tools: [], tool_choice: 'required', messages: [] } as unknown as DispatchBody,
      });

      expect(mockLogger).toHaveBeenCalledWith(
        'Warn',
        "AI configuration 'non-existent' not found. Falling back to 'gpt4' (provider: openai, model: gpt-4o)",
      );
      expect(ProviderDispatcherMock).toHaveBeenCalledWith(gpt4Config, expect.anything());
    });
  });

  describe('when the route is /invoke-remote-tool', () => {
    it('calls the remote tools', async () => {
      const router = new Router({});

      await router.route({
        route: 'invoke-remote-tool',
        query: { 'tool-name': 'tool-name' },
        body: { inputs: [] },
      });

      expect(invokeToolMock).toHaveBeenCalledWith('tool-name', []);
    });

    it('throws an error when tool-name query parameter is missing', async () => {
      const router = new Router({});

      await expect(
        router.route({
          route: 'invoke-remote-tool',
          query: {},
          body: { inputs: [] },
        } as any),
      ).rejects.toThrow('query.tool-name: Missing required query parameter: tool-name');
    });

    it('throws an error when body.inputs is missing', async () => {
      const router = new Router({});

      await expect(
        router.route({
          route: 'invoke-remote-tool',
          query: { 'tool-name': 'tool-name' },
          body: {} as InvokeRemoteToolArgs['body'],
        }),
      ).rejects.toThrow('body.inputs: Missing required body parameter: inputs');
    });

    it('joins multiple validation errors with semicolons', async () => {
      const router = new Router({});

      await expect(
        router.route({
          route: 'invoke-remote-tool',
          query: {},
          body: {},
        } as any),
      ).rejects.toThrow(/tool-name.*;.*inputs|inputs.*;.*tool-name/);
    });
  });

  describe('when the route is /remote-tools', () => {
    it('returns the remote tools definitions', async () => {
      const router = new Router({});

      const result = await router.route({ route: 'remote-tools' });

      expect(result).toEqual(toolDefinitionsForFrontend);
    });
  });

  describe('when the route is unknown', () => {
    it('throws a validation error with helpful message', async () => {
      const router = new Router({});

      await expect(router.route({ route: 'unknown' } as any)).rejects.toThrow(
        "Invalid route. Expected: 'ai-query', 'invoke-remote-tool', 'remote-tools'",
      );
    });

    it('does not include mcpConfigs in the error message', async () => {
      const router = new Router({});

      await expect(
        router.route({
          route: 'unknown',
          mcpConfigs: { configs: {} },
        } as any),
      ).rejects.toThrow(
        "Invalid route. Expected: 'ai-query', 'invoke-remote-tool', 'remote-tools'",
      );
    });
  });

  describe('MCP connection cleanup', () => {
    it('closes the MCP connection after successful route handling', async () => {
      const router = new Router({});

      await router.route({
        route: 'remote-tools',
        mcpConfigs: { configs: { server1: { command: 'test', args: [] } } },
      });

      expect(MockedMcpClient).toHaveBeenCalledTimes(1);
      const mcpClientInstance = MockedMcpClient.mock.results[0].value as jest.Mocked<McpClient>;
      expect(mcpClientInstance.closeConnections).toHaveBeenCalledTimes(1);
    });

    it('closes the MCP connection even when an error occurs', async () => {
      const router = new Router({});

      // Validation errors happen before MCP client creation, so we test with a valid route
      // that causes an error after MCP client is created
      dispatchMock.mockRejectedValue(new Error('AI dispatch error'));

      await expect(
        router.route({
          route: 'ai-query',
          body: { messages: [] },
          mcpConfigs: { configs: { server1: { command: 'test', args: [] } } },
        } as any),
      ).rejects.toThrow();

      expect(MockedMcpClient).toHaveBeenCalledTimes(1);
      const mcpClientInstance = MockedMcpClient.mock.results[0].value as jest.Mocked<McpClient>;
      expect(mcpClientInstance.closeConnections).toHaveBeenCalledTimes(1);
    });

    it('does not call closeConnections when no mcpConfigs provided', async () => {
      const router = new Router({});

      await router.route({
        route: 'remote-tools',
      });

      expect(MockedMcpClient).not.toHaveBeenCalled();
    });

    it('does not throw when closeConnections fails during successful route', async () => {
      const mockLogger = jest.fn();
      const router = new Router({
        logger: mockLogger,
      });
      const closeError = new Error('Cleanup failed');

      jest.mocked(McpClient).mockImplementation(
        () =>
          ({
            loadTools: jest.fn().mockResolvedValue([]),
            closeConnections: jest.fn().mockRejectedValue(closeError),
          } as unknown as McpClient),
      );

      // Should not throw even though cleanup fails
      const result = await router.route({
        route: 'remote-tools',
        mcpConfigs: { configs: { server1: { command: 'test', args: [] } } },
      });

      expect(result).toBeDefined();
      expect(mockLogger).toHaveBeenCalledWith(
        'Error',
        'Error during MCP connection cleanup',
        closeError,
      );
    });

    it('preserves original error when both route and cleanup fail', async () => {
      const mockLogger = jest.fn();
      const router = new Router({
        logger: mockLogger,
      });
      const closeError = new Error('Cleanup failed');
      const dispatchError = new Error('Dispatch failed');

      jest.mocked(McpClient).mockImplementation(
        () =>
          ({
            loadTools: jest.fn().mockResolvedValue([]),
            closeConnections: jest.fn().mockRejectedValue(closeError),
          } as unknown as McpClient),
      );
      dispatchMock.mockRejectedValue(dispatchError);

      // Should throw the original route error, not the cleanup error
      await expect(
        router.route({
          route: 'ai-query',
          body: { messages: [] },
          mcpConfigs: { configs: { server1: { command: 'test', args: [] } } },
        } as any),
      ).rejects.toThrow(dispatchError);

      // Cleanup error should be logged
      expect(mockLogger).toHaveBeenCalledWith(
        'Error',
        'Error during MCP connection cleanup',
        closeError,
      );
    });
  });

  describe('Logger injection', () => {
    it('uses the injected logger instead of console', async () => {
      const customLogger: Logger = jest.fn();
      const router = new Router({
        logger: customLogger,
      });
      const closeError = new Error('Cleanup failed');

      jest.mocked(McpClient).mockImplementation(
        () =>
          ({
            loadTools: jest.fn().mockResolvedValue([]),
            closeConnections: jest.fn().mockRejectedValue(closeError),
          } as unknown as McpClient),
      );

      await router.route({
        route: 'remote-tools',
        mcpConfigs: { configs: { server1: { command: 'test', args: [] } } },
      });

      // Custom logger should be called
      expect(customLogger).toHaveBeenCalledWith(
        'Error',
        'Error during MCP connection cleanup',
        closeError,
      );
    });

    it('passes logger to McpClient', async () => {
      const customLogger: Logger = jest.fn();
      const router = new Router({
        logger: customLogger,
      });

      await router.route({
        route: 'remote-tools',
        mcpConfigs: { configs: { server1: { command: 'test', args: [] } } },
      });

      expect(MockedMcpClient).toHaveBeenCalledWith(
        { configs: { server1: { command: 'test', args: [] } } },
        customLogger,
      );
    });
  });

  describe('Model validation', () => {
    it('throws AIModelNotSupportedError when model does not support tools', () => {
      expect(
        () =>
          new Router({
            aiConfigurations: [
              {
                name: 'test',
                provider: 'openai',
                apiKey: 'dev',
                model: 'gpt-4', // Known unsupported model
              },
            ],
          }),
      ).toThrow(AIModelNotSupportedError);
    });

    it('throws with helpful error message including model name', () => {
      expect(
        () =>
          new Router({
            aiConfigurations: [
              {
                name: 'test',
                provider: 'openai',
                apiKey: 'dev',
                model: 'text-davinci-003',
              },
            ],
          }),
      ).toThrow("Model 'text-davinci-003' does not support tools");
    });

    it('validates all configurations, not just the first', () => {
      expect(
        () =>
          new Router({
            aiConfigurations: [
              { name: 'valid', provider: 'openai', apiKey: 'dev', model: 'gpt-4o' },
              { name: 'invalid', provider: 'openai', apiKey: 'dev', model: 'gpt-4' },
            ],
          }),
      ).toThrow("Model 'gpt-4' does not support tools");
    });

    describe('should accept supported models', () => {
      const supportedModels = [
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4o-2024-08-06',
        'gpt-4-turbo',
        'gpt-4-turbo-2024-04-09',
        'gpt-4.1',
        'gpt-4.1-mini',
        'gpt-3.5-turbo',
        'gpt-3.5-turbo-0125',
        'gpt-3.5',
        'gpt-5',
        'unknown-model',
        'future-gpt-model',
      ];

      it.each(supportedModels)('%s', model => {
        expect(
          () =>
            new Router({
              aiConfigurations: [{ name: 'test', provider: 'openai', apiKey: 'dev', model }],
            }),
        ).not.toThrow();
      });
    });

    it('should accept supported Anthropic configurations', () => {
      expect(
        () =>
          new Router({
            aiConfigurations: [
              {
                name: 'claude',
                provider: 'anthropic',
                apiKey: 'key',
                model: 'claude-3-5-sonnet-latest',
              },
            ],
          }),
      ).not.toThrow();
    });

    describe('should reject known unsupported OpenAI models', () => {
      const unsupportedModels = [
        'gpt-4',
        'gpt-4-0613',
        'o1',
        'o3-mini',
        'text-davinci-003',
        'davinci',
        'curie',
        'babbage',
        'ada',
      ];

      it.each(unsupportedModels)('%s', model => {
        expect(
          () =>
            new Router({
              aiConfigurations: [{ name: 'test', provider: 'openai', apiKey: 'dev', model }],
            }),
        ).toThrow(AIModelNotSupportedError);
      });
    });

    describe('should reject deprecated Anthropic models', () => {
      const deprecatedModels = ['claude-3-7-sonnet-20250219', 'claude-3-haiku-20240307'];

      it.each(deprecatedModels)('%s', model => {
        expect(
          () =>
            new Router({
              aiConfigurations: [{ name: 'test', provider: 'anthropic', apiKey: 'dev', model }],
            }),
        ).toThrow(AIModelNotSupportedError);
      });
    });
  });
});

describe('getModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a BaseChatModel by calling createBaseChatModel', () => {
    const fakeModel = { fake: true } as unknown as BaseChatModel;
    createBaseChatModelMock.mockReturnValue(fakeModel);

    const router = new Router({
      aiConfigurations: [{ name: 'gpt4', provider: 'openai', apiKey: 'dev', model: 'gpt-4o' }],
    });

    const result = router.getModel('gpt4');

    expect(createBaseChatModelMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'gpt4', provider: 'openai', model: 'gpt-4o' }),
    );
    expect(result).toBe(fakeModel);
  });

  it('returns cached instance on second call with same name', () => {
    const fakeModel = { fake: true } as unknown as BaseChatModel;
    createBaseChatModelMock.mockReturnValue(fakeModel);

    const router = new Router({
      aiConfigurations: [{ name: 'gpt4', provider: 'openai', apiKey: 'dev', model: 'gpt-4o' }],
    });

    const first = router.getModel('gpt4');
    const second = router.getModel('gpt4');

    expect(first).toBe(second);
    expect(createBaseChatModelMock).toHaveBeenCalledTimes(1);
  });

  it('uses first configuration when aiName is not provided', () => {
    const fakeModel = { fake: true } as unknown as BaseChatModel;
    createBaseChatModelMock.mockReturnValue(fakeModel);

    const router = new Router({
      aiConfigurations: [
        { name: 'gpt4', provider: 'openai', apiKey: 'dev', model: 'gpt-4o' },
        { name: 'gpt4mini', provider: 'openai', apiKey: 'dev', model: 'gpt-4o-mini' },
      ],
    });

    router.getModel();

    expect(createBaseChatModelMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'gpt4', model: 'gpt-4o' }),
    );
  });

  it('throws AINotConfiguredError when aiConfigurations is empty', () => {
    const router = new Router({});

    expect(() => router.getModel()).toThrow(AINotConfiguredError);
  });

  it('creates separate cached instances for different AI names', () => {
    const fakeModel1 = { id: 1 } as unknown as BaseChatModel;
    const fakeModel2 = { id: 2 } as unknown as BaseChatModel;
    createBaseChatModelMock.mockReturnValueOnce(fakeModel1).mockReturnValueOnce(fakeModel2);

    const router = new Router({
      aiConfigurations: [
        { name: 'gpt4', provider: 'openai', apiKey: 'dev', model: 'gpt-4o' },
        { name: 'gpt4mini', provider: 'openai', apiKey: 'dev', model: 'gpt-4o-mini' },
      ],
    });

    const result1 = router.getModel('gpt4');
    const result2 = router.getModel('gpt4mini');

    expect(result1).not.toBe(result2);
    expect(createBaseChatModelMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to first config and caches by resolved name', () => {
    const fakeModel = { fake: true } as unknown as BaseChatModel;
    createBaseChatModelMock.mockReturnValue(fakeModel);
    const mockLogger = jest.fn();

    const router = new Router({
      aiConfigurations: [{ name: 'gpt4', provider: 'openai', apiKey: 'dev', model: 'gpt-4o' }],
      logger: mockLogger,
    });

    const result = router.getModel('non-existent');

    expect(mockLogger).toHaveBeenCalledWith(
      'Warn',
      expect.stringContaining("AI configuration 'non-existent' not found"),
    );
    expect(createBaseChatModelMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'gpt4' }),
    );
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

    const router = new Router({});
    const mcpConfig = { configs: { server1: { command: 'test', args: [] } } };

    const result = await router.loadRemoteTools(mcpConfig);

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

    const router = new Router({});
    const mcpConfig = { configs: { server1: { command: 'test', args: [] } } };

    await router.loadRemoteTools(mcpConfig);
    await router.loadRemoteTools(mcpConfig);

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

    const router = new Router({ logger: customLogger });
    const mcpConfig = { configs: { server1: { command: 'test', args: [] } } };

    await router.loadRemoteTools(mcpConfig);

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

    const router = new Router({ logger: mockLogger });
    const mcpConfig = { configs: { server1: { command: 'test', args: [] } } };

    await router.loadRemoteTools(mcpConfig);
    const result = await router.loadRemoteTools(mcpConfig);

    expect(result).toBe(fakeTools);
    expect(MockedMcpClient).toHaveBeenCalledTimes(2);
    expect(mockLogger).toHaveBeenCalledWith(
      'Error',
      'Error closing previous MCP connection',
      closeError,
    );
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

    const router = new Router({});
    await router.loadRemoteTools({ configs: { server1: { command: 'test', args: [] } } });

    await router.closeConnections();

    expect(closeConnectionsMock).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when no McpClient exists', async () => {
    const router = new Router({});

    await expect(router.closeConnections()).resolves.toBeUndefined();
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

    const router = new Router({ logger: mockLogger });
    await router.loadRemoteTools({ configs: { server1: { command: 'test', args: [] } } });

    // Should not throw — error is caught and logged
    await router.closeConnections();

    expect(mockLogger).toHaveBeenCalledWith(
      'Error',
      'Error during MCP connection cleanup',
      closeError,
    );

    // Second call should be a no-op (reference cleared in finally block)
    await expect(router.closeConnections()).resolves.toBeUndefined();
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

    const router = new Router({});
    await router.loadRemoteTools({ configs: { server1: { command: 'test', args: [] } } });

    await router.closeConnections();
    await router.closeConnections();

    expect(closeConnectionsMock).toHaveBeenCalledTimes(1);
  });
});
