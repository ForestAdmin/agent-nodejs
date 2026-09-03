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

Two ways to run it: embedded in a Forest agent (`agent.addBff()`, see
[Embedded in an agent](#embedded-in-an-agent)) or standalone, described here.

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
| `HTTP_PORT`          | no       | Server port, integer 0–65535. Defaults to `3450`. `0` binds an OS-assigned ephemeral port. |
| `BFF_ALLOWED_ORIGINS`| no       | Comma-separated CORS allow-list of exact origins (scheme + host + port). No wildcard. Empty ⇒ no cross-origin browser access. |
| `BFF_DEFAULT_TIMEZONE`| no      | Fallback IANA timezone used when a request carries neither an `X-Forest-Timezone` header nor a body `timezone`. |
| `BFF_AI_TIMEOUT_MS`  | no       | How long `POST /agent/v1/ai/query` waits for the Forest server on the relay itself, in milliseconds. Defaults to `120000` — an AI generation is slow, and neither the app nor the Forest server bounds it. Past it the route answers `504`. It is not the route's end-to-end cap: an expired session is refreshed first, under a separate hard-coded 60 s ceiling that answers `502`, so a request can exceed this value. A malformed value (non-integer, `0`, or above 2147483647) fails the boot, unlike an absent one which takes the default. |
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

Two paths sit before the timezone layer and so skip it: `/agent/v1/context`, and the AI relay
described below. Neither reaches an agent, so neither has a timezone to resolve. This holds only
where they are actually mounted — `/agent/v1/context` needs the read-model bundle and the AI relay
needs an OAuth session. In a deployment missing either, the request falls through to the timezone
layer instead, so a caller sending no timezone against a BFF with no `BFF_DEFAULT_TIMEZONE` gets
`400 missing_timezone` rather than the `404` it would expect from an unmounted route.

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
{
  "status": "ok",
  "version": "<package version>",
  "features": { "oauth": true, "ai": true, "cors": true, "openapi": true }
}
// 503 — one or more required keys missing
{ "status": "degraded", "version": "<package version>", "features": { /* … */ } }
```

`features` says what this deployment actually serves. They form a chain, not four independent
switches:

| Feature | Switched on by |
| --- | --- |
| `oauth` | `BFF_TOKEN_ENCRYPTION_KEY` **and** `FOREST_SERVER_URL`, `FOREST_ENV_SECRET`, `FOREST_APP_URL`, `FOREST_AUTH_SECRET` — the routes need a Forest server to talk to as much as a key. Embedded, only `tokenEncryptionKey` is yours to set: the other four are inherited |
| `ai` | `oauth` — the relay needs a session, and only the OAuth flow creates one |
| `cors` | a non-empty `BFF_ALLOWED_ORIGINS` (`allowedOrigins`) |
| `openapi` | `BFF_OPENAPI_ENABLED` (`openapiEnabled`), and a mounted agent edge |

The body still never discloses which config *keys* are present or missing — that would leak the
internal config surface to an unauthenticated probe. It reports what is served, not how it was
configured. Missing keys are logged once at startup (`Warn`) for operators. Every response the BFF
itself produces carries the `X-Forest-Bff-Version` header, read from `package.json`. The one
exception is the embedded `503 bff_not_started` / `bff_stopped` below: the agent writes those
itself, with no BFF to read a version from.

## Embedded in an agent

The same BFF runs inside a Forest agent, with no second deployment and no second port:

```ts
await createAgent(options)
  .addDataSource(/* … */)
  .addBff({ allowedOrigins: ['https://my-app.com'] })
  .mountOnStandaloneServer(3351)
  .start();
```

A mount is what opens a socket — `start()` only builds the agent's router, so without a
`mountOn*` call nothing is served, BFF included.

It answers under `/bff` on whatever port the agent is mounted on — `/bff/agent/v1/{collection}/list`,
`/bff/health`, `/bff/oauth/*` — so the REST contract is the one documented above and only the base
url changes.

The prefix is fixed at `/bff` and is resolved against the url the host hands the agent, so **mount
the agent on the root application, not on a sub-router**: an agent mounted on an express router at
`/api` answers at `/api/bff`, while the OpenAPI document and the docs page still say `/bff`.

The *served* OpenAPI document carries the prefix in its `servers` entry, so a client generated from
`GET /bff/agent/openapi.json` is correct as-is. The *exported* one does not: `forest-bff openapi`
has no way to be told about a prefix and always emits `servers: [{ "url": "/" }]`. Generating a
client from the export against an embedded BFF means pointing its base url at `/bff` yourself.

What differs from the standalone deployment:

| | Standalone | Embedded |
| --- | --- | --- |
| Configuration | environment variables | `addBff()` options; the secrets, the Forest urls and the logger are inherited from the agent and cannot be overridden |
| `AGENT_URL` | required, an http(s) url | gone — the BFF reaches the agent in the same process, without a socket |
| `HTTP_PORT` | its own listener | gone — the agent's port serves it |
| `openapiEnabled` | `true` | `false`. The document is not filtered per caller, so adding a BFF must not silently publish every collection and field name on an already-open port |
| `/health` | 503 until every required key is set | always 200: an in-process dispatcher short-circuits the readiness check, since a 503 here would let a load balancer restart a process that serves api-key traffic fine. It stays 200 with no `tokenEncryptionKey`, which is *not* inherited — read `features` to know what is on |

**Registration order matters on Express and Connect-style hosts.** Mount the agent *before* any
body parser of your own:

```ts
const app = express();
agent.mountOnExpress(app);  // first
app.use(express.json());    // then yours
await agent.start();
```

A body parser that runs first has already consumed the request stream, and nothing downstream can
put it back: every BFF `POST` then answers `500 stream.not.readable`. The same applies to a
permissive `cors()` registered ahead of the mount — it answers the preflight itself, and the BFF's
strict allow-list never gets a say.

NestJS needs no special handling as long as you mount before `listen()`: `NestFactory.create()`
does not install its body parser, `init()` does, and `listen()` is what triggers `init()` — so the
middleware `mountOnNestJs()` registers is already ahead of it.

**`/bff/*` answers `503` while the BFF is not serving**, and the two ends of the lifecycle are told
apart: `bff_not_started` between `addBff()` and the end of `start()`, `bff_stopped` after `stop()`.
The agent claims the prefix as soon as it is mounted, and a 404 there would read as "wrong url"
rather than "not available". A probe should wait on the first and drain on the second.

**`addBff()` and `mountAiMcpServer({ basePath: '/bff' })` are mutually exclusive** — whichever is
called second throws on the spot, at the builder call and not from `start()`, rather than letting
the MCP server quietly claim `/bff/oauth` and `/bff/mcp`. Any `basePath` landing inside `/bff`
counts (`bff`, `/bff/`, `/bff/ai`), so mount the MCP server elsewhere.

When to prefer which: embedded for a single deployment, which is most of them. Standalone when
several agents share one BFF, or when the BFF and the agent have to scale separately.
