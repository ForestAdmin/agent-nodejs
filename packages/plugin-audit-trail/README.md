# @forestadmin/plugin-audit-trail

Capture who changed what (before/after) for every change Forest performs through its data layer, and
persist it into a SQL database.

The plugin has two decoupled parts:

- **Capture** — datasource-agnostic. It instruments every collection through the Forest customizer
  hooks, so it works the same whether the audited datasource is SQL, Sequelize or Mongo.
- **Storage** — where the audit records are written. This package ships a **SQL sink** that creates
  the `forest` schema and creates/evolves the `audit_logs` table through versioned migrations, plus
  an in-memory store for tests.

## Install

```bash
yarn add @forestadmin/plugin-audit-trail
```

## Use it in an agent

The SQL sink connects, ensures the `forest` schema exists and runs any pending migrations
asynchronously, so it is built inside an **async plugin** — Forest awaits queued plugins when the
agent starts.

```ts
import { auditTrail, createSqlAuditSink } from '@forestadmin/plugin-audit-trail';

// `connectionString` may point to an empty database, the database already used by the agent,
// or a database that already contains the `forest` schema — the schema and table are created
// only when missing.
const connectionString = process.env.AUDIT_TRAIL_DATABASE_URL;

if (connectionString) {
  agent.use(async (dataSourceCustomizer, collectionCustomizer) => {
    const { sink } = await createSqlAuditSink({ connectionString });

    await auditTrail(dataSourceCustomizer, collectionCustomizer, { sink });
  });
}
```

That's the whole integration. On startup the plugin ensures the `forest` schema exists and runs any
pending migrations to create/upgrade `forest.audit_logs`; every create / update / delete performed
through Forest then writes one row per record.

### Recommended: gate it behind an environment variable

Keeping the connection string in an env var lets you enable the audit trail per environment and keeps
it inactive (with a warning) when unset:

```ts
const addAuditTrailCustomizations = (agent, { env, logger }) => {
  const connectionString = env.AUDIT_TRAIL_DATABASE_URL;

  if (!connectionString) {
    logger.warn('Audit trail disabled: set AUDIT_TRAIL_DATABASE_URL to enable it.');

    return;
  }

  agent.use(async (dataSourceCustomizer, collectionCustomizer) => {
    const { sink } = await createSqlAuditSink({ connectionString });

    await auditTrail(dataSourceCustomizer, collectionCustomizer, { sink });
  });
};
```

## What gets stored

The `forest.audit_logs` table has one row per audited change:

| column            | description                                              |
| ----------------- | -------------------------------------------------------- |
| `id`              | auto-increment primary key                               |
| `timestamp`       | when the change happened                                 |
| `operation`       | `create` / `update` / `delete`                           |
| `collection`      | audited collection name                                  |
| `record_id`       | packed record id (primary keys joined)                   |
| `user_id`         | the Forest user who made the change                      |
| `correlation_key` | per-request correlation id (groups one request together) |
| `previous_values` | values before the change (JSON)                          |
| `new_values`      | values after the change (JSON)                           |

`previous_values` / `new_values` store **only the parts that actually changed**: for a JSON column,
nested objects and arrays of objects are diffed structurally, so a single sub-field change records
just that leaf rather than the whole document.

## Schema migrations

The `audit_logs` table is created and evolved through versioned
[Umzug](https://github.com/sequelize/umzug) migrations rather than `sync()`, so schema changes are
actually applied to existing databases (a plain "create if not exists" would silently skip them).

- Applied migrations are tracked in a dedicated `forest.audit_migrations` table, kept separate from
  the default `SequelizeMeta` so it never shares migration state with another component writing to
  the same database (e.g. the workflow executor keeps its own `SequelizeMeta`, or the customer may
  own one in their default schema).
- Pending migrations run automatically when the sink is built (on agent start).
- **Multiple instances:** on Postgres the schema creation, the meta-table creation and every
  migration run together inside a single transaction-scoped advisory lock, so several agents booting
  at once perform the whole bootstrap one after another instead of racing on the same DDL. The
  losers block on the lock, then find the migrations already applied and continue.

**Evolving the table (maintainers):** append a new entry to the `migrations` array in
`src/migrations.ts` (e.g. an `addColumn`) and update the model in `src/sql-sink.ts` to match. Never
edit, reorder or delete an existing migration, and keep changes additive/backward-compatible — the
connection string may point at the customer's own database.

## Options

`createSqlAuditSink(options)`:

| option             | default       | description                                       |
| ------------------ | ------------- | ------------------------------------------------- |
| `connectionString` | _(required)_  | Postgres / SQL connection string for the storage  |
| `schema`           | `forest`      | schema that namespaces Forest-owned tables        |
| `tableName`        | `audit_logs`  | name of the audit table                           |

`auditTrail(dataSourceCustomizer, collectionCustomizer, options)`:

| option   | description                                                                            |
| -------- | ------------------------------------------------------------------------------------- |
| `sink`   | where records are written (e.g. the SQL sink above)                                    |
| `store`  | a readable store (`append` + `listByRecord`) — used by the record-history agent route |
| `redact` | `{ [collection]: string[] }` — field values to mask while still recording the change   |

## Notes

- **Source vs storage are independent.** You can audit a **Mongo** datasource and persist the trail
  into **Postgres** via the SQL sink — the SQL columns are decoupled from the audited source.
- The SQL sink is **write-only**. The record-history agent route reads from a `store.listByRecord`,
  so use a readable `store` if you need that route.
