import type { PermissionHints } from './build-permission-hints';

export const PERMISSIONS_CACHE_TTL_MS = 15 * 60 * 1000;
export const PERMISSIONS_CACHE_MAX_ENTRIES = 1000;

export interface PermissionsCacheOptions {
  now?: () => number;
  ttlMs?: number;
  maxEntries?: number;
}

interface CacheEntry {
  hints: PermissionHints;
  storedAt: number;
}

export interface CacheKeyParts {
  envSecret: string;
  callerId: string;
  collections: string[];
}

export function buildCacheKey({ envSecret, callerId, collections }: CacheKeyParts): string {
  const scope = JSON.stringify([...collections].sort());

  return `${envSecret}|${callerId}|${scope}`;
}

export default class PermissionsCache {
  private readonly now: () => number;
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  private readonly entries = new Map<string, CacheEntry>();
  private generation = 0;

  constructor({
    now = Date.now,
    ttlMs = PERMISSIONS_CACHE_TTL_MS,
    maxEntries = PERMISSIONS_CACHE_MAX_ENTRIES,
  }: PermissionsCacheOptions = {}) {
    this.now = now;
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
  }

  getFresh(key: string): PermissionHints | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;

    if (this.now() - entry.storedAt >= this.ttlMs) {
      this.entries.delete(key);

      return undefined;
    }

    return entry.hints;
  }

  set(key: string, hints: PermissionHints, generationAtRead = this.generation): void {
    if (generationAtRead !== this.generation) return;

    this.entries.delete(key);
    this.evictOldestUntilBelowCap();
    this.entries.set(key, { hints, storedAt: this.now() });
  }

  get currentGeneration(): number {
    return this.generation;
  }

  get size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.generation += 1;
    this.entries.clear();
  }

  private evictOldestUntilBelowCap(): void {
    for (const key of this.entries.keys()) {
      if (this.entries.size < this.maxEntries) return;

      this.entries.delete(key);
    }
  }
}
