# @forestadmin/workflow-executor

Run Forest Admin workflow steps on your own infrastructure.

The executor polls the Forest orchestrator for pending steps, runs them locally
(with access to your data via the Forest agent), and reports results back. No
client data ever leaves your infrastructure.

## Prerequisites

- **Latest version of your Forest Admin agent** (Node.js, Ruby, Python…) — older versions do not support the executor
- **Executor enabled in your agent config** — add `workflowExecutorUrl` pointing to where the executor will run:

```js
// Node.js example
createAgent({
  envSecret: process.env.FOREST_ENV_SECRET,
  authSecret: process.env.FOREST_AUTH_SECRET,
  workflowExecutorUrl: 'http://localhost:3400', // URL of this executor
  // ...
})
```

> For other languages, refer to your agent's documentation for the equivalent option.

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
