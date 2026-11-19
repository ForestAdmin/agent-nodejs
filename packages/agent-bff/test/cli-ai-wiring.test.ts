import type { Logger } from '../src/ports/logger-port';

import { AiClient } from '@forestadmin/ai-proxy';

import AiProxyClient from '../src/ai/ai-proxy-client';
import createAiRoutesMiddleware from '../src/ai/ai-routes-middleware';
import runCli from '../src/cli-core';
import { restoreFetchAfterEach, stubEnvironmentIdFetch } from './helpers/fetch-stub';

jest.mock('../src/ai/ai-proxy-client');
jest.mock('@forestadmin/ai-proxy', () => {
  const actual = jest.requireActual('@forestadmin/ai-proxy');

  return { ...actual, AiClient: jest.fn((...args) => new actual.AiClient(...args)) };
});
jest.mock('../src/ai/ai-routes-middleware', () => {
  const actual = jest.requireActual('../src/ai/ai-routes-middleware');

  return { __esModule: true, ...actual, default: jest.fn(actual.default) };
});

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
  restoreFetchAfterEach();

  beforeEach(() => {
    (AiProxyClient as unknown as jest.Mock).mockClear();
    (AiClient as unknown as jest.Mock).mockClear();
    stubEnvironmentIdFetch();
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

  describe("when the Gateway has the customer's AI provider", () => {
    it('should say at boot which model answers AI queries instead of Forest', async () => {
      const logger = jest.fn();
      const server = await runCli(
        {
          ...OAUTH_ENV,
          BFF_AI_PROVIDER: 'openai',
          BFF_AI_MODEL: 'gpt-4.1',
          BFF_AI_API_KEY: 'sk-test',
        },
        logger,
      );

      try {
        expect(logger).toHaveBeenCalledWith(
          'Info',
          "AI queries go to the openai model gpt-4.1, not Forest's AI server",
        );
      } finally {
        await server.stop();
      }
    });

    it("should give the customer's model BFF_AI_TIMEOUT_MS as its timeout", async () => {
      const server = await runCli(
        {
          ...OAUTH_ENV,
          BFF_AI_TIMEOUT_MS: '4321',
          BFF_AI_PROVIDER: 'openai',
          BFF_AI_MODEL: 'gpt-4.1',
          BFF_AI_API_KEY: 'sk-test',
        },
        noopLogger,
      );

      try {
        expect(createAiRoutesMiddleware).toHaveBeenCalledWith(
          expect.objectContaining({
            customerModel: expect.objectContaining({ modelName: 'gpt-4.1', timeoutMs: 4321 }),
          }),
        );
      } finally {
        await server.stop();
      }
    });

    it("should hand AiClient the customer's setting with the runtime's retry budget", async () => {
      const server = await runCli(
        {
          ...OAUTH_ENV,
          BFF_AI_PROVIDER: 'openai',
          BFF_AI_MODEL: 'gpt-4.1',
          BFF_AI_API_KEY: 'sk-test',
        },
        noopLogger,
      );

      try {
        expect(AiClient).toHaveBeenCalledWith({
          aiConfigurations: [
            {
              name: 'default',
              provider: 'openai',
              model: 'gpt-4.1',
              apiKey: 'sk-test',
              maxRetries: 2,
            },
          ],
        });
      } finally {
        await server.stop();
      }
    });

    it("should hand AiClient a bedrock setting's region", async () => {
      const server = await runCli(
        {
          ...OAUTH_ENV,
          BFF_AI_PROVIDER: 'bedrock',
          BFF_AI_MODEL: 'anthropic.claude-sonnet-4',
          AWS_REGION: 'eu-west-3',
        },
        noopLogger,
      );

      try {
        expect(AiClient).toHaveBeenCalledWith({
          aiConfigurations: [expect.objectContaining({ provider: 'bedrock', region: 'eu-west-3' })],
        });
      } finally {
        await server.stop();
      }
    });

    it('should log nothing about the customer model when none is set', async () => {
      const logger = jest.fn();
      const server = await runCli({ ...OAUTH_ENV }, logger);

      try {
        expect(logger).not.toHaveBeenCalledWith(
          'Info',
          expect.stringContaining('AI queries go to'),
        );
      } finally {
        await server.stop();
      }
    });
  });
});
