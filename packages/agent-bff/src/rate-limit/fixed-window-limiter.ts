export interface FixedWindowLimiterOptions {
  windowMs: number;
  maxRequests: number;
  now?: () => number;
  maxEntries?: number;
}

export interface LimitRefusal {
  retryAfterSeconds: number;
  saturated: boolean;
}

export interface FixedWindowLimiter {
  hit(key: string): LimitRefusal | undefined;
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

const DEFAULT_MAX_ENTRIES = 10_000;

const MS_PER_SECOND = 1000;

function retryAfterSeconds(resetAt: number, current: number): number {
  return Math.max(1, Math.ceil((resetAt - current) / MS_PER_SECOND));
}

export default function createFixedWindowLimiter({
  windowMs,
  maxRequests,
  now = Date.now,
  maxEntries = DEFAULT_MAX_ENTRIES,
}: FixedWindowLimiterOptions): FixedWindowLimiter {
  const buckets = new Map<string, WindowEntry>();

  function purgeExpired(current: number): void {
    for (const [key, entry] of buckets) {
      if (current >= entry.resetAt) buckets.delete(key);
    }
  }

  return {
    hit(key) {
      const current = now();
      let entry = buckets.get(key);

      if (entry && current >= entry.resetAt) {
        buckets.delete(key);
        entry = undefined;
      }

      if (entry === undefined) {
        purgeExpired(current);

        if (buckets.size >= maxEntries) {
          const earliestReset = Math.min(...[...buckets.values()].map(live => live.resetAt));

          return {
            retryAfterSeconds: retryAfterSeconds(earliestReset, current),
            saturated: true,
          };
        }

        entry = { count: 0, resetAt: current + windowMs };
        buckets.set(key, entry);
      }

      entry.count += 1;

      if (entry.count > maxRequests) {
        return {
          retryAfterSeconds: retryAfterSeconds(entry.resetAt, current),
          saturated: false,
        };
      }

      return undefined;
    },
  };
}
