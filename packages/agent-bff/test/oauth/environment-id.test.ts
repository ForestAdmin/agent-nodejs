import type { Logger } from '../../src/ports/logger-port';

import EnvironmentFetchError from '../../src/oauth/environment-fetch-error';
import createEnvironmentIdResolver, {
  tolerateEnvironmentIdFailure,
} from '../../src/oauth/environment-id';

const FAILURE_TTL_MS = 5_000;

function makeLogger() {
  const logs: { level: string; message: string; context?: unknown }[] = [];

  const logger: Logger = (level, message, context) => {
    logs.push({ level, message, context });
  };

  return { logger, logs };
}

describe('createEnvironmentIdResolver', () => {
  describe('when the fetch succeeds', () => {
    it('should fetch once and serve the cached id afterwards', async () => {
      const fetchEnvironmentId = jest.fn().mockResolvedValue(42);
      const resolve = createEnvironmentIdResolver({ fetchEnvironmentId });

      await expect(resolve()).resolves.toBe(42);
      await expect(resolve()).resolves.toBe(42);

      expect(fetchEnvironmentId).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the fetch fails', () => {
    it('should serve the remembered failure without refetching for the whole failure ttl', async () => {
      const fetchEnvironmentId = jest
        .fn()
        .mockRejectedValue(new Error('forest server unreachable'));
      let clock = 1_000_000;
      const resolve = createEnvironmentIdResolver({ fetchEnvironmentId }, () => clock);

      await expect(resolve()).rejects.toThrow('forest server unreachable');
      clock += FAILURE_TTL_MS - 1;
      await expect(resolve()).rejects.toThrow('forest server unreachable');

      expect(fetchEnvironmentId).toHaveBeenCalledTimes(1);
    });

    it('should retry and resolve once the failure ttl has elapsed, since the failure is not cached for good', async () => {
      const fetchEnvironmentId = jest
        .fn()
        .mockRejectedValueOnce(new Error('forest server unreachable'))
        .mockResolvedValue(7);
      let clock = 1_000_000;
      const resolve = createEnvironmentIdResolver({ fetchEnvironmentId }, () => clock);

      await expect(resolve()).rejects.toThrow('forest server unreachable');
      clock += FAILURE_TTL_MS;

      await expect(resolve()).resolves.toBe(7);
      expect(fetchEnvironmentId).toHaveBeenCalledTimes(2);
    });
  });

  describe('when two callers arrive before the first fetch settles', () => {
    it('should share a single fetch', async () => {
      const fetchEnvironmentId = jest.fn().mockResolvedValue(1);
      const resolve = createEnvironmentIdResolver({ fetchEnvironmentId });

      await expect(Promise.all([resolve(), resolve()])).resolves.toEqual([1, 1]);

      expect(fetchEnvironmentId).toHaveBeenCalledTimes(1);
    });
  });
});

describe('tolerateEnvironmentIdFailure', () => {
  describe('when the resolver succeeds', () => {
    it('should serve the id untouched and log nothing', async () => {
      const { logger, logs } = makeLogger();

      await expect(tolerateEnvironmentIdFailure(async () => 42, logger)()).resolves.toBe(42);
      expect(logs).toEqual([]);
    });
  });

  describe('when the Forest server refuses the read', () => {
    it('should serve no id and log at Error, since a refusal will never resolve on its own', async () => {
      const { logger, logs } = makeLogger();
      const resolve = tolerateEnvironmentIdFailure(async () => {
        throw EnvironmentFetchError.fromStatus(401, 'Unauthorized');
      }, logger);

      await expect(resolve()).resolves.toBeUndefined();
      expect(logs).toEqual([
        {
          level: 'Error',
          message: 'Serving the context without an environment id',
          context: { cause: 'Failed to fetch environment: 401 Unauthorized' },
        },
      ]);
    });
  });

  describe('when the Forest server cannot be reached', () => {
    it('should serve no id and log at Warn, since transport failures heal', async () => {
      const { logger, logs } = makeLogger();
      const resolve = tolerateEnvironmentIdFailure(async () => {
        throw new Error('forest server unreachable');
      }, logger);

      await expect(resolve()).resolves.toBeUndefined();
      expect(logs).toEqual([
        {
          level: 'Warn',
          message: 'Serving the context without an environment id',
          context: { cause: 'forest server unreachable' },
        },
      ]);
    });
  });

  describe('when a rate limit is what refused the read', () => {
    it('should log at Warn, since 429 is the one 4xx that heals', async () => {
      const { logger, logs } = makeLogger();
      const resolve = tolerateEnvironmentIdFailure(async () => {
        throw EnvironmentFetchError.fromStatus(429, 'Too Many Requests');
      }, logger);

      await expect(resolve()).resolves.toBeUndefined();
      expect(logs[0].level).toBe('Warn');
    });
  });
});
