# Workflow Executor — Example

Minimal setup to run a workflow executor backed by PostgreSQL.

## Prerequisites

- Docker
- Node.js 18+
- A running Forest Admin agent (the executor proxies record operations to it)

## Quick start

### 1. Start PostgreSQL

```bash
cd packages/workflow-executor/example
docker compose up -d
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in your secrets in `.env`:

- `FOREST_ENV_SECRET` / `FOREST_AUTH_SECRET` — from your Forest Admin project settings
- `AGENT_URL` — URL of your running Forest Admin agent
- `AI_API_KEY` — your AI provider API key

### 3. Run the executor

```bash
npx tsx example/index.ts
```

### 4. Verify

```bash
curl http://localhost:3400/health
# {"state":"running"}
```

The executor will:
- Auto-create the `workflow_step_executions` table in PostgreSQL (via umzug migrations)
- Poll the Forest Admin orchestrator for pending steps every 5 seconds
- Execute steps locally and report results back

## Teardown

```bash
docker compose down -v
```
