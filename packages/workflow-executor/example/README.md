# Workflow Executor — Example

Local setup to run the workflow executor backed by PostgreSQL.

## Prerequisites

- Docker
- Node.js 20.6+ (required for native `--env-file` support)
- A running Forest Admin agent (the executor proxies record operations to it)

## Quick start

All commands below run from this directory (`packages/workflow-executor/example`).

### 1. Start PostgreSQL

```bash
yarn db:up
```

Exposes Postgres on `localhost:5452` with database `workflow_executor`
(user `executor`, password `password`).

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in `FOREST_ENV_SECRET` and `FOREST_AUTH_SECRET` from your Forest Admin
project Settings → Environments. Adjust `AGENT_URL` if your agent doesn't run
on the default port.

### 3. Build the executor

From the package root (one folder up):

```bash
cd .. && yarn build && cd -
```

### 4. Run the executor

```bash
yarn start
```

Expected output:

```
[forest-workflow-executor] Starting (database mode)
  Forest server    : https://api.forestadmin.com
  Agent URL        : http://localhost:3351
  HTTP port        : 3400
  Polling interval : 5000ms
  AI config        : server fallback (no local AI)
[forest-workflow-executor] Ready on http://localhost:3400
{"message":"Poll cycle completed","timestamp":"...","fetched":0,"dispatching":0}
```

### 5. Verify

```bash
curl http://localhost:3400/health
# {"state":"running"}
```

The executor will:
- Auto-create the `workflow_step_executions` table via Umzug migrations
- Poll the Forest Admin orchestrator every `POLLING_INTERVAL_MS` (5s default)
- Execute steps locally and report results back

## Available scripts

| Script | What it does |
|--------|--------------|
| `yarn start` | Run the executor (database mode) — requires `yarn build` first |
| `yarn start:memory` | Run the executor with an in-memory store (no DB, not for prod) |
| `yarn start:watch` | Run via `tsx watch` directly on source — no build, auto-restart on file change |
| `yarn db:up` | Start the Postgres container |
| `yarn db:down` | Stop the Postgres container (keeps data volume) |
| `yarn db:reset` | Drop and recreate the DB (wipes the volume) |
| `yarn db:psql` | Open a `psql` shell in the container |

## Teardown

```bash
yarn db:down  # keep the data volume
# or
yarn db:reset  # wipe everything
```

## See also

- Package [README](../README.md) — CLI flags, env vars reference, programmatic API
- Package [CLAUDE.md](../CLAUDE.md) — architecture, privacy boundaries
