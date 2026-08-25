import type { Logger } from '../src/ports/logger-port';

import AiProxyClient from '../src/ai/ai-proxy-client';
import runCli from '../src/cli-core';

jest.mock('../src/ai/ai-proxy-client');

const OAUTH_ENV = {
  FOREST_AUTH_SECRET: 'auth-secret',
  FOREST_ENV_SECRET: 'env-secret',
  FOREST_SERVER_URL: 'https://api.forestadmin.com',
  FOREST_APP_URL: 'https://app.forestadmin.com',
  AGENT_URL: 'https://agent.example.com',
  HTTP_PORT: '0',
  BFF_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
} satisfies NodeJS.ProcessEnv;

const noopLogger: Logger = () => undefined;

describe('runCli', () => {
  beforeEach(() => {
    (AiProxyClient as unknown as jest.Mock).mockClear();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'ok',
      json: async () => ({ data: { id: '42' } }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('when wiring the AI proxy client', () => {
    it('should cap it with BFF_AI_TIMEOUT_MS rather than the agent timeout', async () => {
      const server = await runCli(
        { ...OAUTH_ENV, BFF_AI_TIMEOUT_MS: '4321', BFF_AGENT_TIMEOUT_MS: '1000' },
        noopLogger,
      );

      try {
        expect(AiProxyClient).toHaveBeenCalledWith({
          forestServerUrl: OAUTH_ENV.FOREST_SERVER_URL,
          timeoutMs: 4321,
        });
      } finally {
        await server.stop();
      }
    });
  });
});
