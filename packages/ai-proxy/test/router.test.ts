import type { DispatchBody, InvokeRemoteToolArgs, Route } from '../src';
import type { Logger } from '@forestadmin/datasource-toolkit';

import { AIModelNotSupportedError, Router } from '../src';
import McpClient from '../src/mcp-client';

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
    ProviderDispatcher: jest.fn().mockImplementation(() => ({
      dispatch: dispatchMock,
    })),
  };
});

// eslint-disable-next-line import/first
import { ProviderDispatcher } from '../src/provider-dispatcher';

const ProviderDispatcherMock = ProviderDispatcher as jest.MockedClass<typeof ProviderDispatcher>;

jest.mock('../src/mcp-client', () => {
  return jest.fn().mockImplementation(() => ({
    loadTools: jest.fn().mockResolvedValue([]),
    closeConnections: jest.fn(),
  }));
});

const MockedMcpClient = McpClient as jest.MockedClass<typeof McpClient>;

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
      const router = new Router({
        aiConfigurations: [
          {
            name: 'gpt4',
            provider: 'openai',
            apiKey: 'dev',
            model: 'gpt-4o',
          },
        ],
        logger: mockLogger,
      });

      await router.route({
        route: 'ai-query',
        query: { 'ai-name': 'non-existent' },
        body: { tools: [], tool_choice: 'required', messages: [] } as unknown as DispatchBody,
      });

      expect(mockLogger).toHaveBeenCalledWith(
        'Warn',
        "AI configuration 'non-existent' not found. Falling back to 'gpt4'.",
      );
      expect(dispatchMock).toHaveBeenCalled();
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
        'gpt-5',
        'o1',
        'o3-mini',
        'unknown-model',
        'future-gpt-model',
      ];

      it.each(supportedModels)('%s', model => {
        expect(
          () =>
            new Router({
              aiConfigurations: [
                { name: 'test', provider: 'openai', apiKey: 'dev', model },
              ],
            }),
        ).not.toThrow();
      });
    });

    describe('should reject known unsupported models', () => {
      const unsupportedModels = [
        'gpt-4',
        'gpt-4-0613',
        'gpt-3.5-turbo',
        'gpt-3.5-turbo-0125',
        'gpt-3.5',
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
              aiConfigurations: [
                { name: 'test', provider: 'openai', apiKey: 'dev', model },
              ],
            }),
        ).toThrow(AIModelNotSupportedError);
      });
    });
  });
});
