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

  describe('when a collection name contains the scope delimiter', () => {
    it('should not collide with the same names split across entries', () => {
      const joined = buildCacheKey({
        envSecret: 'env',
        callerId: 'oauth:1:7',
        collections: ['a,b'],
      });
      const split = buildCacheKey({
        envSecret: 'env',
        callerId: 'oauth:1:7',
        collections: ['a', 'b'],
      });

      expect(joined).not.toBe(split);
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

  describe('when more distinct keys are written than the cap allows', () => {
    it('should stay at the cap and evict the oldest entries', () => {
      const cache = new PermissionsCache({ maxEntries: 3 });

      for (let i = 0; i < 10; i += 1) cache.set(`key-${i}`, HINTS);

      expect(cache.size).toBe(3);
      expect(cache.getFresh('key-0')).toBeUndefined();
      expect(cache.getFresh('key-6')).toBeUndefined();
      expect(cache.getFresh('key-9')).toBe(HINTS);
    });
  });

  describe('when an existing key is written again', () => {
    it('should refresh it rather than grow the cache or evict it', () => {
      const cache = new PermissionsCache({ maxEntries: 3 });

      cache.set('a', HINTS);
      cache.set('b', HINTS);
      cache.set('a', HINTS);
      cache.set('c', HINTS);

      expect(cache.size).toBe(3);
      expect(cache.getFresh('a')).toBe(HINTS);
      expect(cache.getFresh('b')).toBe(HINTS);
      expect(cache.getFresh('c')).toBe(HINTS);
    });
  });

  describe('when the cap is reached and an older key is re-written', () => {
    it('should evict the least recently written key, not the re-written one', () => {
      const cache = new PermissionsCache({ maxEntries: 2 });

      cache.set('a', HINTS);
      cache.set('b', HINTS);
      cache.set('a', HINTS);
      cache.set('c', HINTS);

      expect(cache.getFresh('b')).toBeUndefined();
      expect(cache.getFresh('a')).toBe(HINTS);
      expect(cache.getFresh('c')).toBe(HINTS);
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
