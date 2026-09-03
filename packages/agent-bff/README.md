# @forestadmin/agent-bff

Standalone REST BFF (Backend-For-Frontend) that lets a trusted third-party UI call a Forest
agent from a browser without learning MCP or JSON:API.

It is a bootable Koa 3 server with a `/health` endpoint, a version header, env-driven config
validation, OAuth (Mode 1) + API-key (Mode 2) auth, and a hardened request edge (timezone, CORS,
auth-mode precedence, structured error contract), and it serves and exports its own OpenAPI
document.

## The routes it serves

Everything the agent proxy exposes lives under `/agent/v1`. The data and action routes are `POST`
— the filter, projection, sort, search and paging all travel in the body, never in the query string:

| Route                                                         | Method       | What it does                                                                                              |
| ------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------- |
| `/agent/v1/{collection}/list` · `/count`                      | `POST`       | list or count records of a collection                                                                     |
| `/agent/v1/{collection}/relations/{relation}/list` · `/count` | `POST`       | same, through a **to-many** relation — to-one relations are not listable and 404 by design                |
| `/agent/v1/{collection}/actions/{action}/form` · `/execute`   | `POST`       | load a Smart Action's form, then run it                                                                   |
| `/agent/v1/permissions`                                       | `GET`        | what the caller may see and do, **as display hints** for graying out UI — never an authorization decision |
| `/agent/openapi.json`                                         | `GET`/`HEAD` | the unfolded document, auth-gated, when `BFF_OPENAPI_ENABLED` is on                                       |

`/health`, the `/oauth/*` login routes and the `/docs` viewer (page and `redoc.standalone.js`
bundle) sit outside the prefix and outside the auth edge; `/health` and `/docs` answer `HEAD` as
well as `GET`.

**The agent enforces permissions and scopes, not the BFF.** Each proxied call carries a
short-lived agent token the BFF mints for the caller, so a request reaches the agent as that
person and comes back filtered exactly as it would for them in Forest. A collection the current
schema no longer exposes is re-checked on every call, so a schema refresh can never leave a
dropped collection reachable.

## Usage

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

Set `BFF_PUBLIC_URL` for this command in particular. A document fetched over HTTP resolves its
relative `servers[0].url` against the URL it came from; an exported file has no such origin, so
without it a client generated from the export has no base URL at all.

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

