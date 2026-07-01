# @forestadmin/agent-bff

Standalone REST BFF (Backend-For-Frontend) that lets a trusted third-party UI call a Forest Admin
agent from a browser without learning MCP or JSON:API.

It is a bootable Koa 3 server with a `/health` endpoint, a version header, env-driven config
validation, OAuth (Mode 1) + API-key (Mode 2) auth, and a hardened request edge (timezone, CORS,
auth-mode precedence, structured error contract). The data-endpoint proxy and OpenAPI generation
land in later slices.

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
| `BFF_TOKEN_ENCRYPTION_KEY`| for OAuth | Base64-encoded 32-byte AES-256 key encrypting stored refresh tokens. Until it is set, the `/oauth/*` token-issuance routes are disabled and `/health` reports `degraded`; already-issued `bff_access` tokens still authenticate on `/agent/*` whenever `FOREST_AUTH_SECRET` is present. |
| `HTTP_PORT`          | no       | Server port, integer 0–65535. Defaults to `3450`. `0` binds an OS-assigned ephemeral port. |
| `BFF_ALLOWED_ORIGINS`| no       | Comma-separated CORS allow-list of exact origins (scheme + host + port). No wildcard. Empty ⇒ no cross-origin browser access. |
| `BFF_DEFAULT_TIMEZONE`| no      | Fallback IANA timezone used when a request carries neither an `X-Forest-Timezone` header nor a body `timezone`. |

### Config validation

- A malformed value (a non-http(s) `*_URL`, a `HTTP_PORT` that is not a decimal integer in 0–65535,
  a non-IANA `BFF_DEFAULT_TIMEZONE`) fails fast at boot: the process exits with a clear error and
  never echoes the offending value.
- A required var that is absent (or empty / whitespace-only) does not crash the server. It boots and
  reports the gap through `/health` (503 `degraded`).
- Malformed `BFF_ALLOWED_ORIGINS` entries (including a literal `*`) are dropped and logged once at
  boot (`Warn`); they never enter the allow-list, so a wildcard origin can never be served.

## Request edge (`/agent/*`)

Every agent call flows through a request edge that enforces three cross-cutting concerns before the
(Slice-3) proxy runs. Errors use a structured, type-first contract — `{ error: { type, status,
message, details? } }` — so consumers branch on `error.type`, never on message text.

### Auth-mode precedence

| Presented credentials                          | Result                          |
| ---------------------------------------------- | ------------------------------- |
| `Authorization: Bearer <bff_access>`           | Mode 1 (OAuth session)          |
| `X-Forest-Bff-Key`                             | Mode 2 (API key)                |
| both                                           | `400 ambiguous_credentials`     |
| neither                                        | `401 unauthorized`              |

A Mode 1 `bff_access` that is malformed or wrong-typed → `401 unauthorized`; one that is validly
signed but expired → `401 session_expired` (the client should refresh). Refresh-token reuse remains
a `POST /oauth/token` concern (`session_invalidated`, OAuth/RFC shape).

### CORS

Two layers, both driven by exact-origin matching (case-insensitive scheme/host, default ports
normalized away, no trailing slash, no wildcard, no subdomain matching):

- **Layer 1 (transport)** — the only layer that sets `Access-Control-Allow-Origin`. An origin in
  `BFF_ALLOWED_ORIGINS` is echoed back exactly; anything else gets no CORS headers (the browser
  blocks). Applies to `POST /oauth/token` too. Preflight `OPTIONS` from an allow-listed origin gets
  the allowed methods + headers; credentials are never enabled.
- **Layer 2 (per-key authorization, Mode 2 only)** — when the resolved key has a non-empty
  `allowedOrigins`, the request `Origin` must also be in that list (a missing `Origin` is rejected),
  else `403 origin_not_allowed`. An empty per-key list is a no-op.

**Local development:** browsers still enforce CORS against `localhost`, so add your dev origin(s) to
`BFF_ALLOWED_ORIGINS` (e.g. `BFF_ALLOWED_ORIGINS=http://localhost:4200`) — there is no dev bypass.

### Timezone

The BFF always forwards an explicit `timezone` to the agent, resolved in order: (1) `X-Forest-Timezone`
header, (2) body `timezone` field, (3) `BFF_DEFAULT_TIMEZONE`. None → `400 missing_timezone`; a
non-IANA value → `400 invalid_timezone`.

## Sessions & token rotation

OAuth sessions, opaque refresh tokens, and rotated-out-token reuse detection are held in an
**in-memory, single-process** store. Reuse detection has a one-step grace window: re-presenting the
**most recently** rotated-out token (a benign retry of a refresh whose response was lost) replays
the last issued pair instead of killing the session — the stored refresh token is returned with a
freshly minted access JWT. Re-presenting any **older** rotated-out token still invalidates the whole
session, so a stolen earlier token stays detectable. The grace window is bounded by the rotation
chain, not a timer: once the client advances one more rotation, the previous token is no longer the
latest and falls back to reuse. These guarantees are only correct within one process. Two layers
are process-local: the session/rotation maps in the store, and the in-flight refresh dedup maps
(`inFlightRefreshByPresentedHash` in `oauth-routes`, `inFlightRefreshesBySid` in
`session-lifecycle`) that collapse concurrent refreshes of the same token into a single rotation.
Running the BFF behind a load balancer without sticky sessions breaks reuse detection and the
single-rotation guarantee — and a shared session store alone does not fix it: two concurrent
refreshes landing on different nodes would each try to rotate, one committing and the other failing
with `session_expired`. Horizontal scaling requires both a shared session store **and** a shared
(or node-pinned) refresh-coordination mechanism.

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
