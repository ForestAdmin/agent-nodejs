import type { AiConfiguration } from '../src/provider';

import { createAiProvider } from '../src/create-ai-provider';
import { Router } from '../src/router';

jest.mock('../src/router');

const routeMock = jest.fn();
jest.mocked(Router).mockImplementation(() => ({ route: routeMock } as any));

describe('createAiProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const config: AiConfiguration = {
    name: 'my-ai',
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: 'test-key',
  };

  test('should return providers array from config', () => {
    const result = createAiProvider(config);

    expect(result.providers).toEqual([{ name: 'my-ai', provider: 'openai', model: 'gpt-4o' }]);
  });

  test('init should create a Router with the config and logger', () => {
    const provider = createAiProvider(config);
    const mockLogger = jest.fn();
    provider.init(mockLogger);

    expect(Router).toHaveBeenCalledWith({
      aiConfigurations: [config],
      logger: mockLogger,
    });
  });

  test('init should return an AiRouter with a route method', () => {
    const provider = createAiProvider(config);
    const result = provider.init(jest.fn());

    expect(typeof result.route).toBe('function');
  });

  describe('route wrapper', () => {
    test('should pass route, body, query to underlying Router', async () => {
      routeMock.mockResolvedValue({ result: 'ok' });
      const provider = createAiProvider(config);
      const aiRouter = provider.init(jest.fn());

      const result = await aiRouter.route({
        route: 'ai-query',
        body: { messages: [] },
        query: { 'ai-name': 'my-ai' },
      });

      expect(routeMock).toHaveBeenCalledWith({
        route: 'ai-query',
        body: { messages: [] },
        query: { 'ai-name': 'my-ai' },
        mcpConfigs: undefined,
      });
      expect(result).toEqual({ result: 'ok' });
    });

    test('should pass mcpServerConfigs as mcpConfigs to Router when no headers', async () => {
      routeMock.mockResolvedValue({});
      const provider = createAiProvider(config);
      const aiRouter = provider.init(jest.fn());

      await aiRouter.route({
        route: 'remote-tools',
        mcpServerConfigs: { configs: { server1: { command: 'test', args: [] } } },
      });

      expect(routeMock).toHaveBeenCalledWith({
        route: 'remote-tools',
        body: undefined,
        query: undefined,
        mcpConfigs: { configs: { server1: { command: 'test', args: [] } } },
      });
    });

    test('should inject OAuth tokens from headers into mcpConfigs', async () => {
      routeMock.mockResolvedValue({});
      const provider = createAiProvider(config);
      const aiRouter = provider.init(jest.fn());
      const oauthTokens = JSON.stringify({ server1: 'Bearer token123' });

      await aiRouter.route({
        route: 'remote-tools',
        mcpServerConfigs: {
          configs: { server1: { type: 'http', url: 'https://server1.com' } },
        },
        headers: { 'x-mcp-oauth-tokens': oauthTokens },
      });

      expect(routeMock).toHaveBeenCalledWith({
        route: 'remote-tools',
        body: undefined,
        query: undefined,
        mcpConfigs: {
          configs: {
            server1: {
              type: 'http',
              url: 'https://server1.com',
              headers: { Authorization: 'Bearer token123' },
            },
          },
        },
      });
    });

    test('should pass mcpConfigs as undefined when no mcpServerConfigs provided', async () => {
      routeMock.mockResolvedValue({});
      const provider = createAiProvider(config);
      const aiRouter = provider.init(jest.fn());

      await aiRouter.route({ route: 'remote-tools' });

      expect(routeMock).toHaveBeenCalledWith({
        route: 'remote-tools',
        body: undefined,
        query: undefined,
        mcpConfigs: undefined,
      });
    });
  });
});
