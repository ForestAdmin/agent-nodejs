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
createAgent(options)
  .addDataSource(/* … */)
  .addBff({ allowedOrigins: ['https://my-app.com'] })
  .start();
```

Serves the REST BFF at `/bff` on the agent's own port, on every mount target. It reaches the agent
in the same process, so there is no second port, no agent url to configure, and no secrets to keep
in sync — `authSecret`, `envSecret`, the Forest urls and the logger are inherited.

Everything `addBff()` takes is a feature it switches on: `tokenEncryptionKey` enables OAuth (and
with it the AI relay), `allowedOrigins` enables browser access, `openapiEnabled` serves the docs
(off by default when embedded). `GET /bff/health` reports which of them are on.

**Mount the agent before any body parser of your own** — a parser that runs first consumes the
request stream, and every BFF `POST` then answers `500 stream.not.readable`.

See [`@forestadmin/agent-bff`](../agent-bff/README.md) for the routes, the auth modes and the
differences with the standalone deployment.

### A workflow executor — `agent.addWorkflowExecutor()`

```bash
npm install @forestadmin/workflow-executor
```

Runs a workflow executor alongside the agent, which proxies `/_internal/executor/*` to it. See
[`@forestadmin/workflow-executor`](../workflow-executor/README.md).
