import type { CollectionSchema } from './types/validated/collection';

import { DEFAULT_SCHEMA_CACHE_TTL_S } from './defaults';

export default class SchemaCache {
  private readonly store = new Map<string, { schema: CollectionSchema; fetchedAt: number }>();
  private readonly ttlS: number;
  private readonly now: () => number;

  constructor(ttlS: number = DEFAULT_SCHEMA_CACHE_TTL_S, now: () => number = Date.now) {
    this.ttlS = ttlS;
    this.now = now;
  }

  get(collectionName: string): CollectionSchema | undefined {
    const entry = this.store.get(collectionName);

    if (!entry) return undefined;

    if (this.now() - entry.fetchedAt > this.ttlS * 1000) {
      this.store.delete(collectionName);

      return undefined;
    }

    return entry.schema;
  }

  set(collectionName: string, schema: CollectionSchema): void {
    this.store.set(collectionName, { schema, fetchedAt: this.now() });
  }

  // Yields non-expired entries; deletes stale ones along the way.
  *[Symbol.iterator](): IterableIterator<[string, CollectionSchema]> {
    const now = this.now();

    for (const [key, entry] of this.store) {
      if (now - entry.fetchedAt <= this.ttlS * 1000) {
        yield [key, entry.schema];
      } else {
        this.store.delete(key);
      }
    }
  }
}
