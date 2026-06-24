import ServerAiAdapter from '../../src/adapters/server-ai-adapter';

const mockGetModel = jest.fn().mockReturnValue({ id: 'fake-model' });
const mockLoadRemoteTools = jest.fn().mockResolvedValue([]);
const mockCloseConnections = jest.fn().mockResolvedValue(undefined);
const mockAiClientConstructor = jest.fn();

jest.mock('@forestadmin/ai-proxy', () => ({
  AiClient: jest.fn().mockImplementation((...args: unknown[]) => {
    mockAiClientConstructor(...args);

    return {
      getModel: mockGetModel,
      loadRemoteTools: mockLoadRemoteTools,
      closeConnections: mockCloseConnections,
    };
  }),
}));

const ENV_SECRET = 'a'.repeat(64);

describe('ServerAiAdapter', () => {
  let adapter: ServerAiAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new ServerAiAdapter({
      forestServerUrl: 'https://api.forestadmin.com',
      envSecret: ENV_SECRET,
    });
  });

  const proxyConfig = () =>
    (mockAiClientConstructor.mock.calls[0][0] as { aiConfigurations: Record<string, unknown>[] })
      .aiConfigurations[0];

  // getModel builds its own AiClient per call; grab the most recent one's config.
  const latestProxyConfig = () => {
    const { calls } = mockAiClientConstructor.mock;

    return (calls[calls.length - 1][0] as { aiConfigurations: Record<string, unknown>[] })
      .aiConfigurations[0];
  };

  const captureFetchHeaders = (config: Record<string, unknown>): Headers => {
    const { fetch: customFetch } = config.configuration as {
      fetch: (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
    };

    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue(new Response('{}', { status: 200 }));

    try {
      customFetch('https://ignored.com/chat/completions', { method: 'POST', body: '{}' });

      return new Headers((global.fetch as jest.Mock).mock.calls[0][1].headers);
    } finally {
      global.fetch = originalFetch;
    }
  };

  describe('constructor', () => {
    it('configures AiClient with a single openai config targeting the FA server', () => {
      expect(proxyConfig()).toEqual(
        expect.objectContaining({
          name: 'forest-server',
          provider: 'openai',
          model: 'gpt-4.1',
          maxRetries: 2,
          configuration: expect.objectContaining({
            apiKey: 'unused',
            fetch: expect.any(Function),
          }),
        }),
      );
    });
  });

  describe('getModel', () => {
    it('delegates to the internal AiClient', () => {
      expect(adapter.getModel()).toEqual({ id: 'fake-model' });
      expect(mockGetModel).toHaveBeenCalled();
    });

    it('rewrites fetch to the proxy URL with forest-secret-key instead of Authorization', () => {
      const { fetch: customFetch } = proxyConfig().configuration as {
        fetch: (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
      };

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue(new Response('{}', { status: 200 }));

      try {
        customFetch('https://ignored.com/chat/completions', {
          method: 'POST',
          body: '{}',
          headers: { Authorization: 'Bearer unused' },
        });

        const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
        expect(url).toBe('https://api.forestadmin.com/liana/v1/ai-proxy');

        const headers = new Headers(init.headers);
        expect(headers.get('forest-secret-key')).toBe(ENV_SECRET);
        expect(headers.get('authorization')).toBeNull();
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('forwards the given userId as a user-id header for usage attribution', () => {
      adapter.getModel({ userId: 42 });

      expect(captureFetchHeaders(latestProxyConfig()).get('user-id')).toBe('42');
    });

    it('omits the user-id header when no userId is given', () => {
      adapter.getModel();

      expect(captureFetchHeaders(latestProxyConfig()).get('user-id')).toBeNull();
    });
  });

  describe('loadRemoteTools', () => {
    it('delegates to internal AiClient with the given configs', async () => {
      const configs = {};

      const result = await adapter.loadRemoteTools(configs);

      expect(mockLoadRemoteTools).toHaveBeenCalledWith(configs);
      expect(result).toEqual([]);
    });
  });

  describe('closeConnections', () => {
    it('delegates to internal AiClient', async () => {
      await adapter.closeConnections();

      expect(mockCloseConnections).toHaveBeenCalled();
    });
  });
});
