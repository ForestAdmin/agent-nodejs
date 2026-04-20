# Workflow Executor — Example

Local setup to run the workflow executor backed by PostgreSQL, using the
`forest-workflow-executor` CLI.

## Prerequisites

- Docker
- Node.js 20.6+ (required for native `--env-file` support)
- A running Forest Admin agent (the executor proxies record operations to it)

## Quick start

### 1. Start PostgreSQL

```bash
cd packages/workflow-executor/example
docker compose up -d
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
cd ..
yarn build
```

### 4. Run the executor

```bash
node --env-file=example/.env dist/cli.js
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
```

### 5. Verify

```bash
curl http://localhost:3400/health
# {"state":"running"}
```

The executor will:
- Auto-create the `workflow_step_executions` table via Umzug migrations
- Poll the Forest Admin orchestrator for pending steps
- Execute steps locally and report results back

### Dev without a database

Skip step 1 and 2 (the `DATABASE_URL`), and run with `--in-memory`:

```bash
node --env-file=example/.env dist/cli.js --in-memory
```

Run state is lost on restart — not for production.

## Teardown

```bash
# Stop the executor (Ctrl+C in its shell)
# Stop Postgres
docker compose down -v  # -v wipes the data volume
```

## See also

- Package [README](../README.md) — CLI flags, env vars reference, programmatic API
- Package [CLAUDE.md](../CLAUDE.md) — architecture, privacy boundaries
