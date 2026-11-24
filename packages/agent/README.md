# @forestadmin/agent

The main entry point of the Forest Admin Node.js SDK: `createAgent(options)` returns an agent to
which you attach datasources, customizations, charts and plugins, then mount on your HTTP server.

See the [developer guide](https://docs.forestadmin.com/developer-guide-agents-nodejs) for the full
documentation.

## Optional in-process components

Two components normally deployed on their own can run inside the agent instead. Both are optional
packages, loaded dynamically: an agent that does not use them never loads their code.

### A BFF — `agent.addBff()`

```bash
npm install @forestadmin/agent-bff
```

```ts
await createAgent(options)
  .addDataSource(/* … */)
  .addBff({ allowedOrigins: ['https://my-app.com'] })
  .mountOnStandaloneServer(3351)
  .start();
```

Serves the REST BFF under `/bff` on whatever port the agent is mounted on, on every mount target —
`mountOnStandaloneServer` above, or the host's own listener with `mountOnExpress`, `mountOnKoa`,
`mountOnFastify`, `mountOnNestJs`. A `mountOn*` call is what opens a socket: `start()` only builds
the agent's router, so a chain without one serves nothing, BFF included.

The BFF reaches the agent in the same process, so there is no second port, no agent url to
configure, and no secrets to keep in sync — `authSecret`, `envSecret`, the Forest urls and the
logger are inherited.

Everything `addBff()` takes is a feature it switches on: `tokenEncryptionKey` enables OAuth (and
with it the AI relay; a key derived from it signs the browser access tokens, so without it every
bearer on `/bff/agent` answers `401`), `allowedOrigins` enables browser access, `openapiEnabled` serves the docs
(off by default when embedded). `GET /bff/health` reports which of them are on, under `configured`.

**Mount the agent before any body parser of your own** — a parser that runs first consumes the
request stream, and every BFF `POST` then answers `500 stream.not.readable`.

A permissive `cors()` registered ahead of the mount costs you the preflight but not the allow-list:
the host answers `OPTIONS` with its own policy, and nothing downstream can take that back, so the
request that follows arrives here anyway — and is refused with `403 origin_not_allowed` unless its
`Origin` is one you listed. The browser sees the wrong preflight; the collection is still never read
for that origin.

Mounting under a sub-path of your own works: `app.use('/api', mounted)` serves the BFF at
`/api/bff`, and the prefix is derived per request, so the OpenAPI `servers` entry and the docs page
carry `/api/bff` too.

**`agentTimeoutMs` and `actionTimeoutMs` bound the wait, not the work.** When a call to the agent
exceeds its timeout the BFF answers `504 agent_timeout`, but nothing is cancelled: the in-process
request runs to completion. An action execute waits `actionTimeoutMs` (by default the larger of
`agentTimeoutMs` and 30 s), and when it is cut the 504 carries `details.outcome: "unknown"`: the
action may still apply its mutation, so a client that retries can apply it twice. Size
`actionTimeoutMs` above your slowest action, check the outcome before retrying, and make actions
idempotent if you intend to retry them.

**`addBff()` cannot be combined with `mountAiMcpServer({ basePath: '/bff' })`** — the MCP server
would claim `/bff/oauth` and `/bff/mcp`. Whichever you call second throws on the spot, at the
builder call and not from `start()`.

See [`@forestadmin/agent-bff`](../agent-bff/README.md) for the routes, the auth modes and the
differences with the standalone deployment.

### A workflow executor — `agent.addWorkflowExecutor()`

```bash
npm install @forestadmin/workflow-executor
```

Runs a workflow executor alongside the agent, which proxies `/_internal/executor/*` to it. See
[`@forestadmin/workflow-executor`](../workflow-executor/README.md).
