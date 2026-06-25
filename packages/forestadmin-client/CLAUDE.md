# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`@forestadmin/forestadmin-client` is the SDK layer that talks to the Forest Admin SaaS server (`api.forestadmin.com` by default). It owns everything an agent needs from the platform: permissions, rendering scopes, OIDC auth, schema push, IP whitelist, activity logs, model customizations, MCP server configs, and live cache invalidation. Sibling packages (`@forestadmin/agent`, `mcp-server`, `agent-generator`) consume it via the default export and the exported service classes/interfaces.

## Architecture

The package is a small dependency-injection graph assembled in one place:

- `index.ts` — `createForestAdminClient(options)` is the public entry point. It builds an HTTP transport (`ForestHttpApi`), wires the services via `buildApplicationServices`, and returns a `ForestAdminClientWithCache`.
- `build-application-services.ts` — the composition root. It applies option defaults and instantiates every service, threading a single `ForestAdminServerInterface` (the transport) and `optionsWithDefaults` into each. Read this file first to understand how the pieces connect.
- `forest-admin-client-with-cache.ts` — the `ForestAdminClient` facade. It exposes the services as public readonly fields and delegates to them; consumers reach into `client.permissionService`, `client.schemaService`, etc.

Two layers worth understanding:

1. **Transport vs. service.** `ForestHttpApi` (in `permissions/`) implements `ForestAdminServerInterface` — the only thing that does raw HTTP, via `ServerUtils.query` (superagent, `/liana/...` routes, `forest-secret-key` header). Every service receives this interface, so tests inject a mock transport instead of stubbing HTTP. The interface methods are all optional (`?:`) because different consumers supply partial implementations.
2. **Caching + live refresh.** Permission/rendering services cache server responses (TTL via `permissionsCacheDurationInSeconds`, see `utils/ttl-cache.ts`). `EventsSubscriptionService` opens a Server-Sent-Events stream to the server; on a refresh event `NativeRefreshEventsHandlerService` invalidates the relevant caches. When `instantCacheRefresh` is false, callers must invalidate manually via `markScopesAsUpdated`.

Most subdirectories are one self-contained concern (`permissions/`, `auth/`, `schema/`, `activity-logs/`, `ip-whitelist/`, `model-customizations/`, `mcp-server-config/`, `charts/`, `events-subscription/`). `utils/` holds shared plumbing: `server.ts` (HTTP), `ttl-cache.ts`, context-variable injection for charts/segments, and the default logger.

## Commands

```bash
yarn workspace @forestadmin/forestadmin-client build   # tsc
yarn workspace @forestadmin/forestadmin-client lint
yarn workspace @forestadmin/forestadmin-client test
# single test file or test name:
yarn workspace @forestadmin/forestadmin-client test -- permissions/permission-with-cache.test.ts
yarn workspace @forestadmin/forestadmin-client test -- -t "canOnCollection"
```

## Gotchas

- **`index.ts` is the public API contract.** It re-exports a large, deliberate set of types, error classes, and service classes (`SchemaService`, `ActivityLogsService`, `ForestHttpApi`, `ServerUtils`, etc.) that `agent`, `mcp-server`, and `agent-generator` import directly. Adding/removing an export is a cross-package change — check consumers before touching the export list.
- **Do not call HTTP outside `ServerUtils`.** All server traffic goes through `utils/server.ts`, which maps responses to typed errors (`ForbiddenError`, `NotFoundError`, `HttpError`). Add new server calls as methods on `ForestHttpApi` / `ForestAdminServerInterface`, not inline.
- **Two different matching schemes — don't conflate them.** Action permissions match on *plain* colon-delimited identifiers: `generate-action-identifier.ts` builds strings like `custom:${collection}:${action}:${event}` / `collection:${collection}:${action}`, and `permissions/action-permission.ts` `can()` compares them as raw strings against Set/Map keys. Segment queries (`is-segment-query-authorized.ts`) also match by raw string equality, with only light normalization (`.replace(/;\s*/i, '').trim()`). **Only charts are hashed** (`hash-chart.ts`, `object-hash`): `rendering-permission.ts` checks `permissions.charts.has(chartHash)` against a Set of server-allowed chart hashes (an authorization allow-list, not a cache). `hashChart` uses `respectType: false` + `excludeKeys` to drop unknown/null/undefined keys, so it deliberately *tolerates* serialization and extra-key differences.
- **`experimental` option gates `onRefreshCustomizations`** — that callback silently no-ops unless `options.experimental` is set.
- Depends on `@forestadmin/ai-proxy` and `@forestadmin/datasource-toolkit` only as devDependencies (for types like `ToolConfig`); keep them out of `dependencies`.
