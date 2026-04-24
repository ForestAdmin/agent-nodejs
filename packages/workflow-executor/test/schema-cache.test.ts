import type { CollectionSchema } from '../src/types/validated/collection';

import SchemaCache from '../src/schema-cache';

function makeSchema(collectionName: string): CollectionSchema {
  return {
    collectionName,
    collectionDisplayName: collectionName,
    primaryKeyFields: ['id'],
    fields: [],
    actions: [],
  };
}

describe('SchemaCache', () => {
  describe('get / set', () => {
    it('returns undefined for unknown keys', () => {
      const cache = new SchemaCache();

      expect(cache.get('unknown')).toBeUndefined();
    });

    it('returns the schema after set', () => {
      const cache = new SchemaCache();
      const schema = makeSchema('customers');

      cache.set('customers', schema);

      expect(cache.get('customers')).toBe(schema);
    });

    it('overwrites existing entry on set', () => {
      const cache = new SchemaCache();
      const old = makeSchema('customers');
      const updated = { ...makeSchema('customers'), primaryKeyFields: ['uid'] };

      cache.set('customers', old);
      cache.set('customers', updated);

      expect(cache.get('customers')).toBe(updated);
    });
  });

  describe('TTL expiration', () => {
    it('returns the schema before TTL expires', () => {
      let time = 0;
      const cache = new SchemaCache(1000, () => time);
      const schema = makeSchema('customers');

      cache.set('customers', schema);
      time = 999;

      expect(cache.get('customers')).toBe(schema);
    });

    it('returns undefined after TTL expires', () => {
      let time = 0;
      const cache = new SchemaCache(1000, () => time);

      cache.set('customers', makeSchema('customers'));
      time = 1001;

      expect(cache.get('customers')).toBeUndefined();
    });

    it('deletes the expired entry from the store on get', () => {
      let time = 0;
      const cache = new SchemaCache(1000, () => time);

      cache.set('customers', makeSchema('customers'));
      time = 1001;

      cache.get('customers'); // triggers delete
      time = 0; // rewind — entry should still be gone

      expect(cache.get('customers')).toBeUndefined();
    });

    it('refreshes TTL when entry is re-set', () => {
      let time = 0;
      const cache = new SchemaCache(1000, () => time);

      cache.set('customers', makeSchema('customers'));
      time = 800;
      cache.set('customers', makeSchema('customers')); // re-set refreshes
      time = 1500; // 700ms since re-set, within TTL

      expect(cache.get('customers')).toBeDefined();
    });
  });

  describe('iterator', () => {
    it('yields all non-expired entries', () => {
      const cache = new SchemaCache();

      cache.set('customers', makeSchema('customers'));
      cache.set('orders', makeSchema('orders'));

      const entries = [...cache];

      expect(entries).toHaveLength(2);
      expect(entries[0][0]).toBe('customers');
      expect(entries[1][0]).toBe('orders');
    });

    it('skips and deletes expired entries', () => {
      let time = 0;
      const cache = new SchemaCache(1000, () => time);

      cache.set('fresh', makeSchema('fresh'));
      time = 500;
      cache.set('also-fresh', makeSchema('also-fresh'));
      time = 1100; // 'fresh' expired, 'also-fresh' still valid

      const entries = [...cache];

      expect(entries).toHaveLength(1);
      expect(entries[0][0]).toBe('also-fresh');

      // expired entry was cleaned up
      time = 0;
      expect(cache.get('fresh')).toBeUndefined();
    });

    it('returns empty for a fresh cache', () => {
      const cache = new SchemaCache();

      expect([...cache]).toHaveLength(0);
    });
  });
});
