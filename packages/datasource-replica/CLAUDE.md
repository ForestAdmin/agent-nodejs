# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`@forestadmin/datasource-replica` builds a Forest Admin datasource that mirrors an external/custom data source into a local cache database (SQLite in-memory by default), then serves Forest Admin requests from that cache. Users supply pull/push handlers describing *how* to fetch data; this package owns the *when* (scheduling, batching) and the *where* (the cache, kept in sync). It is the base for higher-level replica datasources rather than a connector to a specific system.

## Architecture

`createReplicaDataSource(options)` (src/index.ts) returns a `DataSourceFactory`. At factory time it:

1. Opens a Sequelize connection to the cache DB (`createSequelize`, src/sequelize.ts) and resolves options (src/options/index.ts).
2. **Schema resolution / discovery** — if `options.schema` is not provided, it runs the synchronization once through `AnalysisPassThough` (src/synchronization/analysis-passthrough.ts) to sniff the shape of incoming records, then `buildSchema` infers a `CollectionReplicaSchema[]`. This is why `createSequelize`/`createModels` is two-phased: the schema may be unknown until data arrives.
3. Creates the Sequelize models, wraps them in a `@forestadmin/datasource-sequelize` datasource, hides the internal `*_pending_operations` / `*_metadata` tables via a `PublicationCollectionDataSourceDecorator` from `@forestadmin/datasource-customizer`.
4. Stacks decorators (child → parent): **sequelize → publication → TriggerSync → Write → Schema**, returning the Schema decorator as the live datasource.

**Two cooperating halves:**
- **Source** (`SynchronizationSource`, default impl `CustomerSource` in src/synchronization/customer-source.ts) — owns a single-threaded run queue (`tick()` + `isRunning`). It serializes push-deltas, pull-dumps, and pull-deltas, runs the user's handlers, and persists `startup_state` / `delta_state` in the `*_metadata` table so restarts resume correctly. Cron schedules use `croner`.
- **Target** (`SynchronizationTarget`, impl `CacheTarget` in src/synchronization/cache-target.ts) — applies dumps (truncate-then-bulkCreate on the first page) and deltas (destroy + upsert in a transaction) into the cache models.

**Sync triggers** flow from `SyncCollectionDecorator` (src/decorators/sync/collection.ts): list/aggregate enqueue `before-*` pull-deltas when `pullDeltaOnBeforeAccess`; create/update/delete enqueue `after-*` pull-deltas when `pullDeltaOnAfterWrite`. Writes themselves are forwarded to the user's `createRecordHandler`/`updateRecordHandler`/`deleteRecordHandler` by `WriteCollectionDecorator` only for *root* collections (flattened sub-models are not directly writable).

**Flattening** (src/flattener.ts, src/options/flattener) explodes nested object/array fields of a record into either extra columns (`asFields`) or separate child models (`asModels`, keyed by a synthetic `_fid`). Both the cache schema and every dump/delta record pass through this; sub-model rows are namespaced `parent.asModel` and cleaned up via `_fid` prefix matching on delta apply.

## Commands

```bash
yarn workspace @forestadmin/datasource-replica build
yarn workspace @forestadmin/datasource-replica lint
yarn workspace @forestadmin/datasource-replica test
# single test file or name
yarn workspace @forestadmin/datasource-replica test -- path/to/file.test.ts
yarn workspace @forestadmin/datasource-replica test -- -t "test name"
```

## Gotchas

- **Handler/flag pairing is validated at construction**: `pullDeltaHandler` requires at least one `pullDelta*` flag and vice-versa, else `CustomerSource` throws.
- **Metadata keys are persisted strings**: startup state is stored under the misspelled key `statup_state`; `delta_state` / startup state are JSON-stringified in the `*_metadata` table — don't rename without a migration story (the typo is load-bearing once persisted).
- **Pull handler errors are swallowed**: failed *pull* dump/delta iterations log a `Warn` and stop the loop rather than throwing (`runPullDump`/`runPullDelta`), so a broken handler silently leaves the cache stale. The **push** path (`runPushDelta` → `target.applyDelta`) has no try/catch, so a push-delta error rejects/propagates instead.
- **`cacheNamespace` prefixes all internal tables** (`<ns>_metadata`, `<ns>_pending_operations`), letting multiple replicas share one DB; the publication decorator relies on these exact names to keep them hidden.
- **Schema discovery is a one-time cost on a persistent DB**: omitting `schema` runs a full analysis pass before the datasource is usable, but the result is persisted to `*_metadata` (`id: 'schema'`) and reused by `getSchema` on later startups. It only re-runs every startup because the default `cacheInto` is in-memory sqlite (`sqlite::memory:`), lost between runs — point `cacheInto` at a persistent DB to pay it once.
