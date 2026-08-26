# @forestadmin/agent-bff

Standalone REST BFF (Backend-For-Frontend) that lets a trusted third-party UI call a Forest
agent from a browser without learning MCP or JSON:API.

It is a bootable Koa 3 server with a `/health` endpoint, a version header, env-driven config
validation, OAuth (Mode 1) + API-key (Mode 2) auth, and a hardened request edge (timezone, CORS,
auth-mode precedence, structured error contract), and it serves and exports its own OpenAPI
document.

## The routes it serves

Everything the agent proxy exposes lives under `/agent/v1`. The data and action routes are `POST`
— the filter, projection and paging all travel in the body, never in the query string:

| Route | Method | What it does |
| --- | --- | --- |
| `/agent/v1/{collection}/list` · `/count` | `POST` | list or count records of a collection |
| `/agent/v1/{collection}/relations/{relation}/list` · `/count` | `POST` | same, through a **to-many** relation — to-one relations are not listable and 404 by design |
| `/agent/v1/{collection}/actions/{action}/form` · `/execute` | `POST` | load a Smart Action's form, then run it |
| `/agent/v1/permissions` | `GET` | what the caller may see and do, **as display hints** for graying out UI — never an authorization decision |
| `/agent/openapi.json` | `GET`/`HEAD` | the unfolded document, auth-gated, when `BFF_OPENAPI_ENABLED` is on |

`/health` and `/oauth/*` sit outside the prefix and outside the auth edge.

**The agent enforces permissions and scopes, not the BFF.** Each proxied call carries a
short-lived agent token the BFF mints for the caller, so a request reaches the agent as that
person and comes back filtered exactly as it would for them in Forest. A collection the current
schema no longer exposes is re-checked on every call, so a schema refresh can never leave a
dropped collection reachable.

## Usage

### Docker (recommended)

```bash
cp .env.example .env   # then fill in the secrets
docker compose up
```

The template targets a local, non-containerised run, so one value has to change for Docker:
set `AGENT_URL=http://host.docker.internal:3351`. Left at `localhost`, it resolves to the BFF
container itself and every agent call fails (see the note below).

The `docker-compose.yml` at the root of this package starts a single BFF instance. See
`.env.example` for the full list of environment variables and their descriptions.

Or run the image directly:

```bash
docker run -d \
  -p 3450:3450 \
  --stop-timeout 15 \
  --add-host host.docker.internal:host-gateway \
  -e FOREST_AUTH_SECRET="..." \
  -e FOREST_ENV_SECRET="..." \
  -e FOREST_SERVER_URL="https://api.forestadmin.com" \
  -e FOREST_APP_URL="https://app.forestadmin.com" \
  -e AGENT_URL="http://host.docker.internal:3351" \
  -e BFF_TOKEN_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  ghcr.io/forestadmin/agent-bff:latest
```

> **Note:** When the BFF runs in Docker and your agent runs on the host machine, use
> `host.docker.internal` instead of `localhost` in `AGENT_URL`. Docker Desktop resolves that
> name natively; on Docker Engine for Linux it does not exist unless you map it, hence the
> `--add-host` above (the Compose setup does the same through `extra_hosts`).

The image's entry point is the CLI, so the subcommands below work the same way:

```bash
docker run --rm ghcr.io/forestadmin/agent-bff:latest openapi > openapi.json
```

Tags follow the npm package: `:latest`, `:1`, `:1.20` and the immutable `:1.20.2`.

On `SIGTERM` or `SIGINT` the BFF stops accepting connections and gives the requests already in
flight 10 seconds to finish before cutting their sockets, then exits 0. A second signal gives up on
the wait and exits 1.

Allow for that in your orchestrator's grace period. The whole budget is up to 11 seconds — the 10
second deadline plus a 1 second fallback for the exit itself — and `docker stop` defaults to 10,
so under load it would SIGKILL exactly when the shutdown is doing its job. Hence `--stop-timeout 15`
above and `stop_grace_period: 15s` in the Compose file; on Kubernetes the default
`terminationGracePeriodSeconds` of 30 already covers it.

### Observability (OpenTelemetry)