| Env var                       | Required  | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FOREST_AUTH_SECRET`          | yes       | Agent JWT signing secret (never logged or echoed).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `FOREST_ENV_SECRET`           | yes       | Forest SaaS environment secret (`forest-secret-key`), server-to-server.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `FOREST_SERVER_URL`           | yes       | Forest SaaS API base URL.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `FOREST_APP_URL`              | yes       | Forest front base URL, used to build the OAuth front-channel redirect (`src/oauth/oauth-routes.ts`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `AGENT_URL`                   | yes       | The customer agent base URL the BFF calls via agent-client.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `BFF_TOKEN_ENCRYPTION_KEY`    | for OAuth | Base64-encoded 32-byte AES-256 key encrypting stored refresh tokens. Until it is set, the `/oauth/*` token-issuance routes are disabled and `/health` reports `degraded`; already-issued `bff_access` tokens still authenticate on `/agent/*` whenever `FOREST_AUTH_SECRET` is present.                                                                                                                                                                                                                                                                                                                                                                                             |
| `HTTP_PORT`                   | no        | Server port, integer 0–65535. Defaults to `3450`. `0` binds an OS-assigned ephemeral port.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `BFF_ALLOWED_ORIGINS`         | no        | Comma-separated CORS allow-list of exact origins (scheme + host + port). No wildcard. Empty ⇒ no cross-origin browser access.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `BFF_DEFAULT_TIMEZONE`        | no        | Fallback IANA timezone used when a request carries neither an `X-Forest-Timezone` header nor a body `timezone`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `BFF_PUBLIC_URL`              | no        | The BFF's own external base URL, published as `servers[0].url` in the OpenAPI document so a generated client resolves endpoints without being configured by hand. Absent, `servers[0].url` stays `/`, which a consumer that fetched the document over HTTP resolves against that URL — but which leaves a client generated from an offline `forest-bff openapi` export with no base URL at all. Trailing slashes are stripped. A malformed value fails the boot, and so does one carrying credentials, a query string or a fragment: credentials would be published to every reader of the document, and anything behind a `?` or `#` swallows the path a generated client appends. |
| `BFF_AGENT_TIMEOUT_MS`        | no        | How long the BFF waits for the customer agent on any data or action call, in milliseconds. Defaults to `10000`. Past it the route answers `504 agent_timeout`; any outright transport failure — a refused connection, an unresolvable host, a connection reset, a TLS failure — answers `502 network_error` instead. Surrounding whitespace is trimmed, then a malformed value (non-integer, `0`, or above 2147483647) fails the boot; an unset, empty, or whitespace-only value counts as absent and takes the default.                                                                                                                                                            |
| `BFF_AI_TIMEOUT_MS`           | no        | How long `POST /agent/v1/ai/query` waits for the Forest server on the relay itself, in milliseconds. Defaults to `120000` — an AI generation is slow, and neither the app nor the Forest server bounds it. Past it the route answers `504`. It is not the route's end-to-end cap: an expired session is refreshed first, under a separate hard-coded 60 s ceiling that answers `502`, so a request can exceed this value. Surrounding whitespace is trimmed, then a malformed value (non-integer, `0`, or above 2147483647) fails the boot; an unset, empty, or whitespace-only value counts as absent and takes the default.                                                       |
| `BFF_RATE_LIMIT_MAX_REQUESTS` | no        | Requests allowed per identity per window on `/agent/*`. Defaults to `300`. Counted per resolved identity, prefixed by auth mode, so an API key and an OAuth session never share a bucket. Anonymous and rejected-key traffic answers `401` before the limiter and allocates nothing. An integer between 1 and 10 000; a malformed or out-of-range value fails the boot.                                                                                                                                                                                                                                                                                                             |
| `BFF_RATE_LIMIT_WINDOW_MS`    | no        | Length of that fixed window, in milliseconds. Defaults to `60000`. Over the quota the edge answers `429 too_many_requests` with an integer `Retry-After`. The same status also covers saturation: past 10 000 live buckets a new identity is refused rather than evicting someone's live window, and `Retry-After` is then a lower bound — the earliest reset among the identities currently holding one. The `details.cause` field of the 429 error body distinguishes the two: `limit_exceeded` or `limiter_saturated`. An integer between 1 000 and 2 147 483 647; a malformed or out-of-range value fails the boot.                                                             |
| `BFF_OPENAPI_ENABLED`         | no        | Serve `GET/HEAD /agent/openapi.json` (auth-gated) when `true`. Defaults to `true`. Set to `false` for customers who do not want the HTTP surface exposed: an authenticated `GET`/`HEAD` then gets `404 openapi_disabled`, other methods fall through to the agent routes exactly as they do when enabled, and `forest-bff openapi` keeps working either way. Accepted values: `true`/`false`. **The served document is unfolded and is not filtered per caller**: any authenticated caller, whatever their role, reads the name of every exposed collection, relation and field. Set this to `false` if that surface must not be reachable over HTTP.                               |

### Config validation

- A malformed value (a non-http(s) `*_URL`, a `HTTP_PORT` that is not a decimal integer in 0–65535,
  a non-IANA `BFF_DEFAULT_TIMEZONE`, a non-boolean `BFF_OPENAPI_ENABLED`, a `BFF_RATE_LIMIT_MAX_REQUESTS` that
  is not an integer in 1–10 000, or a `BFF_RATE_LIMIT_WINDOW_MS` that is not an integer in 1 000–2 147 483 647)
  fails fast at boot: the process exits with a clear error and never echoes the offending value.
- A required var that is absent (or empty / whitespace-only) does not crash the server. It boots and
  reports the gap through `/health` (503 `degraded`).
- Malformed `BFF_ALLOWED_ORIGINS` entries (including a literal `*`) are dropped and logged once at
  boot (`Warn`); they never enter the allow-list, so a wildcard origin can never be served.

## Request edge (`/agent/*`)

Every agent call flows through a request edge that enforces three cross-cutting concerns before the
call is proxied to the agent. Errors use a structured, type-first contract — `{ error: { type, status,
message, details? } }` — so consumers branch on `error.type`, never on message text.

Two of those types split what used to be one failure. An agent that accepts the connection and then
does not answer within `BFF_AGENT_TIMEOUT_MS` answers `504 agent_timeout`; an agent that refuses the
connection or whose host does not resolve answers `502 network_error`, and so does any other
outright transport failure — a connection reset mid-flight, a socket hang up, a TLS failure —
because `502` is the catch-all for everything that is not a timeout. The deadline is armed when the
request starts, so at the default a host that accepts nothing and never resets is a `504` too:
`502` means the transport failed outright, not that it ran out of time. Raise
`BFF_AGENT_TIMEOUT_MS` past the OS connect timeout (~75 s) and that last case reverts to `502`,
because the kernel gives up first and reports `ETIMEDOUT` rather than superagent's deadline.

Two paths sit before the timezone layer and so skip it: `/agent/v1/context`, and the AI relay
described below. Neither reaches an agent, so neither has a timezone to resolve. This holds only
where they are actually mounted — `/agent/v1/context` needs the read-model bundle and the AI relay
needs an OAuth session. In a deployment missing either, the request falls through to the timezone
layer instead, so a caller sending no timezone against a BFF with no `BFF_DEFAULT_TIMEZONE` gets
`400 missing_timezone` rather than the `404` it would expect from an unmounted route.

### Auth-mode precedence

| Presented credentials                | Result                      |
| ------------------------------------ | --------------------------- |
| `Authorization: Bearer <bff_access>` | Mode 1 (OAuth session)      |
| `X-Forest-Bff-Key`                   | Mode 2 (API key)            |
| both                                 | `400 ambiguous_credentials` |
| neither                              | `401 unauthorized`          |

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
  `allowedOrigins`, an `Origin` sent by the client must be in that list, else
  `403 origin_not_allowed`. A request with no `Origin` at all — a server-side client such as curl,
  a Node backend or CI, an empty header counting as none — passes: there the API key is the
  boundary, not the origin. An opaque `Origin: null` (sandboxed iframe, cross-origin redirect) is a
  present origin and is rejected. An empty per-key list is a no-op.

**Local development:** browsers still enforce CORS against `localhost`, so add your dev origin(s) to
`BFF_ALLOWED_ORIGINS` (e.g. `BFF_ALLOWED_ORIGINS=http://localhost:4200`) — there is no dev bypass.

### Timezone

On every route that reaches an agent, the BFF forwards an explicit `timezone`, resolved in order:
(1) `X-Forest-Timezone` header, (2) body `timezone` field, (3) `BFF_DEFAULT_TIMEZONE`. None →
`400 missing_timezone`; a non-IANA value → `400 invalid_timezone`. The two paths listed above are
mounted ahead of this layer and answer without it.

### AI query relay

`POST /agent/v1/ai/query` relays its body to the Forest AI proxy under the OAuth session the BFF
holds, and relays the answer back:

- **Session only.** An API key is refused with `403 oauth_required`: only the OAuth flow yields the
  Forest access token this route forwards. The environment and rendering are derived server-side, so
  sending `forest-*` headers has no effect.
- **Body.** `1mb` instead of the `16kb` of every other route, and `application/json` only — any other
  content type arrives as an empty body, is relayed upstream as `{}`, and the Forest server rejects
  the query. Over the limit → `413`. The parser is selected on the request path alone and runs ahead
  of authentication, so an unauthenticated caller can make the BFF buffer and JSON-parse 1 MB on this
  path — 64x the pre-auth surface of every other route. Bounding that is a deployment concern (rate
  limiting or a body cap at the reverse proxy), not a BFF one.
- **Timeout.** `BFF_AI_TIMEOUT_MS` (default `120000`) caps the relay itself; past it → `504`. It is
  not the only cap on the request: when the session's access token has expired the route first
  refreshes it against the Forest server, and that hop has its own hard-coded 60 s ceiling which
  answers `502 network_error`, not `504`.
- **Error shape.** Below 500 the upstream JSON body is relayed unchanged, so its shape is the Forest
  AI proxy's contract and not the BFF's; when the upstream answer carried no JSON body the BFF
  substitutes its own envelope, keeping the status only when it was 4xx and reporting `502` for a
  2xx or 3xx that carried nothing to relay. At 500 and above the body is always the BFF
  envelope, so no upstream infrastructure detail reaches the caller. **This is the one route where a
  sub-500 body is not guaranteed to be `{ error: { type, … } }`**, so a consumer cannot branch on
  `error.type` here without checking that the field exists.
- **Mounted only with OAuth.** Without a complete OAuth configuration the route is absent (`404`) and
  `forest-bff openapi` omits it from the document.

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
