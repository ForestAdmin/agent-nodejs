# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`@forestadmin/agent-testing` provides utilities to test Forest Admin agent customizations (actions, hooks, segments, charts) end-to-end in Jest, without talking to the real Forest Admin SaaS servers. It stands up a fake Forest server and a pre-authenticated client that drives the agent over HTTP exactly like the Forest frontend would.

## Architecture

Two layers cooperate to remove the real Forest backend from the test loop:

- **`ForestServerSandbox`** (`forest-server-sandbox.ts`) — a raw `node:http` server that mocks the Forest API endpoints the agent calls at boot/runtime: OIDC discovery/registration (`/oidc/*`), event subscription, IP whitelist, the schema handshake (`/forest/apimaps/hashcheck`, mocked to `{ sendSchema: false }` so the agent never uploads its schema), and crucially `/liana/v4/permissions/environment`. It derives V4 permissions on the fly by walking the cached `ForestSchema` and applying any `PermissionsOverride` pushed to `/permission-override`. Note: `/agent-schema` is a sandbox-only channel — it is **not** an agent endpoint; the test client (`createAgentTestClient`) posts the parsed schema there so the sandbox can derive permissions. One sandbox serves multiple agents — caches are keyed by the `forest-secret-key` header.
- **`TestableAgentBase`** (the exported `AgentTestClient` type) — extends `RemoteAgentClient` from `@forestadmin/agent-client`, so all the `.collection(name).list()/create()/action()` ergonomics come from that sibling package. It is built from action endpoints extracted out of the schema (`SchemaConverter`) plus an `HttpRequester` carrying a self-signed JWT for the mock `CURRENT_USER`.

Entry points (`index.ts`):
- **`createForestServerSandbox(port)` + `createAgentTestClient(opts)`** — the supported path. You start your own agent (any language) pointing at the sandbox; the client uploads the schema to the sandbox, then issues requests. `port: 0` (or sandbox port 0) binds a random free port.
- **`createTestableAgent(customizer, opts)` → `TestableAgent`** — *deprecated*. Boots a Node agent in-process via `createAgent`, mounts it on a standalone server, and stubs the Forest client with `ForestAdminClientMock`. Useful only for the Node SDK's own tests.

`Benchmark` (via `client.benchmark()`) is a small helper to time a request N times and report min/max/avg.

Authentication is faked: `http-requester-mock.ts` signs a JWT for `CURRENT_USER` (`forest-admin-client-mock.ts`), an admin user with `roleId: 1`. Permission overrides map onto role `1` vs `0`, so a single privileged role is all the sandbox models.

## Commands

```bash
yarn workspace @forestadmin/agent-testing build   # tsc
yarn workspace @forestadmin/agent-testing test    # jest
yarn workspace @forestadmin/agent-testing lint     # eslint src test

# single test
yarn workspace @forestadmin/agent-testing test -- test/action.test.ts
yarn workspace @forestadmin/agent-testing test -- -t "name fragment"
```

## Gotchas

- `@forestadmin/agent` is a peer dependency, marked **optional**, and pulled in as a devDependency. It is only needed for the deprecated `createTestableAgent` path; consumers using `createAgentTestClient` don't need it. In `createTestableAgent` the `forestAdminClient` is cast to `any` on purpose to tolerate version skew between the consumer's `forestadmin-client` and this package's.
- This package mocks Forest behavior by reimplementing its endpoints/permission shape. When `agent-client` or `forestadmin-client` change their request paths, permission V4 types, or auth flow, the sandbox and mocks here must be updated in lockstep — there's no shared contract enforcing it.
- The sandbox writes to stdout/stderr (`console.log` on listen, `console.warn` on unmocked routes). An unhandled route returns 404 with a `Sandbox: no mock for ...` detail — watch test logs for these to spot a new endpoint the agent started calling.
- Temporary schema files use the `reserved-forestadmin-schema-test-` prefix in the OS tmpdir; `SchemaPathManager` only deletes paths containing that prefix, so a caller-supplied `schemaPath` is never removed on `stop()`.
