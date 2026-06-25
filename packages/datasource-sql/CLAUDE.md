# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`@forestadmin/datasource-sql` connects a Forest Admin agent to a SQL database (Postgres, MySQL, MariaDB, MSSQL, SQLite). It connects, *introspects* the live schema, builds Sequelize models/relations from it, then wraps the result in `@forestadmin/datasource-sequelize`. It is the runtime-discovery sibling of `datasource-sequelize` (which expects you to bring your own models).

## Architecture

The public entry is `src/index.ts`. `createSqlDataSource(uriOrOptions, options)` returns a `DataSourceFactory` that the agent calls with a `Logger`. The pipeline:

1. **Connect** (`src/connection/`) — `ConnectionOptions` normalizes a URI string *or* plain options (dialect aliases like `mysql2`→`mysql`, ssl modes, debug URI without credentials). `connect()` optionally stands up a `ReverseProxy` chained to a `SocksProxy` and/or `SshTunnel` (the agent never talks to the DB directly when a tunnel/proxy is configured — it points Sequelize at the local reverse proxy), then builds the Sequelize instance and tests the connection with a timeout.
2. **Introspect** (`src/introspection/`) — `Introspector.introspect()` reads tables, columns, FKs, unique indexes and views into a dialect-agnostic `Introspection` object (`types.ts`: `Table`/`ColumnType`). Per-dialect SQL lives behind the `IntrospectionDialect` interface, selected by `dialect-factory.ts`. Introspection can be precomputed and passed back via `options.introspection` to skip the live read (used by forest-cloud).
3. **Build ORM** (`src/orm-builder/`) — `ModelBuilder.defineModels` + `RelationBuilder.defineRelations` turn the introspection into Sequelize models and associations on the instance.
4. **Wrap** — the Sequelize instance is handed to `SequelizeDataSource`, then wrapped by `SqlDatasource` (`src/decorators/`), which applies `ViewDecorator` only to collections that came from DB views (writes disabled on views).

## Commands

```bash
yarn workspace @forestadmin/datasource-sql build   # tsc
yarn workspace @forestadmin/datasource-sql lint     # eslint src test
yarn workspace @forestadmin/datasource-sql test     # jest

# single test (files follow .unit.test.ts / .integration.test.ts)
yarn workspace @forestadmin/datasource-sql test -- test/introspection/introspector.unit.test.ts
yarn workspace @forestadmin/datasource-sql test -- -t "name of test"
```

Many tests run against real databases. `docker-compose.yml` provides every supported engine/version (postgres9/16, mysql5/8, mariadb10/11, mssql2017/2022) plus a socks-proxy and ssh-server for tunnel tests — `docker compose up` before running the suite locally.

## Gotchas

- **Introspection format is versioned.** `Introspector.FORMAT_VERSION` (currently 3) gates backward-compat: an *un-versioned* legacy shape is a bare `Table[]` (detected via `Array.isArray`); versioned v1 is `{ tables, version: 1 }`, v2 added `source`, v3 added `views`. `migrateOrIntrospect` upgrades old shapes to the latest format; a stored introspection with a *higher* version (or a different `source`) throws `IntrospectionFormatError`. Bump `FORMAT_VERSION` and extend `migrateIntrospectionInLatestFormat` when the schema shape changes.
- **Composite foreign keys and cross-schema relations are silently dropped** (logged as warnings) — Sequelize doesn't support composite keys. Don't assume every DB FK becomes a relation.
- **Sequelize is inconsistent about table identifiers** (string vs `{tableName, schema}`, and Postgres schema-filtering bugs). The introspector normalizes identifiers and re-filters by schema manually; preserve those workarounds when touching `getTableNames`/`getTableReferences`.
- Soft-delete columns (`deletedAt`/`deleted_at`) are treated as Sequelize `paranoid` timestamps; `options.displaySoftDeleted` (true or a list of table names) opts specific tables back into showing soft-deleted rows.
