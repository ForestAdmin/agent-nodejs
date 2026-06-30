# @forestadmin/agent-bff

Standalone REST BFF (Backend-For-Frontend) that lets a trusted third-party UI call a Forest Admin
agent from a browser without learning MCP or JSON:API.

This package is the Slice 0 scaffold: a bootable Koa 3 server with a `/health` endpoint, a version
header, and env-driven config validation. Auth, data endpoints, and OpenAPI generation land in later
slices.

## Usage

Packaged / production — run the bin:

```bash
forest-bff
```

Local development — copy the env template, fill it in, and start with it loaded:

```bash
cp .env.example .env   # then fill in the secrets
yarn build
yarn start:dev         # node --env-file=.env dist/cli.js
```

`yarn start` runs the built server without loading a `.env` (env comes from the shell).

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

## Sessions & token rotation

OAuth sessions, opaque refresh tokens, and rotated-out-token reuse detection are held in an
**in-memory, single-process** store. Refresh-token rotation and reuse detection (a replayed
rotated-out token invalidates the whole session) are only correct within one process. Two layers
are process-local: the session/rotation maps in the store, and the in-flight refresh dedup maps
(`inFlightRefreshByPresentedHash` in `oauth-routes`, `inFlightRefreshesBySid` in
`session-lifecycle`) that collapse concurrent refreshes of the same token into a single rotation.
Running the BFF behind a load balancer without sticky sessions breaks reuse detection and the
single-rotation guarantee — and a shared session store alone does not fix it: two concurrent
refreshes landing on different nodes would each try to rotate, one committing and the other failing
with `session_expired`. Horizontal scaling requires both a shared session store **and** a shared
(or node-pinned) refresh-coordination mechanism.

### Manual QA

`scripts/qa-refresh-e2e.sh` drives the whole refresh flow against a running BFF + Forest server and
asserts each step (login → token → refresh/rotation → replay/reuse → unknown/missing error paths).
Everything is automated except the browser login (PKCE + Forest credentials), which the script hands
off interactively: it prints the authorize URL, you log in, then paste the `code` back.

```bash
BFF_URL=http://localhost:3450 \
FOREST_URL=http://localhost:3001 \
REDIRECT_URI=http://localhost:4200/callback \
./scripts/qa-refresh-e2e.sh
```

## `/health`

```jsonc
// 200 — all required config present
{ "status": "ok", "version": "<package version>" }
// 503 — one or more required keys missing
{ "status": "degraded", "version": "<package version>" }
```

The body never discloses which config keys are present or missing — that would leak the internal
config surface to an unauthenticated probe. Missing keys are logged once at startup (`Warn`) for
operators. Every response carries the `X-Forest-Bff-Version` header, read from `package.json`.
