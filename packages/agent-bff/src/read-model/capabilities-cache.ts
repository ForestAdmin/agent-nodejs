import { ONE_DAY_MS } from './schema-cache';

export interface CapabilitiesResult {
  fields: { name: string; type: string; operators: string[] }[];
}

export type CapabilitiesFetcher = (collection: string) => Promise<CapabilitiesResult>;

export interface CapabilitiesCacheOptions {
  now?: () => number;
  ttlMs?: number;
}

interface CacheEntry {
  result: CapabilitiesResult;
  fetchedAt: number;
}

/**
 * Per-collection capabilities cache (24h). The fetcher is passed per call so it can be bound to
 * the caller's request token. Invalidated together with the schema via `clear()`.
 */
export default class CapabilitiesCache {
  private readonly now: () => number;
  private readonly ttlMs: number;

  private readonly entries = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<CapabilitiesResult>>();
  private generation = 0;

  constructor({ now = Date.now, ttlMs = ONE_DAY_MS }: CapabilitiesCacheOptions = {}) {
    this.now = now;
    this.ttlMs = ttlMs;
  }

  async get(collection: string, fetcher: CapabilitiesFetcher): Promise<CapabilitiesResult> {
    const entry = this.entries.get(collection);
    if (entry && this.now() - entry.fetchedAt < this.ttlMs) return entry.result;

    const pending = this.inFlight.get(collection);
    if (pending) return pending;

    const { generation } = this;
    const fetch = fetcher(collection)
      .then(result => {
        // Skip the write if a clear() (schema refresh) happened while this fetch was in flight —
        // its result belongs to the old schema generation and must not repopulate the cache.
        if (this.generation === generation) {
          this.entries.set(collection, { result, fetchedAt: this.now() });
        }

        return result;
      })
      .finally(() => {
        if (this.inFlight.get(collection) === fetch) this.inFlight.delete(collection);
      });

    this.inFlight.set(collection, fetch);

    return fetch;
  }

  clear(): void {
    this.generation += 1;
    this.entries.clear();
    this.inFlight.clear();
  }
}
