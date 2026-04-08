# Workflow Executor — Example

Two ways to run the executor: **mock mode** (no external services) or **production mode** (real PostgreSQL, AI provider, and Forest Admin agent).

---

## Mock Mode

Run the executor with in-memory stores and mock ports. No database, no AI provider, no running agent required.

### Quick start

```bash
cd packages/workflow-executor
npx tsx example/mock.ts
```

The mock executor will:
- Poll for pending steps every 3 seconds
- Walk through 7 step types: condition, read-record, update-record, trigger-action, load-related-record, mcp, guidance
- Log every port call (agent, orchestrator, AI) to the console

### Endpoints

| Method | Path                    | Description                      |
|--------|-------------------------|----------------------------------|
| GET    | `/health`               | Returns `{ "state": "running" }` |
| GET    | `/runs/run-1`           | Current run state                |
| POST   | `/runs/run-1/trigger`   | Trigger the next pending step    |

All endpoints except `/health` require a JWT bearer token:

```bash
# Generate a token
TOKEN=$(node -e "console.log(require('jsonwebtoken').sign({id:1},'mock-auth-secret'))")

# Health check (no auth)
curl http://localhost:3400/health

# Get run state
curl -H "Authorization: Bearer $TOKEN" http://localhost:3400/runs/run-1

# Trigger pending step (for steps that return awaiting-input)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pendingData":{"userConfirmed":true}}' \
  http://localhost:3400/runs/run-1/trigger
```

### Execution flow

Steps 0 (condition) and 1 (read-record) execute automatically on the first poll cycle. Step 2 (update-record) returns `awaiting-input` because `automaticExecution` is not set -- use the `/trigger` endpoint to confirm it. Steps 3 (trigger-action) and 5 (mcp) also pause for confirmation. Step 4 (load-related-record) has `automaticExecution: true` and runs automatically. Step 6 (guidance) requires `pendingData.userInput` via the trigger endpoint.

### Modifying the scenario

All mock data lives in `example/scenario.ts`:
- `SCHEMAS` -- collection schemas returned by the mock workflow port
- `RECORDS` -- record data returned by the mock agent port
- `STEPS` -- the step sequence the mock orchestrator dispatches
- `AI_RESPONSES` -- canned AI tool calls keyed by step index

---

## Production Mode

Full setup backed by PostgreSQL, a real AI provider, and a running Forest Admin agent.

### Prerequisites

- Docker
- Node.js 18+
- A running Forest Admin agent (the executor proxies record operations to it)

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

- `FOREST_ENV_SECRET` / `FOREST_AUTH_SECRET` -- from your Forest Admin project settings
- `AGENT_URL` -- URL of your running Forest Admin agent
- `AI_API_KEY` -- your AI provider API key

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

### Teardown

```bash
docker compose down -v
```
