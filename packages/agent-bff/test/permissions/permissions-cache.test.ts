import type { EvaluatedPermissions } from '../../src/permissions/permissions-cache';

import PermissionsCache, {
  PERMISSIONS_CACHE_TTL_MS,
} from '../../src/permissions/permissions-cache';

const PERMISSIONS = {
  actionPermissions: {
    isDevelopment: false,
    actionsGloballyAllowed: new Set<string>(),
    actionsByRole: new Map(),
  },
  users: [{ id: 1, roleId: 7 }],
} as unknown as EvaluatedPermissions;

describe('PermissionsCache', () => {
  describe('when nothing was stored yet', () => {
    it('should return undefined', () => {
      expect(new PermissionsCache().getFresh()).toBeUndefined();
    });
  });

  describe('when the entry was stored within the TTL', () => {
    it('should return it', () => {
      let clock = 1_000;
      const cache = new PermissionsCache({ now: () => clock });

      cache.set(PERMISSIONS, cache.generation);
      clock += PERMISSIONS_CACHE_TTL_MS - 1;

      expect(cache.getFresh()).toBe(PERMISSIONS);
    });
  });

  describe('when the entry reached the TTL', () => {
    it('should not return it', () => {
      let clock = 1_000;
      const cache = new PermissionsCache({ now: () => clock });

      cache.set(PERMISSIONS, cache.generation);
      clock += PERMISSIONS_CACHE_TTL_MS;

      expect(cache.getFresh()).toBeUndefined();
    });
  });

  describe('when several payloads are stored', () => {
    it('should keep a single entry holding the latest one', () => {
      const cache = new PermissionsCache();
      const latest = { ...PERMISSIONS };

      cache.set(PERMISSIONS, cache.generation);
      cache.set(latest, cache.generation);

      expect(cache.size).toBe(1);
      expect(cache.getFresh()).toBe(latest);
    });
  });

  describe('when the cache is cleared', () => {
    it('should drop the stored entry', () => {
      const cache = new PermissionsCache();

      cache.set(PERMISSIONS, cache.generation);
      cache.clear();

      expect(cache.getFresh()).toBeUndefined();
      expect(cache.size).toBe(0);
    });
  });

  describe('when a fetch started before a clear tries to store its result', () => {
    it('should refuse the write, since it read the permissions the clear declared stale', () => {
      const cache = new PermissionsCache();
      const { generation } = cache;

      cache.clear();
      cache.set(PERMISSIONS, generation);

      expect(cache.getFresh()).toBeUndefined();
    });

    it('should accept a fetch started after that clear', () => {
      const cache = new PermissionsCache();

      cache.clear();
      cache.set(PERMISSIONS, cache.generation);

      expect(cache.getFresh()).toBe(PERMISSIONS);
    });
  });
});
