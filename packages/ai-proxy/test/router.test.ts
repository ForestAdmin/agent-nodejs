import type { DispatchBody, InvokeRemoteToolArgs } from '../src';
import type { ToolProvider } from '../src/tool-provider';

import { AIModelNotSupportedError, Router } from '../src';
import BraveToolProvider from '../src/integrations/brave/brave-tool-provider';
import ProviderDispatcher from '../src/provider-dispatcher';
import { createToolProviders } from '../src/tool-provider-factory';

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

jest.mock('../src/tool-provider-factory');

jest.mock('../src/integrations/brave/brave-tool-provider', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      loadTools: jest.fn().mockResolvedValue([]),
      checkConnection: jest.fn().mockResolvedValue(true),
      dispose: jest.fn().mockResolvedValue(undefined),
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

function createMockToolProvider(overrides?: Partial<ToolProvider>): ToolProvider {
  return {
    loadTools: jest.fn().mockResolvedValue([]),
    checkConnection: jest.fn().mockResolvedValue(true),
    dispose: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(createToolProviders).mockReturnValue([]);
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

      expect(invokeToolMock).toHaveBeenCalledWith('tool-name', [], undefined);
    });

    it('passes source-id query parameter to invokeTool', async () => {
      const router = new Router({});

      await router.route({
        route: 'invoke-remote-tool',
        query: { 'tool-name': 'tool-name', 'source-id': 'slack' },
        body: { inputs: [] },
      });

      expect(invokeToolMock).toHaveBeenCalledWith('tool-name', [], 'slack');
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
  });

  describe('ToolProvider lifecycle', () => {
    const dummyMcpServerConfigs = { server: { url: 'http://localhost', type: 'http' as const } };

    it('calls loadTools on all provided tool providers', async () => {
      const provider1 = createMockToolProvider();
      const provider2 = createMockToolProvider();
      jest.mocked(createToolProviders).mockReturnValue([provider1, provider2]);
      const router = new Router({});

      await router.route({
        route: 'remote-tools',
        toolConfigs: dummyMcpServerConfigs,
      });

      expect(provider1.loadTools).toHaveBeenCalledTimes(1);
      expect(provider2.loadTools).toHaveBeenCalledTimes(1);
    });

    it('disposes all providers after successful route handling', async () => {
      const provider = createMockToolProvider();
      jest.mocked(createToolProviders).mockReturnValue([provider]);
      const router = new Router({});

      await router.route({
        route: 'remote-tools',
        toolConfigs: dummyMcpServerConfigs,
      });

      expect(provider.dispose).toHaveBeenCalledTimes(1);
    });

    it('disposes all providers even when an error occurs', async () => {
      const provider = createMockToolProvider();
      jest.mocked(createToolProviders).mockReturnValue([provider]);
      const router = new Router({});
      dispatchMock.mockRejectedValue(new Error('AI dispatch error'));

      await expect(
        router.route({
          route: 'ai-query',
          body: { messages: [] },
          toolConfigs: dummyMcpServerConfigs,
        }),
      ).rejects.toThrow();

      expect(provider.dispose).toHaveBeenCalledTimes(1);
    });

    it('works with no tool providers', async () => {
      jest.mocked(createToolProviders).mockReturnValue([]);
      const router = new Router({});

      const result = await router.route({ route: 'remote-tools' });

      expect(result).toEqual(toolDefinitionsForFrontend);
    });

    it('preserves original error when dispose fails', async () => {
      const dispatchError = new Error('Dispatch failed');
      const provider = createMockToolProvider({
        dispose: jest.fn().mockRejectedValue(new Error('Dispose failed')),
      });
      jest.mocked(createToolProviders).mockReturnValue([provider]);
      const router = new Router({});
      dispatchMock.mockRejectedValue(dispatchError);

      await expect(
        router.route({
          route: 'ai-query',
          body: { messages: [] },
          toolConfigs: dummyMcpServerConfigs,
        }),
      ).rejects.toThrow(dispatchError);
    });
  });

  describe('Local tool providers', () => {
    it('creates a BraveToolProvider when API key is provided', () => {
      // eslint-disable-next-line no-new
      new Router({
        localToolsApiKeys: { AI_REMOTE_TOOL_BRAVE_SEARCH_API_KEY: 'test-key' },
      });

      expect(BraveToolProvider).toHaveBeenCalledWith({ apiKey: 'test-key' });
    });

    it('does not create BraveToolProvider when no API key', () => {
      // eslint-disable-next-line no-new
      new Router({});

      expect(BraveToolProvider).not.toHaveBeenCalled();
    });

    it('does not dispose local tool providers after a request', async () => {
      const router = new Router({
        localToolsApiKeys: { AI_REMOTE_TOOL_BRAVE_SEARCH_API_KEY: 'test-key' },
      });

      const braveInstance = jest.mocked(BraveToolProvider).mock.results[0].value;

      await router.route({ route: 'remote-tools' });

      expect(braveInstance.dispose).not.toHaveBeenCalled();
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
