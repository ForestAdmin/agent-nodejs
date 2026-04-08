import ServerAiAdapter from '../../src/adapters/server-ai-adapter';

jest.mock('@forestadmin/ai-proxy', () => ({
  AiClient: jest.fn().mockImplementation(() => ({
    loadRemoteTools: jest.fn().mockResolvedValue([]),
    closeConnections: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation((opts: Record<string, unknown>) => ({
    mockOpts: opts,
  })),
}));

const ENV_SECRET = 'a'.repeat(64);

describe('ServerAiAdapter', () => {
  const adapter = new ServerAiAdapter({
    forestServerUrl: 'https://api.forestadmin.com',
    envSecret: ENV_SECRET,
  });

  describe('getModel', () => {
    it('returns a ChatOpenAI configured for the FA server', () => {
      const model = adapter.getModel() as unknown as { mockOpts: Record<string, unknown> };

      expect(model.mockOpts).toEqual(
        expect.objectContaining({
          model: 'gpt-4.1',
          maxRetries: 2,
          configuration: expect.objectContaining({
            fetch: expect.any(Function),
          }),
        }),
      );
    });

    it('sends forest-secret-key header instead of Authorization', () => {
      const model = adapter.getModel() as unknown as { mockOpts: Record<string, unknown> };

      const { fetch: customFetch } = model.mockOpts.configuration as {
        fetch: (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
      };

      const mockInit = {
        method: 'POST',
        body: '{}',
        headers: { Authorization: 'Bearer unused' },
      } as RequestInit;
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue(new Response('{}', { status: 200 }));

      try {
        customFetch('https://ignored.com/chat/completions', mockInit);

        const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
        expect(url).toBe('https://api.forestadmin.com/liana/v1/ai-proxy');

        const headers = new Headers(init.headers);
        expect(headers.get('forest-secret-key')).toBe(ENV_SECRET);
        expect(headers.get('authorization')).toBeNull();
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('loadRemoteTools', () => {
    it('delegates to internal AiClient', async () => {
      const result = await adapter.loadRemoteTools({ configs: {} });

      expect(result).toEqual([]);
    });
  });

  describe('closeConnections', () => {
    it('resolves without error', async () => {
      await expect(adapter.closeConnections()).resolves.toBeUndefined();
    });
  });
});
