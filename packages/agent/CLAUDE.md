# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`@forestadmin/agent` is the main entry point of the SDK. It is the package end users install: `createAgent(options)` returns an `Agent` to which they attach datasources, customizations, charts and plugins, then mount on their HTTP server. It turns a customized datasource into the Forest Admin REST API and pushes the schema (`apimap`) to the Forest servers.

## Architecture

The `Agent` class (`src/agent.ts`, default export, aliased as `AgentBuilder` in docs) is the orchestrator and the only public surface besides `createAgent`. It composes sibling packages:

- **Customization** is delegated to `@forestadmin/datasource-customizer`. `addDataSource`/`customizeCollection`/`addChart`/`use` all forward to an internal `DataSourceCustomizer`. The agent never manipulates collections directly — it owns the HTTP layer; the customizer owns the data layer.
- On `start()`/`restart()`, `buildRouterAndSendSchema()` rebuilds a **second** `DataSourceCustomizer` with `strategy: 'NoCode'` (`nocodeCustomizer`) that wraps the user's factory and layers no-code customizations (`CustomizationService`) on top. The resulting `DataSource` is what routes and the schema are built from. So there are two customizer stacks: the user-facing one and the no-code one used at runtime.
- **Routes** (`src/routes/`, assembled by `makeRoutes` in `routes/index.ts`) are generated dynamically per datasource: root routes, then CRUD/capabilities/native-query per collection, api-charts, related routes (built by relation type — `ManyToMany`/`OneToMany` get list/count/csv/associate/dissociate, `OneToOne`/`ManyToOne` get update-relation), action routes, plus opt-in AI and workflow-executor routes. There is no per-segment route. Each route extends `BaseRoute`/`CollectionRoute` and registers itself onto a `@koa/router`. Routes are sorted by `RouteType` (`src/types.ts`) so logger/error/auth middleware load before private routes — order is load-bearing, do not reorder by alphabet.
- **Services** (`src/services/`, built by `makeServices`) are the shared dependencies injected into every route: `authorization` (delegates permission checks to `@forestadmin/forestadmin-client`), `serializer` (JSON:API), `chartHandler`, and `segmentQueryHandler` (applies the requested segment as a filter inside the `list`/`count` routes via `handleLiveQuerySegmentFilter` — this is where segments are handled, not at route generation).
- **`FrameworkMounter`** (`src/framework-mounter.ts`, the `Agent` base class) handles mounting onto Express/Fastify/Koa/NestJS/standalone. It mounts forest routes at `/{prefix}/forest` and remounts the router in place on every `restart()` (triggered by `onRefreshCustomizations`) without restarting the HTTP server.
- **MCP** is opt-in. `mountAiMcpServer()` defers loading `@forestadmin/mcp-server` via dynamic `import()` so non-MCP users don't pay for it. The MCP HTTP callback is injected ahead of the body parser via `McpMiddleware`.

`SchemaGenerator` (`src/utils/forest-schema/`) builds the `.forestadmin-schema.json` apimap from the datasource; it is re-exported for the `agent-generator` package.

## Commands

```bash
yarn workspace @forestadmin/agent build      # tsc
yarn workspace @forestadmin/agent lint       # eslint src test
yarn workspace @forestadmin/agent test       # jest (run from repo root or package)

# single test file / single test by name
yarn workspace @forestadmin/agent test -- test/routes/access/list.test.ts
yarn workspace @forestadmin/agent test -- -t "should return the records"
```

## Gotchas

- Tests run with `NODE_OPTIONS=--experimental-vm-modules` (ESM). Keep this in mind when adding test tooling.
- In production (`isProduction`), the schema is read from `schemaPath` on disk and NOT regenerated — the file must be committed/shipped. Exception: experimental no-code features force a rebuild even in production.
- `AgentOptionsWithDefaults` is `Readonly<Required<...>>`: defaults are applied and validated by `OptionsValidator` in the constructor, so route/service code can assume every option is present.
- The framework `mountOn*` methods take `any` (the host app instance) on purpose — the HTTP frameworks are peer/dev deps, not runtime deps, so the agent stays framework-agnostic.
