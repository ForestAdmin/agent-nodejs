import type { SchemaFetcher } from './forest-schema-client';
import type { Logger } from '../ports/logger-port';
import type { Metrics } from '../ports/metrics-port';
import type { ForestSchemaCollection } from '@forestadmin/forestadmin-client';

import SchemaUnavailableError from './errors';

export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How long after a `clear()` the cache keeps re-reading the schema, and how often. An invalidation
 * says "the agent just changed its schema", but the SaaS the BFF reads from may not have finished
 * recording it: caching whatever comes back on the very next read would pin the old schema for a
 * full day. Within this window a read costs one request every few seconds, which is nothing next to
 * serving a collection the agent exposes and the BFF 404s.
 */
export const REVALIDATION_WINDOW_MS = 60 * 1000;
export const REVALIDATION_TTL_MS = 5 * 1000;

export const SCHEMA_CACHE_REFRESH_ERROR = 'schema_cache_refresh_error';
export const SCHEMA_CACHE_AGE_SECONDS = 'schema_cache_age_seconds';

export interface SchemaCacheOptions {
  fetcher: SchemaFetcher;
  metrics: Metrics;
  logger?: Logger;
  now?: () => number;
  ttlMs?: number;
}

interface CacheEntry {
  collections: ForestSchemaCollection[];
  fetchedAt: number;
  /**
   * Decided when the entry is written, not when it is read: a read taken while the revalidation
   * window was open cannot be trusted for a day, and must not be promoted to a long-lived entry the
   * moment the window closes.
   */
  expiresAt: number;
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
  private readonly logger: Logger;
  private readonly now: () => number;
  private readonly ttlMs: number;

  private entry: CacheEntry | null = null;
  private inFlight: Promise<ForestSchemaCollection[]> | null = null;
  private revisionValue = 0;
  private generation = 0;
  private revalidatingUntil = 0;

  constructor({
    fetcher,
    metrics,
    logger = () => undefined,
    now = Date.now,
    ttlMs = ONE_DAY_MS,
  }: SchemaCacheOptions) {
    this.fetcher = fetcher;
    this.metrics = metrics;
    this.logger = logger;
    this.now = now;
    this.ttlMs = ttlMs;
  }

  async get(): Promise<ForestSchemaCollection[]> {
    if (this.entry && this.now() < this.entry.expiresAt) {
      this.emitAge();

      return this.entry.collections;
    }

    return this.refresh();
  }

  /**
   * Expire what is cached and re-read it eagerly for a while. Called when something outside knows
   * the schema moved — an agent restarting on a customization refresh, say.
   *
   * The entry is expired, not dropped: every read now goes through a refresh, so nothing the host
   * declared stale is served while the SaaS answers, but the class keeps its safety net — a refresh
   * that fails still has a last good schema to fall back on. Dropping it would turn a restart
   * during a SaaS blip into a `503 schema_unavailable` on every data route.
   */
  clear(): void {
    this.generation += 1;
    this.inFlight = null;
    this.revalidatingUntil = this.now() + REVALIDATION_WINDOW_MS;

    if (this.entry) this.entry = { ...this.entry, expiresAt: this.now() };
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
      // Identity-guarded, because `clear()` detaches the in-flight fetch: a read that lands after an
      // invalidation must start its own, not join the one that read the invalidated schema.
      const pending: Promise<ForestSchemaCollection[]> = this.doRefresh().finally(() => {
        if (this.inFlight === pending) this.inFlight = null;
      });

      this.inFlight = pending;
    }

    return this.inFlight;
  }

  private async doRefresh(): Promise<ForestSchemaCollection[]> {
    const { generation } = this;

    try {
      const collections = await this.fetcher.fetchSchema();

      // An agent always exposes collections, so an empty result is far likelier a broken response
      // than a valid state. Caching it would silently deny everything for 24h — treat it as a
      // failed fetch and fall through to the failure path below.
      if (collections.length === 0) throw new Error('Forest returned an empty schema');

      // Skip the write if a clear() happened while this fetch was in flight: it read the schema the
      // invalidation declared stale, and caching it now would undo the invalidation.
      if (this.generation === generation) {
        const fetchedAt = this.now();

        this.entry = { collections, fetchedAt, expiresAt: fetchedAt + this.ttlFor(fetchedAt) };
        this.revisionValue += 1;
        this.emitAge();
      }

      return collections;
    } catch (error) {
      this.metrics.increment(SCHEMA_CACHE_REFRESH_ERROR);
      // The counter alone cannot tell "the SaaS returned an empty array" from "the SaaS is down"
      // from "the env secret is wrong", and the cause is otherwise swallowed: it becomes the `cause`
      // of a `SchemaUnavailableError` the error middleware serialises without logging.
      this.logger('Warn', 'Schema refresh failed', {
        cause: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
        servedStale: this.entry !== null,
      });

      // Warm cache: keep serving the last good schema (stale), do not poison — the next read
      // re-attempts because `expiresAt` is unchanged and the entry stays expired.
      if (this.entry) {
        this.emitAge();

        return this.entry.collections;
      }

      // Cold cache: nothing to serve.
      throw new SchemaUnavailableError(error);
    }
  }

  private ttlFor(fetchedAt: number): number {
    return fetchedAt < this.revalidatingUntil ? REVALIDATION_TTL_MS : this.ttlMs;
  }

  private emitAge(): void {
    const age = this.ageSeconds();
    if (age !== undefined) this.metrics.gauge(SCHEMA_CACHE_AGE_SECONDS, age);
  }
}
