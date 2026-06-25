# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`@forestadmin/agent-client` is a typed HTTP client that talks to a *running* Forest Admin agent's REST API (the `/forest/*` routes). It lets server-side code drive a deployed agent — list/CRUD records, run charts, trigger smart actions, export CSV — without going through the browser UI. It is consumed by sibling packages (e.g. `mcp-server`) that need to invoke an agent programmatically.

## Architecture

Entry point is `createRemoteAgentClient(...)` in `src/index.ts`, which wires an `HttpRequester` into a `RemoteAgentClient`. The object model is a chain of thin wrappers, each holding the shared `HttpRequester`:

- `RemoteAgentClient` (`domains/remote-agent-client.ts`) — root. `extends Chart` (so client-level dashboard charts hang off it). Exposes `.collection(name)` and the permission-override helpers. Generic over a `TypingsSchema` so collection names are type-checked against a generated schema.
- `Collection` (`domains/collection.ts`) `extends CollectionChart` — the workhorse: `list`/`getOne`/`count`/`create`/`update`/`delete`/`search`/`exportCsv`/`capabilities`, plus factories for `.segment()`, `.relation()`, and `.action()`.
- **Two independent chart base classes, NOT a chain.** `Chart` (`domains/chart.ts`) and `CollectionChart` (`domains/collection-chart.ts`) each separately `implements ChartInterface`; `CollectionChart` does **not** extend `Chart`. They differ in behavior, so don't merge them: `Chart.loadChart` POSTs to `/forest/_charts/:name`, while `CollectionChart.loadChart` POSTs to `/forest/_charts/:collection/:name` with a `{ record_id }` body (its chart methods take a `{ recordId }` context). Only `Chart.loadChart` has the "HttpRequester is not initialized" guard.

**Two things flow through everything:**

1. **`HttpRequester`** (`http-requester.ts`) is the only thing that touches the network (superagent). It bearer-auths, always sends `timezone=Europe/Paris`, JSON:API-deserializes responses into camelCase (falling back to raw body/text), and on HTTP errors throws a typed `AgentHttpError(status, body, responseText)`. Network/timeout errors (no response) propagate raw.
2. **`QuerySerializer`** (`query-serializer.ts`) turns a `SelectOptions` (`types.ts`) into the agent's query-string shape (`fields[collection]`, `page[size]`, JSON-stringified `filters`/`sort`).

**Smart actions** are the most stateful part. `Collection.action()` looks up the action's endpoint in the `ActionEndpointsByCollection` schema, then `FieldFormStates` (`action-fields/field-form-states.ts`) POSTs to `:endpoint/hooks/load` to fetch the dynamic form; `setFields` re-POSTs to `:endpoint/hooks/change` to re-evaluate dependent fields. Concrete `ActionField*` classes (`action-fields/`) are typed accessors over those form states; `getField` dispatches on the field type string. `Action.execute()` POSTs the collected values, and `toActionError` (`domains/action.ts`) translates `AgentHttpError` into semantic `ActionRequiresApprovalError` (403) / `ActionFormValidationError` (400/422).

Depends on `@forestadmin/datasource-toolkit` (for `PlainFilter`/`PlainSortClause`/chart types) and `@forestadmin/forestadmin-client` (for `ForestSchemaAction` and condition-tree types).

## Commands

```bash
yarn workspace @forestadmin/agent-client build
yarn workspace @forestadmin/agent-client lint
yarn workspace @forestadmin/agent-client test
# single test:
yarn workspace @forestadmin/agent-client test -- query-serializer.test.ts
yarn workspace @forestadmin/agent-client test -- -t "serializes filters"
```

## Gotchas

- **Backend duality (Node `@forestadmin/agent` vs Ruby `forest_liana`) is a first-class concern.** Operators are PascalCase internally but `QuerySerializer` must emit snake_case (`greater_than`) because the Ruby agent requires it. `fields[...]` projections are joined with commas (not repeated params) because Rack collapses repeated params to the last value. `FieldFormStates.loadInitialState` deliberately swallows a 404 on `/hooks/load` only for Ruby (which omits the route when `hooks.load` is false) and falls back to the schema's static fields. Preserve these behaviors and their explaining comments when editing.
- **Relation field projection** uses the `relation@@@field` separator convention in `fields[]` (see `QuerySerializer.formatFields`); malformed separators are silently skipped.
- `RecordId` can be a composite (array) id; always route ids through `serializeRecordId` (`record-id.ts`) before putting them in a path/body.
- Root-client chart methods on a freshly `new RemoteAgentClient()` (no params) throw "HttpRequester is not initialized" — that guard lives only in `Chart.loadChart`, and only the `createRemoteAgentClient` factory wires the requester up.
