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

function purgeExpired(buckets: Map<string, WindowEntry>, current: number): void {
  for (const [key, entry] of buckets) {
    if (current >= entry.resetAt) buckets.delete(key);
  }
}

function saturationRefusal(buckets: Map<string, WindowEntry>, current: number): LimitRefusal {
  const earliestReset = Math.min(...[...buckets.values()].map(live => live.resetAt));

  return { retryAfterSeconds: retryAfterSeconds(earliestReset, current), saturated: true };
}

export default function createFixedWindowLimiter({
  windowMs,
  maxRequests,
  now = Date.now,
  maxEntries = DEFAULT_MAX_ENTRIES,
}: FixedWindowLimiterOptions): FixedWindowLimiter {
  const buckets = new Map<string, WindowEntry>();

  function liveEntry(key: string, current: number): WindowEntry | undefined {
    const entry = buckets.get(key);

    if (entry && current < entry.resetAt) return entry;

    buckets.delete(key);
    purgeExpired(buckets, current);

    return undefined;
  }

  return {
    hit(key) {
      const current = now();
      let entry = liveEntry(key, current);

      if (entry === undefined) {
        if (buckets.size >= maxEntries) return saturationRefusal(buckets, current);

        entry = { count: 0, resetAt: current + windowMs };
        buckets.set(key, entry);
      }

      entry.count += 1;

      if (entry.count <= maxRequests) return undefined;

      return { retryAfterSeconds: retryAfterSeconds(entry.resetAt, current), saturated: false };
    },
  };
}
