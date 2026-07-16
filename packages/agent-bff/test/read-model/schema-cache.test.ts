import type { Metrics } from '../../src/ports/metrics-port';
import type { SchemaFetcher } from '../../src/read-model/forest-schema-client';
import type { ForestSchemaCollection } from '@forestadmin/forestadmin-client';

import { makeMetrics, makeSchema } from './fixtures';
import SchemaUnavailableError from '../../src/read-model/errors';
import SchemaCache, {
  ONE_DAY_MS,
  SCHEMA_CACHE_AGE_SECONDS,
  SCHEMA_CACHE_REFRESH_ERROR,
} from '../../src/read-model/schema-cache';

describe('SchemaCache', () => {
  let fetcher: { fetchSchema: jest.Mock<Promise<ForestSchemaCollection[]>, []> };
  let metrics: jest.Mocked<Metrics>;
  let clock: number;
  const now = () => clock;

  beforeEach(() => {
    clock = 1_000_000;
    metrics = makeMetrics();
    fetcher = { fetchSchema: jest.fn() };
  });

  function build(): SchemaCache {
    return new SchemaCache({ fetcher: fetcher as SchemaFetcher, metrics, now });
  }

  describe('cold cache', () => {
    it('should fetch on first read and return the collections', async () => {
      const schema = makeSchema('users');
      fetcher.fetchSchema.mockResolvedValue(schema);

      const result = await build().get();

      expect(fetcher.fetchSchema).toHaveBeenCalledTimes(1);
      expect(result).toBe(schema);
    });

    it('should throw SchemaUnavailableError and emit the error counter when the first fetch fails', async () => {
      fetcher.fetchSchema.mockRejectedValue(new Error('boom'));
      const cache = build();

      await expect(cache.get()).rejects.toBeInstanceOf(SchemaUnavailableError);
      expect(metrics.increment).toHaveBeenCalledWith(SCHEMA_CACHE_REFRESH_ERROR);
    });

    it('should re-attempt the fetch on the next read after a cold failure (no poisoning)', async () => {
      const schema = makeSchema('users');
      fetcher.fetchSchema.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(schema);
      const cache = build();

      await expect(cache.get()).rejects.toBeInstanceOf(SchemaUnavailableError);
      const result = await cache.get();

      expect(fetcher.fetchSchema).toHaveBeenCalledTimes(2);
      expect(result).toBe(schema);
    });

    it('should report ageSeconds undefined until a first good schema exists', async () => {
      fetcher.fetchSchema.mockRejectedValue(new Error('boom'));
      const cache = build();

      await expect(cache.get()).rejects.toBeInstanceOf(SchemaUnavailableError);

      expect(cache.ageSeconds()).toBeUndefined();
    });
  });

  describe('warm cache within TTL', () => {
    it('should serve from cache without re-fetching before 24h', async () => {
      const schema = makeSchema('users');
      fetcher.fetchSchema.mockResolvedValue(schema);
      const cache = build();

      await cache.get();
      clock += ONE_DAY_MS - 1;
      const result = await cache.get();

      expect(fetcher.fetchSchema).toHaveBeenCalledTimes(1);
      expect(result).toBe(schema);
    });

    it('should re-fetch after 24h', async () => {
      const first = makeSchema('users');
      const second = makeSchema('users-v2');
      fetcher.fetchSchema.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
      const cache = build();

      await cache.get();
      clock += ONE_DAY_MS;
      const result = await cache.get();

      expect(fetcher.fetchSchema).toHaveBeenCalledTimes(2);
      expect(result).toBe(second);
    });

    it('should return the same array reference on a cache hit', async () => {
      const schema = makeSchema('users');
      fetcher.fetchSchema.mockResolvedValue(schema);
      const cache = build();

      const a = await cache.get();
      const b = await cache.get();

      expect(a).toBe(b);
    });
  });

  describe('warm cache refresh failure', () => {
    it('should keep serving the last good schema and emit the error counter', async () => {
      const good = makeSchema('users');
      fetcher.fetchSchema.mockResolvedValueOnce(good).mockRejectedValueOnce(new Error('boom'));
      const cache = build();

      await cache.get();
      clock += ONE_DAY_MS;
      const result = await cache.get();

      expect(result).toBe(good);
      expect(metrics.increment).toHaveBeenCalledWith(SCHEMA_CACHE_REFRESH_ERROR);
    });

    it('should re-attempt on the next read and serve the fresh schema once it succeeds', async () => {
      const good = makeSchema('users');
      const fresh = makeSchema('users-v2');
      fetcher.fetchSchema
        .mockResolvedValueOnce(good)
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce(fresh);
      const cache = build();

      await cache.get();
      clock += ONE_DAY_MS;
      await cache.get();
      const result = await cache.get();

      expect(fetcher.fetchSchema).toHaveBeenCalledTimes(3);
      expect(result).toBe(fresh);
    });
  });

  describe('concurrent reads', () => {
    it('should dedupe an in-flight fetch so concurrent cold reads fetch once', async () => {
      const schema = makeSchema('users');
      let resolveFetch!: (value: ForestSchemaCollection[]) => void;
      fetcher.fetchSchema.mockReturnValue(
        new Promise<ForestSchemaCollection[]>(resolve => {
          resolveFetch = resolve;
        }),
      );
      const cache = build();

      const a = cache.get();
      const b = cache.get();
      resolveFetch(schema);

      expect(await a).toBe(schema);
      expect(await b).toBe(schema);
      expect(fetcher.fetchSchema).toHaveBeenCalledTimes(1);
    });
  });

  describe('age gauge', () => {
    it('should emit schema_cache_age_seconds reflecting the last good age on read', async () => {
      const schema = makeSchema('users');
      fetcher.fetchSchema.mockResolvedValue(schema);
      const cache = build();

      await cache.get();
      clock += 5_000;
      metrics.gauge.mockClear();
      await cache.get();

      expect(metrics.gauge).toHaveBeenCalledWith(SCHEMA_CACHE_AGE_SECONDS, 5);
    });
  });

  describe('empty schema', () => {
    it('should treat an empty schema as a failed fetch on a cold cache', async () => {
      fetcher.fetchSchema.mockResolvedValue([]);
      const cache = build();

      await expect(cache.get()).rejects.toBeInstanceOf(SchemaUnavailableError);
      expect(metrics.increment).toHaveBeenCalledWith(SCHEMA_CACHE_REFRESH_ERROR);
      expect(cache.ageSeconds()).toBeUndefined();
    });

    it('should keep serving the last good schema when a refresh returns empty', async () => {
      const good = makeSchema('users');
      fetcher.fetchSchema.mockResolvedValueOnce(good).mockResolvedValueOnce([]);
      const cache = build();

      await cache.get();
      clock += ONE_DAY_MS;
      const result = await cache.get();

      expect(result).toBe(good);
      expect(metrics.increment).toHaveBeenCalledWith(SCHEMA_CACHE_REFRESH_ERROR);
    });
  });

  describe('revision', () => {
    it('should start at 0 before any successful fetch', () => {
      expect(build().revision).toBe(0);
    });

    it('should increment on each successful refresh', async () => {
      fetcher.fetchSchema
        .mockResolvedValueOnce(makeSchema('users'))
        .mockResolvedValueOnce(makeSchema('users-v2'));
      const cache = build();

      await cache.get();
      expect(cache.revision).toBe(1);

      clock += ONE_DAY_MS;
      await cache.get();
      expect(cache.revision).toBe(2);
    });

    it('should not increment on a cache hit', async () => {
      fetcher.fetchSchema.mockResolvedValue(makeSchema('users'));
      const cache = build();

      await cache.get();
      await cache.get();

      expect(cache.revision).toBe(1);
    });

    it('should not increment on a warm refresh failure', async () => {
      fetcher.fetchSchema
        .mockResolvedValueOnce(makeSchema('users'))
        .mockRejectedValueOnce(new Error('boom'));
      const cache = build();

      await cache.get();
      clock += ONE_DAY_MS;
      await cache.get();

      expect(cache.revision).toBe(1);
    });
  });
});
