# @forestadmin/agent-bff

Standalone REST BFF (Backend-For-Frontend) that lets a trusted third-party UI call a Forest Admin
agent from a browser without learning MCP or JSON:API.

This package is the Slice 0 scaffold: a bootable Koa 3 server with a `/health` endpoint, a version
header, and env-driven config validation. Auth, data endpoints, and OpenAPI generation land in later
slices.

## Usage

```bash
forest-bff
```

## Configuration

| Env var              | Required | Description                                                          |
| -------------------- | -------- | -------------------------------------------------------------------- |
| `FOREST_AUTH_SECRET` | yes      | Agent JWT signing secret (never logged or echoed).                   |
| `FOREST_ENV_SECRET`  | yes      | Forest SaaS environment secret (`forest-secret-key`), server-to-server. |
| `FOREST_SERVER_URL`  | yes      | Forest SaaS API base URL.                                            |
| `FOREST_APP_URL`     | yes      | Forest front base URL (OAuth front-channel, later slices).          |
| `AGENT_URL`          | yes      | The customer agent base URL the BFF calls via agent-client.          |
| `HTTP_PORT`          | no       | Server port, integer 0–65535. Defaults to `3450`. `0` binds an OS-assigned ephemeral port. |

### Config validation

- A malformed value (a non-http(s) `*_URL`, a `HTTP_PORT` that is not a decimal integer in 0–65535)
  fails fast at boot: the process exits with a clear error and never echoes the offending value.
- A required var that is absent (or empty / whitespace-only) does not crash the server. It boots and
  reports the gap through `/health` (503 `degraded`).

## `/health`

```jsonc
// 200 — all required config present
{ "status": "ok", "version": "<package version>", "config": { "FOREST_AUTH_SECRET": true, "...": true } }
// 503 — one or more required keys missing
{ "status": "degraded", "version": "<package version>", "config": { "FOREST_SERVER_URL": false, "...": true } }
```

`config` reports presence booleans only, never secret values. `HTTP_PORT` is not listed: it has a
default, so it is never a missing-required-key case.

Every response carries the `X-Forest-Bff-Version` header, read from `package.json`.
