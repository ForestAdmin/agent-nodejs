import type { CollectionSchema } from './types/validated/collection';

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface Entry {
  schema: CollectionSchema;
  fetchedAt: number;
}

// Scoped by renderingId: collection/field/action displayNames AND the visible field set are
// rendering-specific (see forestadmin-server getCollectionSchema, which resolves them from the
// run's rendering layout). The same collection name in two renderings of one environment must NOT
// share an entry, or one team's labels/visible fields would leak into another's run.
export default class SchemaCache {
  private readonly store = new Map<number, Map<string, Entry>>();
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(ttlMs: number = DEFAULT_TTL_MS, now: () => number = Date.now) {
    this.ttlMs = ttlMs;
    this.now = now;
  }

  get(renderingId: number, collectionName: string): CollectionSchema | undefined {
    const byCollection = this.store.get(renderingId);
    const entry = byCollection?.get(collectionName);

    if (!entry) return undefined;

    if (this.now() - entry.fetchedAt > this.ttlMs) {
      byCollection!.delete(collectionName);

      return undefined;
    }

    return entry.schema;
  }

  set(renderingId: number, collectionName: string, schema: CollectionSchema): void {
    let byCollection = this.store.get(renderingId);

    if (!byCollection) {
      byCollection = new Map();
      this.store.set(renderingId, byCollection);
    }

    byCollection.set(collectionName, { schema, fetchedAt: this.now() });
  }

  // Yields the non-expired entries for a single rendering; deletes stale ones along the way.
  *entriesForRendering(renderingId: number): IterableIterator<[string, CollectionSchema]> {
    const byCollection = this.store.get(renderingId);

    if (!byCollection) return;

    const now = this.now();

    for (const [collectionName, entry] of byCollection) {
      if (now - entry.fetchedAt <= this.ttlMs) {
        yield [collectionName, entry.schema];
      } else {
        byCollection.delete(collectionName);
      }
    }
  }
}
