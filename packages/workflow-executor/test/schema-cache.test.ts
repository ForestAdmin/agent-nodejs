import type { CollectionSchema } from '../src/types/validated/collection';

import SchemaCache from '../src/schema-cache';

const RENDERING_A = 100;
const RENDERING_B = 200;

function makeSchema(collectionName: string): CollectionSchema {
  return {
    collectionName,
    collectionId: `col-${collectionName}`,
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

      expect(cache.get(RENDERING_A, 'unknown')).toBeUndefined();
    });

    it('returns the schema after set', () => {
      const cache = new SchemaCache();
      const schema = makeSchema('customers');

      cache.set(RENDERING_A, 'customers', schema);

      expect(cache.get(RENDERING_A, 'customers')).toBe(schema);
    });

    it('overwrites existing entry on set', () => {
      const cache = new SchemaCache();
      const old = makeSchema('customers');
      const updated = { ...makeSchema('customers'), primaryKeyFields: ['uid'] };

      cache.set(RENDERING_A, 'customers', old);
      cache.set(RENDERING_A, 'customers', updated);

      expect(cache.get(RENDERING_A, 'customers')).toBe(updated);
    });
  });

  describe('rendering isolation', () => {
    it('does not return another rendering schema for the same collection (PRD-440)', () => {
      const cache = new SchemaCache();
      const schemaA = makeSchema('customers');

      cache.set(RENDERING_A, 'customers', schemaA);

      expect(cache.get(RENDERING_B, 'customers')).toBeUndefined();
    });

    it('keeps per-rendering schemas independent', () => {
      const cache = new SchemaCache();
      const schemaA = makeSchema('customers');
      const schemaB = { ...makeSchema('customers'), collectionDisplayName: 'Clients' };

      cache.set(RENDERING_A, 'customers', schemaA);
      cache.set(RENDERING_B, 'customers', schemaB);

      expect(cache.get(RENDERING_A, 'customers')).toBe(schemaA);
      expect(cache.get(RENDERING_B, 'customers')).toBe(schemaB);
    });

    it('does not confuse rendering 1 with rendering 11', () => {
      const cache = new SchemaCache();
      const schema1 = makeSchema('customers');

      cache.set(1, 'customers', schema1);

      expect(cache.get(11, 'customers')).toBeUndefined();
      expect([...cache.entriesForRendering(11)]).toHaveLength(0);
    });
  });

  describe('TTL expiration', () => {
    it('returns the schema before TTL expires', () => {
      let time = 0;
      // TTL is 1s; the injected clock returns ms, so the expiry boundary is 1000ms.
      const cache = new SchemaCache(1, () => time);
      const schema = makeSchema('customers');

      cache.set(RENDERING_A, 'customers', schema);
      time = 999;

      expect(cache.get(RENDERING_A, 'customers')).toBe(schema);
    });

    it('returns undefined after TTL expires', () => {
      let time = 0;
      const cache = new SchemaCache(1, () => time);

      cache.set(RENDERING_A, 'customers', makeSchema('customers'));
      time = 1001;

      expect(cache.get(RENDERING_A, 'customers')).toBeUndefined();
    });

    it('deletes the expired entry from the store on get', () => {
      let time = 0;
      const cache = new SchemaCache(1, () => time);

      cache.set(RENDERING_A, 'customers', makeSchema('customers'));
      time = 1001;

      cache.get(RENDERING_A, 'customers'); // triggers delete
      time = 0; // rewind — entry should still be gone

      expect(cache.get(RENDERING_A, 'customers')).toBeUndefined();
    });

    it('refreshes TTL when entry is re-set', () => {
      let time = 0;
      const cache = new SchemaCache(1, () => time);

      cache.set(RENDERING_A, 'customers', makeSchema('customers'));
      time = 800;
      cache.set(RENDERING_A, 'customers', makeSchema('customers')); // re-set refreshes
      time = 1500; // 700ms since re-set, within TTL

      expect(cache.get(RENDERING_A, 'customers')).toBeDefined();
    });
  });

  describe('entriesForRendering', () => {
    it('yields only the given rendering non-expired entries', () => {
      const cache = new SchemaCache();

      cache.set(RENDERING_A, 'customers', makeSchema('customers'));
      cache.set(RENDERING_A, 'orders', makeSchema('orders'));
      cache.set(RENDERING_B, 'customers', makeSchema('customers'));

      const entries = [...cache.entriesForRendering(RENDERING_A)];

      expect(entries.map(([name]) => name).sort()).toEqual(['customers', 'orders']);
    });

    it('skips and deletes expired entries', () => {
      let time = 0;
      const cache = new SchemaCache(1, () => time);

      cache.set(RENDERING_A, 'fresh', makeSchema('fresh'));
      time = 500;
      cache.set(RENDERING_A, 'also-fresh', makeSchema('also-fresh'));
      time = 1100; // 'fresh' expired, 'also-fresh' still valid

      const entries = [...cache.entriesForRendering(RENDERING_A)];

      expect(entries).toHaveLength(1);
      expect(entries[0][0]).toBe('also-fresh');

      // expired entry was cleaned up
      time = 0;
      expect(cache.get(RENDERING_A, 'fresh')).toBeUndefined();
    });

    it('returns empty for a rendering with no entries', () => {
      const cache = new SchemaCache();

      cache.set(RENDERING_A, 'customers', makeSchema('customers'));

      expect([...cache.entriesForRendering(RENDERING_B)]).toHaveLength(0);
    });
  });
});
