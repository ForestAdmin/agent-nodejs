# Test Agents — Multi-Agent Local Environment

**Date:** 2026-04-11
**Goal:** Validate the MCP server against the 4 Forest Admin agents (agent-nodejs, forest-express-sequelize, agent-ruby, forest-rails) with a single command.

---

## Why

The MCP server needs to work identically with all Forest Admin agents. Today, testing against different agents is manual and painful. This setup gives us a reproducible, one-command local environment where we can switch between agents and verify MCP behavior.

---

## Architecture

```
                    ┌─────────────────┐
                    │  Forest Admin   │
                    │  (cloud)        │
                    └────────┬────────┘
                             │
                        port 3310
                             │
                    ┌────────▼────────┐
                    │     Proxy       │
                    │  (Express)      │
                    │                 │
                    │  /__admin/*     │
                    └────────┬────────┘
                             │
                     Active agent only
                             │
                             ▼
              ┌──────────────────────────┐
              │  One of:                 │
              │  - nodejs        :3311   │
              │  - express-seq   :3312   │
              │  - ruby          :3313   │
              │  - rails         :3314   │
              └──────────┬───────────────┘
                         │
                   ┌─────▼─────┐
                   │  SQLite   │
                   │  db.sqlite│
                   └───────────┘
```

### Key Design Decisions

- **One agent at a time** — switching kills the previous agent and starts the new one. No SQLite contention, no wasted resources.
- **Single proxy port** (3310) — admin routes live under `/__admin/*` on the same port. No second port to remember.
- **Ruby agents are opt-in** — by default only Node.js agents are available. Ruby agents start only if Ruby/Bundler are detected, with a clear error message otherwise.
- **Schema control** — you choose which agent sends its schema to Forest Admin via `--send-schema`. By default only the first agent sends it.

### Components

| Component | Port | Role |
|-----------|------|------|
| **Proxy** | 3310 | Routes Forest Admin traffic to active agent + admin API under `/__admin/*` |
| **agent-nodejs** | 3311 | `@forestadmin/agent` + `@forestadmin/datasource-sql` |
| **forest-express-sequelize** | 3312 | `forest-express-sequelize` + Sequelize models (child process, own `package.json`) |
| **agent-ruby** | 3313 | `forest_admin_agent` gem + ActiveRecord + SQLite (child process) |
| **forest-rails** | 3314 | `forest_liana` gem + Rails API-only + ActiveRecord (child process) |
| **SQLite** | - | Database file, seeded at startup |

---

## Schema Strategy

### The problem

Each agent generates its schema slightly differently (field types, relation format, naming). Forest Admin uses the schema to render the UI. If multiple agents send conflicting schemas, the UI breaks.

### The solution

- **By default**, the first agent started (agent-nodejs) sends its schema. All others skip.
- **On demand**, you can force any agent to send its schema with `--send-schema`.
- This lets you verify that each agent's schema is correct and compatible with the UI.

### Skip mechanisms per agent

| Agent | Skip mechanism | Send mechanism |
|-------|---------------|----------------|
| **agent-nodejs** | `skipSchemaUpdate: true` | `skipSchemaUpdate: false` (default) |
| **forest-express-sequelize** | `FOREST_DISABLE_AUTO_SCHEMA_APPLY=true` | Unset the env var |
| **agent-ruby** | `FOREST_DISABLE_AUTO_SCHEMA_APPLY=true` | Unset the env var |
| **forest-rails** | `FOREST_DISABLE_AUTO_SCHEMA_APPLY=true` | Unset the env var |

### What works without schema

- All CRUD operations, filters, pagination, sorting, actions work normally
- Only the Forest Admin UI rendering depends on the schema
- The MCP server interacts via the agent API, not the UI — so testing works regardless

---

## Data Model

### SQLite Schema

