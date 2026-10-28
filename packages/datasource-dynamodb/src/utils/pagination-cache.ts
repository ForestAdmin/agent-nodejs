import { createHash } from 'crypto';

export type StartKey = Record<string, unknown>;

type Entry = { offset: number; startKey: StartKey; createdAt: number };

export type PaginationCacheOptions = {
  /** Positions remembered per query. Default: 100. */
  maxEntriesPerQuery?: number;
  /** Queries remembered. Default: 1000. */
  maxQueries?: number;
  /** How long a position stays usable, in milliseconds. Default: 5 minutes. */
  ttlMs?: number;
  /** Records between two positions remembered while reading. Default: 1000. */
  cacheInterval?: number;
  now?: () => number;
};

const DEFAULTS = {
  maxEntriesPerQuery: 100,
  maxQueries: 1000,
  ttlMs: 5 * 60 * 1000,
  cacheInterval: 1000,
};

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, nested) => {
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return Object.fromEntries(Object.entries(nested).sort(([a], [b]) => (a < b ? -1 : 1)));
    }

    return nested;
  });
}

/**
 * DynamoDB has no OFFSET: a page is reached by resuming from the key where an earlier read of
 * the same query stopped. This remembers those keys, by the number of matching records before them.
 */
export default class PaginationCache {
  private readonly queries = new Map<string, { table?: string; entries: Entry[] }>();
  private readonly options: Required<PaginationCacheOptions>;

  constructor(options: PaginationCacheOptions = {}) {
    this.options = { now: () => Date.now(), ...DEFAULTS, ...options };
  }

  hash(query: unknown): string {
    return createHash('sha1').update(stableStringify(query)).digest('hex');
  }

  getCacheInterval(): number {
    return this.options.cacheInterval;
  }

  storeToken(queryHash: string, offset: number, startKey: StartKey, table?: string): void {
    const query = this.queries.get(queryHash) ?? { table, entries: [] };
    this.queries.delete(queryHash);
    this.queries.set(queryHash, query);

    query.entries = query.entries.filter(entry => entry.offset !== offset);
    query.entries.push({ offset, startKey, createdAt: this.options.now() });

    if (query.entries.length > this.options.maxEntriesPerQuery) query.entries.shift();

    if (this.queries.size > this.options.maxQueries) {
      this.queries.delete(this.queries.keys().next().value);
    }
  }

  findBestToken(
    queryHash: string,
    offset: number,
  ): { offset: number; startKey: StartKey } | undefined {
    const query = this.queries.get(queryHash);

    if (!query) return undefined;

    const now = this.options.now();
    query.entries = query.entries.filter(entry => now - entry.createdAt <= this.options.ttlMs);

    const best = query.entries
      .filter(entry => entry.offset <= offset)
      .reduce<Entry | undefined>(
        (closest, entry) => (!closest || entry.offset > closest.offset ? entry : closest),
        undefined,
      );

    return best && { offset: best.offset, startKey: best.startKey };
  }

  invalidateTable(table: string): void {
    for (const [hash, query] of this.queries) {
      if (query.table === table) this.queries.delete(hash);
    }
  }
}
