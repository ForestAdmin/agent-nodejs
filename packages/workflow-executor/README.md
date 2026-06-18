# @forestadmin/workflow-executor

Run Forest Admin workflow steps on your own infrastructure.

The executor polls the Forest orchestrator for pending steps, runs them locally
(with access to your data via the Forest agent), and reports results back. No
client data ever leaves your infrastructure.

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

- `FOREST_ENV_SECRET` — in [app.forestadmin.com](https://app.forestadmin.com) → **Settings** → **Environments** → click your environment
- `FOREST_AUTH_SECRET` — defined on your agent side only (not in the Forest Admin UI); copy it from your agent's environment variables

`AGENT_URL` is the URL where your Forest Admin agent is running (e.g. `http://localhost:3351`).
