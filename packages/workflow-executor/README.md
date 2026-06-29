# @forestadmin/workflow-executor

Run Forest Admin workflow steps on your own infrastructure.

The executor polls the Forest orchestrator for pending steps, runs them locally
(with access to your data via the Forest agent), and reports results back. No
client data ever leaves your infrastructure.

## Prerequisites

Make sure you are on the latest version of your Forest Admin agent (Node.js/JS or Ruby), then point your agent at the executor with `workflowExecutorUrl`:

```js
createAgent({
  // ...
  workflowExecutorUrl: process.env.WORKFLOW_EXECUTOR_URL, // e.g. http://localhost:3400
})
```

This is **required** for the executor to work: when `workflowExecutorUrl` is set, the agent mounts the route that forwards workflow requests to the executor (and relays the JWT for auth). If it is left unset, the agent returns `404` on those routes and the executor never receives any work.

Drive it from an environment variable (`WORKFLOW_EXECUTOR_URL` above) so each deployment can target its own executor. The URL is where the agent reaches the executor — its HTTP server (default port `3400`). When the agent and executor run on separate hosts behind a private network (e.g. an internal load balancer), use the executor's internal address, and make sure the agent can reach the executor's HTTP port.

---

## Docker (recommended)

### Quick start

```bash
cp .env.example .env   # fill in your secrets
docker compose up
```

The `docker-compose.yml` at the root of this package starts a single executor instance. See `.env.example` for the full list of environment variables and their descriptions.

### Run directly

```bash
docker run -d \
  -e FOREST_ENV_SECRET="your-env-secret" \
  -e FOREST_AUTH_SECRET="your-auth-secret" \
  -e AGENT_URL="http://host.docker.internal:3351" \
  -e DATABASE_URL="postgres://user:pass@host.docker.internal:5432/mydb" \
  -p 3400:3400 \
  ghcr.io/forestadmin/workflow-executor:latest
```

> **Note:** When the executor runs in Docker and your agent runs on the host machine, use `host.docker.internal` instead of `localhost` in `AGENT_URL` and `DATABASE_URL`.

### Observability (OpenTelemetry)

The Docker image ships with [OpenTelemetry](https://opentelemetry.io/) APM built in, and works with any OTLP-compatible backend (Datadog, Grafana Tempo, Jaeger, Honeycomb, etc.). It is **off by default** and turns on automatically as soon as you point it at an OTLP receiver — no code changes or extra installs required. Tracing is set up before the app starts (auto-instrumentation for HTTP, Postgres, etc.) and buffered spans are flushed on graceful shutdown.

Configure it entirely through the standard OTel environment variables:

| Variable | Description |
| --- | --- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP receiver URL (e.g. `http://collector:4318`). **Tracing stays disabled until this is set.** |
| `OTEL_SERVICE_NAME` | Service name reported in traces. Default: `forestadmin-workflow-executor`. |
| `OTEL_RESOURCE_ATTRIBUTES` | Extra resource attributes, e.g. `deployment.environment=production,version=1.7.0`. |
| `OTEL_SDK_DISABLED` | Set to `true` to force-disable tracing even when an endpoint is configured. |

```bash
docker run -d \
  -e FOREST_ENV_SECRET="your-env-secret" \
  -e FOREST_AUTH_SECRET="your-auth-secret" \
  -e AGENT_URL="http://host.docker.internal:3351" \
  -e DATABASE_URL="postgres://user:pass@host.docker.internal:5432/mydb" \
  -e OTEL_EXPORTER_OTLP_ENDPOINT="http://collector:4318" \
  -p 3400:3400 \
  ghcr.io/forestadmin/workflow-executor:latest
```

> **Note:** OpenTelemetry is bundled only in the Docker image. It is not shipped with the npm package (`npx @forestadmin/workflow-executor`).

---

## Without Docker

### With a database

Requires Node.js ≥ 22.12.0 and a Postgres database:

```bash
FOREST_ENV_SECRET="your-env-secret" \
FOREST_AUTH_SECRET="your-auth-secret" \
AGENT_URL="https://your-agent-url" \
DATABASE_URL="postgres://user:pass@localhost:5432/mydb" \
npx @forestadmin/workflow-executor
```

**Where to find your credentials:**

Both values are already in your agent's environment variables. `FOREST_ENV_SECRET` can also be found in [app.forestadmin.com](https://app.forestadmin.com) → **Settings** → **Environments** → click your environment. `FOREST_AUTH_SECRET` is defined on your side only and is not available in the Forest Admin UI.

`AGENT_URL` is the URL where your Forest Admin agent is running (e.g. `http://localhost:3351`).

---

## Testing only

The following modes skip the database requirement but are **not suitable for production** — state is lost on restart.

### Docker

```bash
docker run --rm \
  -e FOREST_ENV_SECRET="your-env-secret" \
  -e FOREST_AUTH_SECRET="your-auth-secret" \
  -e AGENT_URL="http://host.docker.internal:3351" \
  -p 3400:3400 \
  ghcr.io/forestadmin/workflow-executor:latest \
  node packages/workflow-executor/dist/cli.js --in-memory --json
```

### Without Docker

```bash
FOREST_ENV_SECRET="your-env-secret" \
FOREST_AUTH_SECRET="your-auth-secret" \
AGENT_URL="https://your-agent-url" \
npx @forestadmin/workflow-executor --in-memory
```
