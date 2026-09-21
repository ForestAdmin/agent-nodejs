import type { ResolvedApiKeyIdentity } from './api-key-client';
import type { ApiKeyError } from './api-key-error';

export interface ResolveCache {
  getPositive(hash: string): ResolvedApiKeyIdentity | undefined;
  getNegative(hash: string): ApiKeyError | undefined;
  setPositive(hash: string, identity: ResolvedApiKeyIdentity): void;
  setNegative(hash: string, error: ApiKeyError): void;
  /**
   * Forgets a key. Bounded because the caller is a refusal the Forest server may repeat on every
   * request: invalidating each time would defeat the cache and cost two round trips per request
   * instead of one extra per window.
   *
   * `credential` is the server token that was refused. A window opened by one token still lets a
   * second, different one through: the re-resolution that followed the first refusal caches a
   * fresh token, and suppressing its refusal too would replay a credential the server rejects for
   * the rest of the window. Only the second is allowed, so the bound holds whatever the server
   * hands back.
   */
  invalidate(hash: string, credential?: string): void;
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

interface InvalidationWindow {
  until: number;
  /** The server token whose refusal opened or reset the window. */
  credential?: string;
  /** Whether a second, different credential has already reset it. */
  retried: boolean;
}

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
  /**
   * Per key, the window opened by its last invalidation. Bounded by `maxEntries` like the entries
   * it guards: invalidations of distinct keys would otherwise grow it without limit.
   */
  const invalidatedUntil = new Map<string, InvalidationWindow>();

  function purgeExpired(): void {
    const current = now();

    for (const [hash, entry] of entries) {
      if (current >= entry.expiresAt) entries.delete(hash);
    }

    for (const [hash, window] of invalidatedUntil) {
      if (current >= window.until) invalidatedUntil.delete(hash);
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

  function evictOldestIfFull<T>(map: Map<string, T>, hash: string): void {
    if (map.has(hash) || map.size < maxEntries) return;

    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }

  function store(hash: string, entry: CacheEntry): void {
    purgeExpired();
    evictOldestIfFull(entries, hash);

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

    invalidate(hash, credential) {
      const open = invalidatedUntil.get(hash);
      const live = open !== undefined && now() < open.until;

      if (live) {
        if (open.retried || open.credential === credential) return;

        // The window is kept: a second refusal buys one more resolution, not a later deadline.
        invalidatedUntil.set(hash, { ...open, credential, retried: true });
        entries.delete(hash);

        return;
      }

      purgeExpired();
      evictOldestIfFull(invalidatedUntil, hash);
      invalidatedUntil.set(hash, {
        until: now() + positiveTtlSeconds * 1000,
        credential,
        retried: false,
      });
      entries.delete(hash);
    },

    size() {
      purgeExpired();

      return entries.size;
    },
  };
}
