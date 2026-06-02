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
});
