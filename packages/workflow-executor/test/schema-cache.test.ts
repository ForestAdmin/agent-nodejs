import type { CollectionSchema } from '../src/types/validated/collection';

import SchemaCache from '../src/schema-cache';

const R1 = 1;
const R2 = 2;

function makeSchema(collectionName: string, displayName = collectionName): CollectionSchema {
  return {
    collectionName,
    collectionDisplayName: displayName,
    primaryKeyFields: ['id'],
    fields: [],
    actions: [],
  };
}

describe('SchemaCache', () => {
  describe('get / set', () => {
    it('returns undefined for unknown keys', () => {
      const cache = new SchemaCache();

      expect(cache.get(R1, 'unknown')).toBeUndefined();
    });

    it('returns the schema after set', () => {
      const cache = new SchemaCache();
      const schema = makeSchema('customers');

      cache.set(R1, 'customers', schema);

      expect(cache.get(R1, 'customers')).toBe(schema);
    });

    it('overwrites existing entry on set', () => {
      const cache = new SchemaCache();
      const old = makeSchema('customers');
      const updated = { ...makeSchema('customers'), primaryKeyFields: ['uid'] };

      cache.set(R1, 'customers', old);
      cache.set(R1, 'customers', updated);

      expect(cache.get(R1, 'customers')).toBe(updated);
    });
  });

  describe('rendering isolation', () => {
    it('does not share entries for the same collection across renderings', () => {
      const cache = new SchemaCache();
      const r1Schema = makeSchema('customers', 'Clients');
      const r2Schema = makeSchema('customers', 'Accounts');

      cache.set(R1, 'customers', r1Schema);
      cache.set(R2, 'customers', r2Schema);

      // Each rendering sees its own labels; no cross-contamination.
      expect(cache.get(R1, 'customers')).toBe(r1Schema);
      expect(cache.get(R2, 'customers')).toBe(r2Schema);
    });

    it('a miss in one rendering is unaffected by another rendering populating the same collection', () => {
      const cache = new SchemaCache();

      cache.set(R1, 'customers', makeSchema('customers'));

      expect(cache.get(R2, 'customers')).toBeUndefined();
    });
  });

  describe('TTL expiration', () => {
    it('returns the schema before TTL expires', () => {
      let time = 0;
      const cache = new SchemaCache(1000, () => time);
      const schema = makeSchema('customers');

      cache.set(R1, 'customers', schema);
      time = 999;

      expect(cache.get(R1, 'customers')).toBe(schema);
    });

    it('returns undefined after TTL expires', () => {
      let time = 0;
      const cache = new SchemaCache(1000, () => time);

      cache.set(R1, 'customers', makeSchema('customers'));
      time = 1001;

      expect(cache.get(R1, 'customers')).toBeUndefined();
    });

    it('deletes the expired entry from the store on get', () => {
      let time = 0;
      const cache = new SchemaCache(1000, () => time);

      cache.set(R1, 'customers', makeSchema('customers'));
      time = 1001;

      cache.get(R1, 'customers'); // triggers delete
      time = 0; // rewind — entry should still be gone

      expect(cache.get(R1, 'customers')).toBeUndefined();
    });

    it('refreshes TTL when entry is re-set', () => {
      let time = 0;
      const cache = new SchemaCache(1000, () => time);

      cache.set(R1, 'customers', makeSchema('customers'));
      time = 800;
      cache.set(R1, 'customers', makeSchema('customers')); // re-set refreshes
      time = 1500; // 700ms since re-set, within TTL

      expect(cache.get(R1, 'customers')).toBeDefined();
    });
  });

  describe('entriesForRendering', () => {
    it('yields all non-expired entries for the given rendering only', () => {
      const cache = new SchemaCache();

      cache.set(R1, 'customers', makeSchema('customers'));
      cache.set(R1, 'orders', makeSchema('orders'));
      cache.set(R2, 'customers', makeSchema('customers')); // other rendering — excluded

      const entries = [...cache.entriesForRendering(R1)];

      expect(entries.map(([name]) => name)).toEqual(['customers', 'orders']);
    });

    it('skips and deletes expired entries', () => {
      let time = 0;
      const cache = new SchemaCache(1000, () => time);

      cache.set(R1, 'fresh', makeSchema('fresh'));
      time = 500;
      cache.set(R1, 'also-fresh', makeSchema('also-fresh'));
      time = 1100; // 'fresh' expired, 'also-fresh' still valid

      const entries = [...cache.entriesForRendering(R1)];

      expect(entries).toHaveLength(1);
      expect(entries[0][0]).toBe('also-fresh');

      // expired entry was cleaned up
      time = 0;
      expect(cache.get(R1, 'fresh')).toBeUndefined();
    });

    it('returns empty for a rendering with no entries', () => {
      const cache = new SchemaCache();

      expect([...cache.entriesForRendering(R1)]).toHaveLength(0);
    });
  });

  describe('getOrFetch', () => {
    it('returns the cached schema without fetching on a hit', async () => {
      const cache = new SchemaCache();
      const cached = makeSchema('customers');
      cache.set(R1, 'customers', cached);
      const fetch = jest.fn();

      await expect(cache.getOrFetch(R1, 'customers', fetch)).resolves.toBe(cached);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('fetches and caches on a miss', async () => {
      const cache = new SchemaCache();
      const fetched = makeSchema('customers');
      const fetch = jest.fn().mockResolvedValue(fetched);

      await expect(cache.getOrFetch(R1, 'customers', fetch)).resolves.toBe(fetched);
      expect(cache.get(R1, 'customers')).toBe(fetched);
      // Second call is now a cache hit — no second fetch.
      await cache.getOrFetch(R1, 'customers', fetch);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('shares one in-flight fetch among concurrent callers', async () => {
      const cache = new SchemaCache();
      let resolveFetch: (s: CollectionSchema) => void = () => undefined;
      const fetch = jest.fn().mockReturnValue(
        new Promise<CollectionSchema>(r => {
          resolveFetch = r;
        }),
      );

      const all = Promise.all([
        cache.getOrFetch(R1, 'customers', fetch),
        cache.getOrFetch(R1, 'customers', fetch),
        cache.getOrFetch(R1, 'customers', fetch),
      ]);
      resolveFetch(makeSchema('customers'));
      await all;

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('keeps fetches for the same collection in different renderings separate', async () => {
      const cache = new SchemaCache();
      const fetch = jest
        .fn()
        .mockResolvedValueOnce(makeSchema('customers', 'Clients'))
        .mockResolvedValueOnce(makeSchema('customers', 'Accounts'));

      const [a, b] = await Promise.all([
        cache.getOrFetch(R1, 'customers', fetch),
        cache.getOrFetch(R2, 'customers', fetch),
      ]);

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(a.collectionDisplayName).toBe('Clients');
      expect(b.collectionDisplayName).toBe('Accounts');
    });

    it('does not cache a rejected fetch and clears the in-flight slot for retry', async () => {
      const cache = new SchemaCache();
      const fetch = jest
        .fn()
        .mockRejectedValueOnce(new Error('transient'))
        .mockResolvedValueOnce(makeSchema('customers'));

      await expect(cache.getOrFetch(R1, 'customers', fetch)).rejects.toThrow('transient');
      expect(cache.get(R1, 'customers')).toBeUndefined();

      // In-flight slot was cleared — a retry triggers a fresh fetch and succeeds.
      await expect(cache.getOrFetch(R1, 'customers', fetch)).resolves.toMatchObject({
        collectionName: 'customers',
      });
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });
});
