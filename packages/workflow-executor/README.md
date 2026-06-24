# @forestadmin/workflow-executor

Run Forest Admin workflow steps on your own infrastructure.

The executor polls the Forest orchestrator for pending steps, runs them locally
(with access to your data via the Forest agent), and reports results back. No
client data ever leaves your infrastructure.

## Prerequisites

Make sure you are on the latest version of your Forest Admin agent (Node.js/JS or Ruby), then add `workflowExecutorUrl` to your agent config:

```js
createAgent({
  // ...
  workflowExecutorUrl: 'http://localhost:3400',
})
```

---

## Quick Setup

### In-memory (no database)

For testing — state is lost on restart, not for production:

```bash
FOREST_ENV_SECRET="your-env-secret" \
FOREST_AUTH_SECRET="your-auth-secret" \
AGENT_URL="https://your-agent-url" \
npx @forestadmin/workflow-executor --in-memory
```

### With a database

For production — requires a Postgres database:

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

## Docker

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

### In-memory mode (no database)

For local testing — state is lost on restart, not suitable for production:

```bash
docker run --rm \
  -e FOREST_ENV_SECRET="your-env-secret" \
  -e FOREST_AUTH_SECRET="your-auth-secret" \
  -e AGENT_URL="http://host.docker.internal:3351" \
  -p 3400:3400 \
  ghcr.io/forestadmin/workflow-executor:latest \
  node packages/workflow-executor/dist/cli.js --in-memory --json
```
