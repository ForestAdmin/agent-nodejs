import type { ResolvedApiKeyIdentity } from '../../src/api-key/api-key-client';

import { invalidApiKey } from '../../src/api-key/api-key-error';
import createResolveCache from '../../src/api-key/resolve-cache';

const IDENTITY: ResolvedApiKeyIdentity = {
  user: {
    id: 42,
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    team: 'Support',
    tags: [{ key: 'region', value: 'eu' }],
    permissionLevel: 'admin',
  },
  renderingId: 17,
  allowedOrigins: [],
};

describe('resolve cache', () => {
  let nowMs: number;
  const now = () => nowMs;

  beforeEach(() => {
    nowMs = 1_000_000;
  });

  describe('positive entries', () => {
    it('should return the identity within the positive TTL', () => {
      const cache = createResolveCache({ now, positiveTtlSeconds: 60 });
      cache.setPositive('hash', IDENTITY);
      nowMs += 59_000;

      expect(cache.getPositive('hash')).toEqual(IDENTITY);
    });

    it('should expire exactly at the positive TTL', () => {
      const cache = createResolveCache({ now, positiveTtlSeconds: 60 });
      cache.setPositive('hash', IDENTITY);
      nowMs += 60_000;

      expect(cache.getPositive('hash')).toBeUndefined();
    });
  });

  describe('invalidation', () => {
    it('should forget a positive entry before its TTL', () => {
      const cache = createResolveCache({ now, positiveTtlSeconds: 60 });
      cache.setPositive('hash', IDENTITY);

      cache.invalidate('hash');

      expect(cache.getPositive('hash')).toBeUndefined();
    });

    it('should leave the other entries alone', () => {
      const cache = createResolveCache({ now, positiveTtlSeconds: 60 });
      cache.setPositive('hash', IDENTITY);
      cache.setPositive('other-hash', IDENTITY);

      cache.invalidate('hash');

      expect(cache.getPositive('other-hash')).toEqual(IDENTITY);
    });

    it('should ignore a second invalidation of the same key within the TTL window', () => {
      const cache = createResolveCache({ now, positiveTtlSeconds: 60 });
      cache.setPositive('hash', IDENTITY);
      cache.invalidate('hash');
      cache.setPositive('hash', IDENTITY);
      nowMs += 59_000;

      cache.invalidate('hash');

      expect(cache.getPositive('hash')).toEqual(IDENTITY);
    });

    it('should still forget another key while one is within its window', () => {
      const cache = createResolveCache({ now, positiveTtlSeconds: 60 });
      cache.setPositive('hash', IDENTITY);
      cache.setPositive('other-hash', IDENTITY);
      cache.invalidate('hash');
      cache.setPositive('hash', IDENTITY);

      cache.invalidate('hash');
      cache.invalidate('other-hash');

      expect(cache.getPositive('hash')).toEqual(IDENTITY);
      expect(cache.getPositive('other-hash')).toBeUndefined();
    });

    it('should invalidate again once the window has passed', () => {
      const cache = createResolveCache({ now, positiveTtlSeconds: 60 });
      cache.setPositive('hash', IDENTITY);
      cache.invalidate('hash');
      nowMs += 60_000;
      cache.setPositive('hash', IDENTITY);

      cache.invalidate('hash');

      expect(cache.getPositive('hash')).toBeUndefined();
    });
  });

  describe('negative entries', () => {
    it('should return the cached error within the negative TTL', () => {
      const cache = createResolveCache({ now, negativeTtlSeconds: 10 });
      const error = invalidApiKey();
      cache.setNegative('hash', error);
      nowMs += 9_000;

      expect(cache.getNegative('hash')).toBe(error);
    });

    it('should expire exactly at the negative TTL', () => {
      const cache = createResolveCache({ now, negativeTtlSeconds: 10 });
      cache.setNegative('hash', invalidApiKey());
      nowMs += 10_000;

      expect(cache.getNegative('hash')).toBeUndefined();
    });
  });

  describe('kind isolation', () => {
    it('should not expose a positive entry through getNegative', () => {
      const cache = createResolveCache({ now });
      cache.setPositive('hash', IDENTITY);

      expect(cache.getNegative('hash')).toBeUndefined();
    });
  });

  describe('memory bound', () => {
    it('should evict the oldest entry once maxEntries is reached', () => {
      const cache = createResolveCache({ now, maxEntries: 2 });
      cache.setPositive('a', IDENTITY);
      cache.setPositive('b', IDENTITY);
      cache.setPositive('c', IDENTITY);

      expect(cache.size()).toBe(2);
      expect(cache.getPositive('a')).toBeUndefined();
      expect(cache.getPositive('b')).toEqual(IDENTITY);
      expect(cache.getPositive('c')).toEqual(IDENTITY);
    });

    it('should evict the oldest invalidation window once maxEntries is reached', () => {
      const cache = createResolveCache({ now, positiveTtlSeconds: 60, maxEntries: 2 });
      cache.invalidate('a');
      cache.invalidate('b');
      cache.invalidate('c');
      cache.setPositive('a', IDENTITY);

      cache.invalidate('a');

      expect(cache.getPositive('a')).toBeUndefined();
    });

    it('should drop an expired invalidation window rather than evict a live one', () => {
      const cache = createResolveCache({ now, positiveTtlSeconds: 60, maxEntries: 2 });
      cache.invalidate('a');
      cache.invalidate('b');
      nowMs += 61_000;
      cache.invalidate('a');
      cache.invalidate('c');
      cache.setPositive('a', IDENTITY);

      cache.invalidate('a');

      expect(cache.getPositive('a')).toEqual(IDENTITY);
    });

    it('should still overwrite an existing key when full', () => {
      const cache = createResolveCache({ now, maxEntries: 1 });
      cache.setPositive('a', IDENTITY);
      cache.setNegative('a', invalidApiKey());

      expect(cache.getNegative('a')).toBeDefined();
      expect(cache.getPositive('a')).toBeUndefined();
    });
  });
});
