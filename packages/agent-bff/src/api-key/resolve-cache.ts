import type { ResolvedApiKeyIdentity } from './api-key-client';
import type { ApiKeyError } from './api-key-error';

export interface ResolveCache {
  getPositive(hash: string): ResolvedApiKeyIdentity | undefined;
  getNegative(hash: string): ApiKeyError | undefined;
  setPositive(hash: string, identity: ResolvedApiKeyIdentity): void;
  setNegative(hash: string, error: ApiKeyError): void;
  size(): number;
}

export interface ResolveCacheOptions {
  now: () => number;
  positiveTtlSeconds?: number;
  negativeTtlSeconds?: number;
  maxEntries?: number;
}

interface PositiveEntry {
  kind: 'positive';
  identity: ResolvedApiKeyIdentity;
  expiresAt: number;
}

interface NegativeEntry {
  kind: 'negative';
  error: ApiKeyError;
  expiresAt: number;
}

type CacheEntry = PositiveEntry | NegativeEntry;

const DEFAULT_POSITIVE_TTL_SECONDS = 60;
const DEFAULT_NEGATIVE_TTL_SECONDS = 10;
const DEFAULT_MAX_ENTRIES = 10_000;

export default function createResolveCache({
  now,
  positiveTtlSeconds = DEFAULT_POSITIVE_TTL_SECONDS,
  negativeTtlSeconds = DEFAULT_NEGATIVE_TTL_SECONDS,
  maxEntries = DEFAULT_MAX_ENTRIES,
}: ResolveCacheOptions): ResolveCache {
  const entries = new Map<string, CacheEntry>();

  function purgeExpired(): void {
    const current = now();

    for (const [hash, entry] of entries) {
      if (current >= entry.expiresAt) entries.delete(hash);
    }
  }

  function liveEntry(hash: string): CacheEntry | undefined {
    const entry = entries.get(hash);
    if (!entry) return undefined;

    if (now() >= entry.expiresAt) {
      entries.delete(hash);

      return undefined;
    }

    return entry;
  }

  function store(hash: string, entry: CacheEntry): void {
    purgeExpired();
    if (!entries.has(hash) && entries.size >= maxEntries) return;
    entries.set(hash, entry);
  }

  return {
    getPositive(hash) {
      const entry = liveEntry(hash);

      return entry?.kind === 'positive' ? entry.identity : undefined;
    },

    getNegative(hash) {
      const entry = liveEntry(hash);

      return entry?.kind === 'negative' ? entry.error : undefined;
    },

    setPositive(hash, identity) {
      store(hash, { kind: 'positive', identity, expiresAt: now() + positiveTtlSeconds * 1000 });
    },

    setNegative(hash, error) {
      store(hash, { kind: 'negative', error, expiresAt: now() + negativeTtlSeconds * 1000 });
    },

    size() {
      purgeExpired();

      return entries.size;
    },
  };
}
