import type { CollectionSchema } from './types/validated/collection';

// A label edit can take up to the TTL to surface on reads — an accepted freshness/load trade-off.
const DEFAULT_TTL_MS = 10 * 60 * 1000;

interface Entry {
  schema: CollectionSchema;
  fetchedAt: number;
}

// Keyed by renderingId: displayNames and the visible field set are rendering-specific, so the same
// collection in two renderings of one environment must not share an entry.
export default class SchemaCache {
  private readonly store = new Map<number, Map<string, Entry>>();
  private readonly inFlight = new Map<number, Map<string, Promise<CollectionSchema>>>();
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(ttlMs: number = DEFAULT_TTL_MS, now: () => number = Date.now) {
    this.ttlMs = ttlMs;
    this.now = now;
  }

  // Read-through with global de-dup; a rejected fetch is not cached (retryable).
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