3 collections with simple relations:

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  body TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  post_id INTEGER NOT NULL REFERENCES posts(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Relations

- `users` 1→N `posts` (via `user_id`)
- `users` 1→N `comments` (via `user_id`)
- `posts` 1→N `comments` (via `post_id`)

### Seed Data

~50 users, ~200 posts, ~500 comments. Enough to test pagination, search, and filters meaningfully.

### Action

One simple action on `posts`: **"Publish"** — sets `status` to `'published'`. Same action implemented identically in all 4 agents.

---

## Proxy

Single Express app on port 3310.

### Proxy routes

All requests **except** `/__admin/*` are forwarded to the active agent using `http-proxy` (headers, body, status codes preserved transparently).

### Admin routes (`/__admin/*`)

```
POST /__admin/switch?agent=ruby              → Stop current agent, start ruby, switch proxy target
POST /__admin/switch?agent=ruby&schema=true  → Same + agent sends its schema to Forest Admin
GET  /__admin/status                         → Current active agent + health info
```

### Health check on switch

Before completing a switch, the proxy:
1. Starts the new agent process
2. Polls the agent's health endpoint (e.g. `GET /forest`) until it responds (timeout: 30s)
3. If healthy: stops the old agent, switches the proxy target, returns success
4. If timeout: returns an error with a clear message ("agent-ruby failed to start — is Ruby installed? Check logs above.")

---

## CLI

### Commands

```bash
yarn agents                              # Seed DB + start proxy + start agent-nodejs (sends schema)
yarn agents:use <name>                   # Switch to agent (nodejs | express | ruby | rails)
yarn agents:use <name> --send-schema     # Switch + force agent to send its schema
yarn agents:status                       # Show active agent + health
yarn agents:upgrade                      # Upgrade all agents to latest versions
```

### `yarn agents:use` implementation

```typescript
// src/cli.ts
const agent = process.argv[2];
const sendSchema = process.argv.includes('--send-schema');
const params = new URLSearchParams({ agent });
if (sendSchema) params.set('schema', 'true');

const res = await fetch(`http://localhost:3310/__admin/switch?${params}`, { method: 'POST' });
const data = await res.json();

if (data.ok) {
  console.log(`✓ Switched to ${data.agent}`);
} else {
  console.error(`✗ ${data.error}`);
  process.exit(1);
}
```

### `yarn agents:upgrade` implementation

```typescript
// src/upgrade.ts
// Node.js agents
execSync('yarn upgrade @forestadmin/agent @forestadmin/datasource-sql', { cwd: '.' });
execSync('yarn upgrade forest-express-sequelize', { cwd: 'agents/express-sequelize' });

// Ruby agents
execSync('bundle update forest_admin_agent', { cwd: 'agents/ruby' });
execSync('bundle update forest_liana', { cwd: 'agents/rails' });

console.log('✓ All agents upgraded to latest versions');
```

---

## Startup Sequence

`yarn agents` (via `start.ts`) does the following:

1. **Validate env** — check `.env` exists with `FOREST_ENV_SECRET` and `FOREST_AUTH_SECRET`. If missing, print clear error pointing to `.env.example`.
2. **Check ports** — verify ports 3310-3314 are free. If not, print which port is in use and by what process.
3. **Seed SQLite** — run `seed.ts` to create/reset `db.sqlite` with 50 users, 200 posts, 500 comments.
4. **Start agent-nodejs** (port 3311) — `skipSchemaUpdate: false`, sends schema to Forest Admin.
5. **Wait for agent-nodejs to be ready** — poll health endpoint.
6. **Start the proxy** (port 3310).
7. **Log status** — print a clear summary:

```
┌─────────────────────────────────────────┐
│  Forest Admin Test Agents               │
├─────────────────────────────────────────┤
│  Proxy:    http://localhost:3310        │
│  Active:   nodejs (port 3311)           │
│  Schema:   sent by nodejs               │
│  Database: db.sqlite (seeded)           │
├─────────────────────────────────────────┤
│  yarn agents:use <name>  to switch      │
│  yarn agents:use <name> --send-schema   │
│  Ctrl+C to stop                         │
└─────────────────────────────────────────┘
```

### Graceful shutdown (Ctrl+C)

Signal handlers (`SIGINT`, `SIGTERM`) in `start.ts`:
1. Kill active agent child process (if any)
2. Close proxy server
3. Exit cleanly

No orphaned Ruby/Node processes.

---

## Agent Details

### agent-nodejs (in-process)

```typescript
import { createAgent } from '@forestadmin/agent';
import { createSqlDataSource } from '@forestadmin/datasource-sql';

const agent = createAgent({
  envSecret: process.env.FOREST_ENV_SECRET,
  authSecret: process.env.FOREST_AUTH_SECRET,
  isProduction: false,
  skipSchemaUpdate, // true or false depending on --send-schema
})
.addDataSource(createSqlDataSource({ dialect: 'sqlite', storage: './db.sqlite' }))
.customizeCollection('posts', collection => {
  collection.addAction('Publish', {
    scope: 'Single',
    execute: async (context) => {
      await context.collection.update(context.filter, { status: 'published' });
      return { type: 'Success', message: 'Post published!' };
    },
  });
});

agent.mountOnStandaloneServer(3311);
await agent.start();
```

### forest-express-sequelize (child process)

Own `package.json` in `agents/express-sequelize/`. Runs as a child process via `node app.js`.

Sequelize models defined for `users`, `posts`, `comments`. Action "Publish" defined as a Smart Action.

### agent-ruby (child process)

`Gemfile` with `forest_admin_agent`, `forest_admin_datasource_active_record`, `sqlite3`. Runs via `bundle exec ruby app.rb`.

ActiveRecord models + action "Publish" implemented in Ruby.

### forest-rails (child process)

Minimal Rails API-only app. `Gemfile` with `forest_liana`, `sqlite3`. Runs via `bundle exec rackup -p 3314`.

ActiveRecord models + Smart Action "Publish" via `ForestLiana::Collection`.

---

## File Structure

```
packages/test-agents/
├── package.json                  # Root scripts: agents, agents:use, agents:status, agents:upgrade
├── tsconfig.json
├── .env.example                  # Template with FOREST_ENV_SECRET / FOREST_AUTH_SECRET
├── src/
│   ├── start.ts                  # Orchestrator — validates env, seeds DB, starts agent + proxy
│   ├── seed.ts                   # Creates and seeds SQLite (50 users, 200 posts, 500 comments)
│   ├── proxy.ts                  # Express proxy + /__admin/* routes
│   ├── cli.ts                    # yarn agents:use / agents:status
│   ├── upgrade.ts                # yarn agents:upgrade
│   └── agent-manager.ts         # Start/stop/health-check agent processes
├── agents/
│   ├── nodejs.ts                 # @forestadmin/agent + datasource-sql (in-process)
│   ├── express-sequelize/        # Child process with own package.json
│   │   ├── package.json
│   │   ├── app.js
│   │   └── models/
│   │       ├── user.js
│   │       ├── post.js
│   │       └── comment.js
│   ├── ruby/                     # Child process
│   │   ├── Gemfile
│   │   └── app.rb
│   └── rails/                    # Child process
│       ├── Gemfile
│       ├── config.ru
│       └── app.rb
└── README.md                     # How to use, prerequisites, troubleshooting
```

---

## Prerequisites

### Required

- **Node.js** >= 18
- A Forest Admin environment configured with agent URL `http://localhost:3310`

### Optional (for Ruby agents)

- **Ruby** >= 3.0 + Bundler
- **Rails** >= 7.0 (for forest-rails agent only)

If Ruby is not installed, `yarn agents:use ruby` prints:
```
✗ Ruby is not installed. Install Ruby >= 3.0 and Bundler to use Ruby agents.
  See: https://www.ruby-lang.org/en/downloads/
```

### First-time setup

```bash
# From monorepo root
yarn install                                                    # Node dependencies

# Optional: Ruby agents
cd packages/test-agents/agents/ruby && bundle install           # agent-ruby deps
cd packages/test-agents/agents/rails && bundle install          # forest-rails deps
```

---

## Environment Variables

Single `.env` file at `packages/test-agents/.env`:

```bash
FOREST_ENV_SECRET=<your-env-secret>
FOREST_AUTH_SECRET=<your-auth-secret>
```

A `.env.example` is provided. All 4 agents share the same secrets (same Forest Admin environment).

---

## Root package.json aliases

Add to the monorepo root `package.json`:

```json
{
  "scripts": {
    "agents": "yarn workspace @forestadmin/test-agents start",
    "agents:use": "yarn workspace @forestadmin/test-agents use",
    "agents:status": "yarn workspace @forestadmin/test-agents status",
    "agents:upgrade": "yarn workspace @forestadmin/test-agents upgrade"
  }
}
```

---

## What's NOT in scope

- No Docker — everything runs natively
- No CI integration — this is a local dev tool
- No auto-install of Ruby/Bundler — prerequisites listed, user installs manually
- No production deployment — dev-only
- No concurrent agents — one active at a time
