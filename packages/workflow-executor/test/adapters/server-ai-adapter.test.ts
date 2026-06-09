import { AiClient } from '@forestadmin/ai-proxy';

import ServerAiAdapter from '../../src/adapters/server-ai-adapter';

jest.mock('@forestadmin/ai-proxy', () => ({
  AiClient: jest.fn().mockImplementation(() => ({
    getModel: jest.fn().mockReturnValue({ id: 'fake-model' }),
    loadRemoteTools: jest.fn().mockResolvedValue([]),
    closeConnections: jest.fn().mockResolvedValue(undefined),
  })),
}));

const ENV_SECRET = 'a'.repeat(64);

describe('ServerAiAdapter', () => {
  const adapter = new ServerAiAdapter({
    forestServerUrl: 'https://api.forestadmin.com',
    envSecret: ENV_SECRET,
  });

  const aiClientMock = AiClient as unknown as jest.Mock;
  const proxyConfig = () => aiClientMock.mock.calls[0][0].aiConfigurations[0];
  const aiClientInstance = () => aiClientMock.mock.results[0].value;

  describe('constructor', () => {
    it('configures AiClient with a single openai config targeting the FA server', () => {
      expect(proxyConfig()).toEqual(
        expect.objectContaining({
          provider: 'openai',
          model: 'gpt-4.1',
          maxRetries: 2,
          configuration: expect.objectContaining({ fetch: expect.any(Function) }),
        }),
      );
    });
  });

  describe('getModel', () => {
    it('delegates to the internal AiClient', () => {
      expect(adapter.getModel()).toEqual({ id: 'fake-model' });
      expect(aiClientInstance().getModel).toHaveBeenCalled();
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
  });

  describe('loadRemoteTools', () => {
    it('delegates to internal AiClient', async () => {
      const result = await adapter.loadRemoteTools({});

      expect(result).toEqual([]);
    });
  });

  describe('closeConnections', () => {
    it('resolves without error', async () => {
      await expect(adapter.closeConnections()).resolves.toBeUndefined();
    });
  });
});
