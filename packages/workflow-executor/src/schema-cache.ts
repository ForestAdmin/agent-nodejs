import type { CollectionSchema } from './types/record';

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

export default class SchemaCache {
  private readonly store = new Map<string, { schema: CollectionSchema; fetchedAt: number }>();
  private readonly ttlMs: number;

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  get(collectionName: string): CollectionSchema | undefined {
    const entry = this.store.get(collectionName);

    if (!entry) return undefined;

    if (Date.now() - entry.fetchedAt > this.ttlMs) {
      this.store.delete(collectionName);

      return undefined;
    }

    return entry.schema;
  }

  set(collectionName: string, schema: CollectionSchema): void {
    this.store.set(collectionName, { schema, fetchedAt: Date.now() });
  }

  /** Iterates over non-expired entries. */
  *[Symbol.iterator](): IterableIterator<[string, CollectionSchema]> {
    const now = Date.now();

    for (const [key, entry] of this.store) {
      if (now - entry.fetchedAt <= this.ttlMs) {
        yield [key, entry.schema];
      }
    }
  }
}
