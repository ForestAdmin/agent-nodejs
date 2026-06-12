import type { CollectionSchema } from './types/validated/collection';

import { DEFAULT_SCHEMA_CACHE_TTL_S } from './defaults';

type Entry = { collectionName: string; schema: CollectionSchema; fetchedAt: number };

// A collection's schema (display names, exposed fields, actions) depends on the rendering it is
// resolved for, so entries are keyed by (renderingId, collectionName). A shared, collection-only
// key would let a run reuse another rendering's schema within the TTL window (PRD-440).
export default class SchemaCache {
  // Separates the two key parts so the prefix scan in entriesForRendering can't confuse
  // rendering 1 with rendering 11, and a collection name can't spill into the rendering segment.
  private static readonly SEPARATOR = String.fromCharCode(0);

  private readonly store = new Map<string, Entry>();
  private readonly ttlS: number;
  private readonly now: () => number;

  constructor(ttlS: number = DEFAULT_SCHEMA_CACHE_TTL_S, now: () => number = Date.now) {
    this.ttlS = ttlS;
    this.now = now;
  }

  get(renderingId: number, collectionName: string): CollectionSchema | undefined {
    const key = SchemaCache.key(renderingId, collectionName);
    const entry = this.store.get(key);

    if (!entry) return undefined;

    if (this.isExpired(entry)) {
      this.store.delete(key);

      return undefined;
    }

    return entry.schema;
  }

  set(renderingId: number, collectionName: string, schema: CollectionSchema): void {
    this.store.set(SchemaCache.key(renderingId, collectionName), {
      collectionName,
      schema,
      fetchedAt: this.now(),
    });
  }

  // Yields the given rendering's non-expired entries; deletes stale ones along the way.
  *entriesForRendering(renderingId: number): IterableIterator<[string, CollectionSchema]> {
    const prefix = SchemaCache.key(renderingId, '');

    for (const [key, entry] of this.store) {
      if (key.startsWith(prefix)) {
        if (this.isExpired(entry)) this.store.delete(key);
        else yield [entry.collectionName, entry.schema];
      }
    }
  }

  private isExpired(entry: Entry): boolean {
    return this.now() - entry.fetchedAt > this.ttlS * 1000;
  }

  private static key(renderingId: number, collectionName: string): string {
    return `${renderingId}${SchemaCache.SEPARATOR}${collectionName}`;
  }
}
