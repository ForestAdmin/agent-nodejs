import type { Logger } from '../src/ports/logger-port';

import runCli, { reportFatalError } from '../src/cli-core';
import { ConfigurationError } from '../src/errors';

const VALID_ENV = {
  FOREST_AUTH_SECRET: 'auth-secret',
  FOREST_ENV_SECRET: 'env-secret',
  FOREST_SERVER_URL: 'https://api.forestadmin.com',
  FOREST_APP_URL: 'https://app.forestadmin.com',
  AGENT_URL: 'https://agent.example.com',
  HTTP_PORT: '0',
} satisfies NodeJS.ProcessEnv;

const noopLogger: Logger = () => undefined;

describe('runCli', () => {
  describe('when a required var is absent but not malformed', () => {
    it('should still boot the server (model C, not fail-fast)', async () => {
      const server = await runCli({ ...VALID_ENV, FOREST_SERVER_URL: undefined }, noopLogger);

      try {
        expect(server).toBeDefined();
      } finally {
        await server.stop();
      }
    });
  });

  describe('when BFF_TOKEN_ENCRYPTION_KEY is absent', () => {
    it('should disable OAuth and still boot (key gates OAuth, not boot)', async () => {
      const logs: string[] = [];

      const logger: Logger = (_level, message) => {
        logs.push(message);
      };

      const server = await runCli({ ...VALID_ENV }, logger);

      try {
        expect(server).toBeDefined();
        expect(logs).toContain('OAuth routes disabled: required configuration is missing');
      } finally {
        await server.stop();
      }
    });
  });

  describe('when the full OAuth configuration is present', () => {
    const FULL_ENV = {
      ...VALID_ENV,
      BFF_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
    } satisfies NodeJS.ProcessEnv;

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should wire OAuth routes (no disabled warning) and boot', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'ok',
        json: async () => ({ data: { id: '42' } }),
      }) as unknown as typeof fetch;

      const logs: string[] = [];

      const logger: Logger = (_level, message) => {
        logs.push(message);
      };

      const server = await runCli({ ...FULL_ENV }, logger);

      try {
        expect(server).toBeDefined();
        expect(logs).not.toContain('OAuth routes disabled: required configuration is missing');
        expect(global.fetch).toHaveBeenCalledTimes(1);
      } finally {
        await server.stop();
      }
    });

    it('should propagate a fetchEnvironmentId failure out of runCli', async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error('forest server unreachable')) as unknown as typeof fetch;

      await expect(runCli({ ...FULL_ENV }, noopLogger)).rejects.toThrow(
        'forest server unreachable',
      );
    });
  });

  describe('when a config value is malformed', () => {
    it('should throw ConfigurationError naming the key without echoing the secret', async () => {
      const err = await runCli(
        { ...VALID_ENV, AGENT_URL: 'super-secret-bad-value' },
        noopLogger,
      ).catch((e: unknown) => e);

      expect(err).toBeInstanceOf(ConfigurationError);
      expect((err as Error).message).toBe(
        'Invalid configuration: AGENT_URL must be a valid http(s) URL.',
      );
      expect((err as Error).message).not.toContain('super-secret-bad-value');
    });
  });
});

describe('reportFatalError', () => {
  let stderrSpy: jest.SpyInstance;
  const originalExitCode = process.exitCode;

  beforeEach(() => {
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    process.exitCode = originalExitCode;
  });

  describe('when the error carries a message', () => {
    it('should set exit code 1 and write a sanitized stderr message', () => {
      reportFatalError(
        new ConfigurationError('Invalid configuration: AGENT_URL must be a valid http(s) URL.'),
      );

      expect(process.exitCode).toBe(1);
      expect(stderrSpy).toHaveBeenCalledTimes(1);
      const written = String(stderrSpy.mock.calls[0][0]);
      expect(written).toContain('Error: Invalid configuration: AGENT_URL');
      expect(written).not.toContain('super-secret-bad-value');
    });
  });

  describe('when the error message is empty (wrapped infra error)', () => {
    it('should fall back to the error name', () => {
      const wrapped = new Error('');
      wrapped.name = 'SequelizeConnectionRefusedError';
      reportFatalError(wrapped);

      const written = String(stderrSpy.mock.calls[0][0]);
      expect(written).toBe('Error: SequelizeConnectionRefusedError\n');
    });
  });
});
