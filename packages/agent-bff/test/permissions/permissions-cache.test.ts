import type { PermissionHints } from '../../src/permissions/build-permission-hints';

import PermissionsCache, {
  PERMISSIONS_CACHE_TTL_MS,
  buildCacheKey,
} from '../../src/permissions/permissions-cache';

const HINTS = { collections: {}, visibleActions: [] } as PermissionHints;

describe('buildCacheKey', () => {
  describe('when the same collections are given in a different order', () => {
    it('should produce the same key', () => {
      const first = buildCacheKey({
        envSecret: 'env',
        callerId: 'oauth:1:7',
        collections: ['b', 'a'],
      });
      const second = buildCacheKey({
        envSecret: 'env',
        callerId: 'oauth:1:7',
        collections: ['a', 'b'],
      });

      expect(first).toBe(second);
    });
  });

  describe('when the caller differs', () => {
    it('should produce a different key', () => {
      const first = buildCacheKey({ envSecret: 'env', callerId: 'oauth:1:7', collections: ['a'] });
      const second = buildCacheKey({ envSecret: 'env', callerId: 'oauth:2:7', collections: ['a'] });

      expect(first).not.toBe(second);
    });
  });

  describe('when the environment differs', () => {
    it('should produce a different key', () => {
      const first = buildCacheKey({
        envSecret: 'env-a',
        callerId: 'oauth:1:7',
        collections: ['a'],
      });
      const second = buildCacheKey({
        envSecret: 'env-b',
        callerId: 'oauth:1:7',
        collections: ['a'],
      });

      expect(first).not.toBe(second);
    });
  });
});

describe('PermissionsCache', () => {
  describe('when an entry was stored within the TTL', () => {
    it('should return it', () => {
      let clock = 1_000;
      const cache = new PermissionsCache({ now: () => clock });

      cache.set('key', HINTS);
      clock += PERMISSIONS_CACHE_TTL_MS - 1;

      expect(cache.getFresh('key')).toBe(HINTS);
    });
  });

  describe('when an entry reached the TTL', () => {
    it('should not return it', () => {
      let clock = 1_000;
      const cache = new PermissionsCache({ now: () => clock });

      cache.set('key', HINTS);
      clock += PERMISSIONS_CACHE_TTL_MS;

      expect(cache.getFresh('key')).toBeUndefined();
    });
  });

  describe('when clear ran while a fetch was in flight', () => {
    it('should drop the write belonging to the previous generation', () => {
      const cache = new PermissionsCache();
      const generationAtRead = cache.currentGeneration;

      cache.clear();
      cache.set('key', HINTS, generationAtRead);

      expect(cache.getFresh('key')).toBeUndefined();
    });
  });

  describe('when clear ran before the read started', () => {
    it('should keep the write', () => {
      const cache = new PermissionsCache();

      cache.clear();
      cache.set('key', HINTS, cache.currentGeneration);

      expect(cache.getFresh('key')).toBe(HINTS);
    });
  });
});
