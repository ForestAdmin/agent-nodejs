import type { SchemaFetcher } from './forest-schema-client';
import type { Metrics } from '../ports/metrics-port';
import type { ForestSchemaCollection } from '@forestadmin/forestadmin-client';

import SchemaUnavailableError from './errors';

export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const SCHEMA_CACHE_REFRESH_ERROR = 'schema_cache_refresh_error';
export const SCHEMA_CACHE_AGE_SECONDS = 'schema_cache_age_seconds';

export interface SchemaCacheOptions {
  fetcher: SchemaFetcher;
  metrics: Metrics;
  now?: () => number;
  ttlMs?: number;
}

interface CacheEntry {
  collections: ForestSchemaCollection[];
  fetchedAt: number;
}

/**
 * Caches the agent schema for 24h. The TTL only *triggers* a refresh attempt: the last good
 * schema keeps being served until a refresh succeeds. A cold cache (no last good) surfaces a
 * typed `SchemaUnavailableError`. A monotonic `revision` increments on each successful refresh so
 * a consumer can detect a new schema generation explicitly.
 */
export default class SchemaCache {
  private readonly fetcher: SchemaFetcher;
  private readonly metrics: Metrics;
  private readonly now: () => number;
  private readonly ttlMs: number;

  private entry: CacheEntry | null = null;
  private inFlight: Promise<ForestSchemaCollection[]> | null = null;
  private revisionValue = 0;

  constructor({ fetcher, metrics, now = Date.now, ttlMs = ONE_DAY_MS }: SchemaCacheOptions) {
    this.fetcher = fetcher;
    this.metrics = metrics;
    this.now = now;
    this.ttlMs = ttlMs;
  }

  async get(): Promise<ForestSchemaCollection[]> {
    if (this.entry && this.now() - this.entry.fetchedAt < this.ttlMs) {
      this.emitAge();

      return this.entry.collections;
    }

    return this.refresh();
  }

  ageSeconds(): number | undefined {
    if (!this.entry) return undefined;

    return Math.floor((this.now() - this.entry.fetchedAt) / 1000);
  }

  get revision(): number {
    return this.revisionValue;
  }

  private async refresh(): Promise<ForestSchemaCollection[]> {
    if (!this.inFlight) {
      this.inFlight = this.doRefresh().finally(() => {
        this.inFlight = null;
      });
    }

    return this.inFlight;
  }

  private async doRefresh(): Promise<ForestSchemaCollection[]> {
    try {
      const collections = await this.fetcher.fetchSchema();

      // An agent always exposes collections, so an empty result is far likelier a broken response
      // than a valid state. Caching it would silently deny everything for 24h — treat it as a
      // failed fetch and fall through to the failure path below.
      if (collections.length === 0) throw new Error('Forest returned an empty schema');

      this.entry = { collections, fetchedAt: this.now() };
      this.revisionValue += 1;
      this.emitAge();

      return collections;
    } catch (error) {
      this.metrics.increment(SCHEMA_CACHE_REFRESH_ERROR);

      // Warm cache: keep serving the last good schema (stale), do not poison — the next read
      // re-attempts because `fetchedAt` is unchanged and the entry stays expired.
      if (this.entry) {
        this.emitAge();

        return this.entry.collections;
      }

      // Cold cache: nothing to serve.
      throw new SchemaUnavailableError(error);
    }
  }

  private emitAge(): void {
    const age = this.ageSeconds();
    if (age !== undefined) this.metrics.gauge(SCHEMA_CACHE_AGE_SECONDS, age);
  }
}
