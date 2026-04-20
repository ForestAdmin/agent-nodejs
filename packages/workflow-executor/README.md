# @forestadmin/workflow-executor

Run Forest Admin workflow steps on your own infrastructure.

The executor polls the Forest orchestrator for pending steps, runs them locally
(with access to your data via the Forest agent), and reports results back. No
client data ever leaves your infrastructure.

## Running in production

### Install

```bash
npm install -g @forestadmin/workflow-executor
```

### Configure via environment

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FOREST_ENV_SECRET` | ✓ | — | Forest Admin project environment secret |
| `FOREST_AUTH_SECRET` | ✓ | — | JWT signing secret (shared with your agent) |
| `AGENT_URL` | ✓ | — | URL of your running Forest Admin agent |
| `DATABASE_URL` | ✓* | — | Postgres connection string (*not needed with `--in-memory`) |
| `HTTP_PORT` | — | `3400` | Port for the executor HTTP server |
| `FOREST_SERVER_URL` | — | `https://api.forestadmin.com` | Orchestrator URL |
| `POLLING_INTERVAL_MS` | — | `5000` | Poll cadence for pending steps |
| `STOP_TIMEOUT_MS` | — | `30000` | Graceful shutdown deadline |

Optional AI configuration (all-or-nothing — falls back to server AI if any is missing):

| Variable | Description |
|----------|-------------|
| `AI_PROVIDER` | `anthropic` or `openai` |
| `AI_MODEL` | Model name (e.g. `claude-sonnet-4-6`) |
| `AI_API_KEY` | Provider API key |

### Run

```bash
forest-workflow-executor
```

You should see:

```
[forest-workflow-executor] Starting (database mode)
  Forest server    : https://api.forestadmin.com
  Agent URL        : http://localhost:3351
  HTTP port        : 3400
  Polling interval : 5000ms
  AI config        : server fallback (no local AI)
[forest-workflow-executor] Ready on http://localhost:3400
```

### Health check

```bash
curl http://localhost:3400/health
# → {"state":"running"}
```

### Graceful shutdown

Send `SIGTERM` or `SIGINT`. The executor drains in-flight steps, closes the HTTP
server, and exits with code `0`. Steps that don't drain within `STOP_TIMEOUT_MS`
are force-killed and the process exits with code `1`.

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Graceful shutdown |
| `1` | Startup error (missing env, invalid config) or forced shutdown |

### In-memory mode (dev only)

```bash
forest-workflow-executor --in-memory
```

No Postgres needed. State is lost on restart — **not for production**.

### All flags

```bash
forest-workflow-executor --help
```

## Programmatic use

If you prefer embedding the executor in your own Node entry point:

```ts
import { buildDatabaseExecutor } from '@forestadmin/workflow-executor';

const executor = buildDatabaseExecutor({
  envSecret: process.env.FOREST_ENV_SECRET!,
  authSecret: process.env.FOREST_AUTH_SECRET!,
  agentUrl: process.env.AGENT_URL!,
  httpPort: 3400,
  database: { uri: process.env.DATABASE_URL! },
});

await executor.start();
// SIGTERM / SIGINT handling is built in
```

See `src/build-workflow-executor.ts` for the full options surface.

## Dev with the example scaffold

The `example/` folder contains a docker-compose setup with Postgres + a ready
`index.ts` entrypoint that loads `.env` via `dotenv`. Use it for local development
only — not for production deployments.

```bash
cd example
docker compose up -d
cp .env.example .env  # fill in your secrets
npx tsx index.ts
```

## Architecture

See [CLAUDE.md](./CLAUDE.md) for the full package layout, architectural
principles, privacy boundaries, and extension points.
