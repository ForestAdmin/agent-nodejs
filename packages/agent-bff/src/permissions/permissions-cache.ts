import type { PermissionHints } from './build-permission-hints';

export const PERMISSIONS_CACHE_TTL_MS = 15 * 60 * 1000;

export interface PermissionsCacheOptions {
  now?: () => number;
  ttlMs?: number;
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
  const scope = [...collections].sort().join(',');

  return `${envSecret}|${callerId}|${scope}`;
}

export default class PermissionsCache {
  private readonly now: () => number;
  private readonly ttlMs: number;

  private readonly entries = new Map<string, CacheEntry>();
  private generation = 0;

  constructor({ now = Date.now, ttlMs = PERMISSIONS_CACHE_TTL_MS }: PermissionsCacheOptions = {}) {
    this.now = now;
    this.ttlMs = ttlMs;
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

    this.entries.set(key, { hints, storedAt: this.now() });
  }

  get currentGeneration(): number {
    return this.generation;
  }

  clear(): void {
    this.generation += 1;
    this.entries.clear();
  }
}
