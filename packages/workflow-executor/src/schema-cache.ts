import type { CollectionSchema } from './types/validated/collection';

// 10 minutes. By design, a label edited in the rendering can take up to this long to appear on the
// hydration read path (GET /runs/:runId) — an accepted freshness/load trade-off, not a bug.
const DEFAULT_TTL_MS = 10 * 60 * 1000;

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
  // In-flight fetches, so concurrent callers for the same (rendering, collection) — across
  // different getters, reads, or runs — share one fetch instead of stampeding a cold cache.
  private readonly inFlight = new Map<number, Map<string, Promise<CollectionSchema>>>();
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(ttlMs: number = DEFAULT_TTL_MS, now: () => number = Date.now) {
    this.ttlMs = ttlMs;
    this.now = now;
  }

  // Read-through with global de-duplication. A rejected fetch is not cached and clears the
  // in-flight slot, so the next caller retries.
  getOrFetch(
    renderingId: number,
    collectionName: string,
    fetch: () => Promise<CollectionSchema>,
  ): Promise<CollectionSchema> {
    const cached = this.get(renderingId, collectionName);
    if (cached) return Promise.resolve(cached);

    const pending = this.inFlight.get(renderingId)?.get(collectionName);
    if (pending) return pending;

    let byCollection = this.inFlight.get(renderingId);

    if (!byCollection) {
      byCollection = new Map();
      this.inFlight.set(renderingId, byCollection);
    }

    const inFlight = byCollection;
    const promise = fetch()
      .then(schema => {
        this.set(renderingId, collectionName, schema);

        return schema;
      })
      .finally(() => {
        inFlight.delete(collectionName);
        if (inFlight.size === 0) this.inFlight.delete(renderingId);
      });

    inFlight.set(collectionName, promise);

    return promise;
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