The Docker image ships with [OpenTelemetry](https://opentelemetry.io/) APM built in, and works with
any OTLP-compatible backend (Datadog, Grafana Tempo, Jaeger, Honeycomb, etc.). It is **off by
default** and turns on as soon as you point it at an OTLP receiver — no code changes or extra
installs required. Tracing is set up before the app starts (auto-instrumentation for HTTP and the
outbound calls to the agent and the Forest SaaS). The graceful shutdown described above waits for
the buffered spans to be exported before it exits, but gives that its own 2 second deadline rather
than the 10 seconds in-flight requests get: an unreachable collector costs you the last spans, never
the ability to stop. Worst case it adds ~3 seconds to a shutdown.

Configure it entirely through the standard OTel environment variables:

| Variable | Description |
| --- | --- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP receiver URL (e.g. `http://collector:4318`). **Tracing stays disabled until this is set.** |
| `OTEL_SERVICE_NAME` | Service name reported in traces. Default: `forestadmin-agent-bff`. |
| `OTEL_RESOURCE_ATTRIBUTES` | Extra resource attributes, e.g. `deployment.environment=production`. |
| `OTEL_SDK_DISABLED` | Set to `true` (case-insensitive) to force-disable tracing even when an endpoint is configured. |
| `OTEL_TRACES_EXPORTER` | Unset (or `otlp`) exports over OTLP to the endpoint above. Any other value — `none`, `console`, a list — is left to the SDK to configure from the environment, and only the OTLP exporter ships in the image. Instrumentation stays on either way, so trace context keeps propagating to the agent and the Forest SaaS. |

```bash
docker run -d \
  -p 3450:3450 \
  --stop-timeout 15 \
  --add-host host.docker.internal:host-gateway \
  -e FOREST_AUTH_SECRET="..." \
  -e FOREST_ENV_SECRET="..." \
  -e FOREST_SERVER_URL="https://api.forestadmin.com" \
  -e FOREST_APP_URL="https://app.forestadmin.com" \
  -e AGENT_URL="http://host.docker.internal:3351" \
  -e BFF_TOKEN_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  -e OTEL_EXPORTER_OTLP_ENDPOINT="http://collector:4318" \
  ghcr.io/forestadmin/agent-bff:latest
```

> **Note:** These variables only do anything in the Docker image. The image's entry point loads
> the tracing preload before the CLI; the npm `forest-bff` bin runs the CLI on its own, and the
> OpenTelemetry packages are not npm dependencies — so outside Docker an `OTEL_*` variable is
> read by nothing and the process starts untraced, silently.

### Without Docker

Packaged / production — run the bin:

```bash
forest-bff
```

Export the OpenAPI document without booting the server. Needs no configuration, so
it works in CI to commit the document, diff it, or generate a client:

```bash
forest-bff openapi > openapi.json          # stdout, redirected
forest-bff openapi --output                # writes ./openapi.json
forest-bff openapi --output docs/api.json  # writes that path
```

The document comes in two forms, and the command picks one from the environment:

- **Unfolded** when `FOREST_SERVER_URL`, `FOREST_ENV_SECRET`, `FOREST_AUTH_SECRET` and `AGENT_URL`
  are all set: one path per exposed collection, per to-many relation and per action, each carrying
  the collection's real field set. This is the form to generate a client from. The command reads the
  Forest schema and asks the agent for each collection's capabilities, signing its own short-lived
  agent token with `FOREST_AUTH_SECRET`. A deployment configured this way but whose schema cannot be
  read exits 1 rather than emitting the generic document, which would look like a complete answer.
- **Generic** when that configuration is absent: the six runtime routes with `{collection}`,
  `{relation}` and `{action}` as path parameters and no field enumerated. `info.description` says
  which form the document is.

Either way the runtime routes stay generic — only the document unfolds.

`--output` takes the next argument as the destination unless it is empty or starts with
`-`; the default `openapi.json` is written only when `--output` is the last argument, and
a leftover token is rejected like any other extra. A missing parent directory is created,
an existing file is overwritten, and a destination that cannot be written exits 1 with the
path on stderr. The path is confirmed on stderr, so stdout stays empty and pipeable.

`forest-bff --help` and `forest-bff --version` print to stdout and exit 0, ignoring
anything that follows. An unknown command, or an argument other than `--output` after
`openapi`, exits 1 with the reason on stderr.

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
| `FOREST_APP_URL`     | yes      | Forest front base URL, used to build the OAuth front-channel redirect (`src/oauth/oauth-routes.ts`). |
| `AGENT_URL`          | yes      | The customer agent base URL the BFF calls via agent-client.          |
| `BFF_TOKEN_ENCRYPTION_KEY`| for OAuth | Base64-encoded 32-byte AES-256 key encrypting stored refresh tokens. Until it is set, the `/oauth/*` token-issuance routes are disabled and `/health` reports `degraded`; already-issued `bff_access` tokens still authenticate on `/agent/*` whenever `FOREST_AUTH_SECRET` is present. |
| `HTTP_PORT`          | no       | Server port, integer 0–65535. Defaults to `3450`. `0` binds an OS-assigned ephemeral port — useful for a local run, unusable in the Docker image, where nothing outside the process learns which port it got: it can be neither published nor probed, and the image's healthcheck would report the container unhealthy forever. |
| `BFF_ALLOWED_ORIGINS`| no       | Comma-separated CORS allow-list of exact origins (scheme + host + port). No wildcard. Empty ⇒ no cross-origin browser access. |
| `BFF_DEFAULT_TIMEZONE`| no      | Fallback IANA timezone used when a request carries neither an `X-Forest-Timezone` header nor a body `timezone`. |
| `BFF_OPENAPI_ENABLED` | no       | Serve `GET/HEAD /agent/openapi.json` (auth-gated) when `true`. Defaults to `true`. Set to `false` for customers who do not want the HTTP surface exposed: an authenticated `GET`/`HEAD` then gets `404 openapi_disabled`, other methods fall through to the agent routes exactly as they do when enabled, and `forest-bff openapi` keeps working either way. Accepted values: `true`/`false`. **The served document is unfolded and is not filtered per caller**: any authenticated caller, whatever their role, reads the name of every exposed collection, relation and field. Set this to `false` if that surface must not be reachable over HTTP. |

### Config validation

- A malformed value (a non-http(s) `*_URL`, a `HTTP_PORT` that is not a decimal integer in 0–65535,
  a non-IANA `BFF_DEFAULT_TIMEZONE`, a non-boolean `BFF_OPENAPI_ENABLED`) fails fast at boot: the
  process exits with a clear error and never echoes the offending value.
- A required var that is absent (or empty / whitespace-only) does not crash the server. It boots and
  reports the gap through `/health` (503 `degraded`).
- Malformed `BFF_ALLOWED_ORIGINS` entries (including a literal `*`) are dropped and logged once at
  boot (`Warn`); they never enter the allow-list, so a wildcard origin can never be served.

## Request edge (`/agent/*`)

Every agent call flows through a request edge that enforces three cross-cutting concerns before the
call is proxied to the agent. Errors use a structured, type-first contract — `{ error: { type, status,
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
