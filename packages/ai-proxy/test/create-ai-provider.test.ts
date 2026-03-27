import type { AiConfiguration } from '../src/provider';

import { createAiProvider } from '../src/create-ai-provider';
import { Router } from '../src/router';
import { createToolProviders } from '../src/tool-provider-factory';

jest.mock('../src/router');
jest.mock('../src/tool-provider-factory');

const routeMock = jest.fn();
jest.mocked(Router).mockImplementation(() => ({ route: routeMock } as any));

describe('createAiProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(createToolProviders).mockReturnValue([]);
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

      expect(routeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          route: 'ai-query',
          body: { messages: [] },
          query: { 'ai-name': 'my-ai' },
          toolProviders: [],
        }),
      );
      expect(result).toEqual({ result: 'ok' });
    });

    test('should create tool providers from mcpServerConfigs', async () => {
      const mockProviders = [{ loadTools: jest.fn(), checkConnection: jest.fn(), dispose: jest.fn() }];
      jest.mocked(createToolProviders).mockReturnValue(mockProviders);
      routeMock.mockResolvedValue({});
      const provider = createAiProvider(config);
      const aiRouter = provider.init(jest.fn());

      await aiRouter.route({
        route: 'remote-tools',
        mcpServerConfigs: { configs: { server1: { command: 'test', args: [] } } },
      });

      expect(createToolProviders).toHaveBeenCalledWith(
        { server1: { command: 'test', args: [] } },
        expect.any(Function),
      );
      expect(routeMock).toHaveBeenCalledWith(
        expect.objectContaining({ toolProviders: mockProviders }),
      );
    });

    test('should inject OAuth tokens before creating tool providers', async () => {
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

      expect(createToolProviders).toHaveBeenCalledWith(
        {
          server1: {
            type: 'http',
            url: 'https://server1.com',
            headers: { Authorization: 'Bearer token123' },
          },
        },
        expect.any(Function),
      );
    });

    test('should throw AIBadRequestError when x-mcp-oauth-tokens header contains invalid JSON', () => {
      const provider = createAiProvider(config);
      const aiRouter = provider.init(jest.fn());

      expect(() =>
        aiRouter.route({
          route: 'remote-tools',
          mcpServerConfigs: {
            configs: { server1: { type: 'http', url: 'https://server1.com' } },
          },
          headers: { 'x-mcp-oauth-tokens': '{ invalid json }' },
        }),
      ).toThrow('Invalid JSON in x-mcp-oauth-tokens header');
    });

    test('should pass empty tool providers when no mcpServerConfigs provided', async () => {
      routeMock.mockResolvedValue({});
      const provider = createAiProvider(config);
      const aiRouter = provider.init(jest.fn());

      await aiRouter.route({ route: 'remote-tools' });

      expect(routeMock).toHaveBeenCalledWith(
        expect.objectContaining({ toolProviders: [] }),
      );
    });
  });
});
