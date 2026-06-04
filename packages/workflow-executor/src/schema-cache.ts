import type { CollectionSchema } from './types/validated/collection';

import { DEFAULT_SCHEMA_CACHE_TTL_MS } from './defaults';

export default class SchemaCache {
  private readonly store = new Map<string, { schema: CollectionSchema; fetchedAt: number }>();
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(ttlMs: number = DEFAULT_SCHEMA_CACHE_TTL_MS, now: () => number = Date.now) {
    this.ttlMs = ttlMs;
    this.now = now;
  }

  get(collectionName: string): CollectionSchema | undefined {
    const entry = this.store.get(collectionName);

    if (!entry) return undefined;

    if (this.now() - entry.fetchedAt > this.ttlMs) {
      this.store.delete(collectionName);

      return undefined;
    }

    return entry.schema;
  }

  set(collectionName: string, schema: CollectionSchema): void {
    this.store.set(collectionName, { schema, fetchedAt: this.now() });
  }

  // Returns the cached schema, or loads it via `load`, caches it, and returns it.
  // `load` is injected so the cache stays decoupled from the orchestrator port.
  async getOrLoad(
    collectionName: string,
    load: () => Promise<CollectionSchema>,
  ): Promise<CollectionSchema> {
    const cached = this.get(collectionName);
    if (cached) return cached;

    const schema = await load();
    this.set(collectionName, schema);

    return schema;
  }

  // Yields non-expired entries; deletes stale ones along the way.
  *[Symbol.iterator](): IterableIterator<[string, CollectionSchema]> {
    const now = this.now();

    for (const [key, entry] of this.store) {
      if (now - entry.fetchedAt <= this.ttlMs) {
        yield [key, entry.schema];
      } else {
        this.store.delete(key);
      }
    }
  }
}
