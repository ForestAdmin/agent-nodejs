# @forestadmin/plugin-audit-trail

Capture who changed what (before/after) for every change Forest performs through its data layer, and
persist it into a SQL database.

The plugin has two decoupled parts:

- **Capture** — datasource-agnostic. It instruments every collection through the Forest customizer
  hooks, so it works the same whether the audited datasource is SQL, Sequelize or Mongo.
- **Storage** — where the audit records are written. This package ships a **SQL store** that creates
  the `forest` schema and creates/evolves the `audit_logs` table through versioned migrations, plus
  an in-memory store for tests.

## Install

```bash
yarn add @forestadmin/plugin-audit-trail
```

## Use it in an agent

`createSqlAuditStore` returns a store that both **writes** every audited change and **reads**
the per-record history back. Pass the same instance to `createAgent` (so the record-history route
is exposed) and to the plugin (so the writes land in the same table the route reads from).

```ts
import { createAgent } from '@forestadmin/agent';
import { auditTrail, createSqlAuditStore } from '@forestadmin/plugin-audit-trail';

// `connectionString` may point to an empty database, the database already used by the agent,
// or a database that already contains the `forest` schema — the schema and table are created
// only when missing.
const { store } = createSqlAuditStore({
  connectionString: process.env.AUDIT_TRAIL_DATABASE_URL,
});

const agent = createAgent({
  /* ...your usual options... */
  auditTrail: { store }, // exposes GET /forest/_audit-trail/{collection}/:id
});

agent.use((dataSourceCustomizer, collectionCustomizer) =>
  auditTrail(dataSourceCustomizer, collectionCustomizer, { store }),
);
```

That's the whole integration. When the agent starts, the plugin opens the connection and runs any
pending migrations to create/upgrade `forest.audit_logs` — so a bad connection string or a broken
migration fails fast at startup rather than on the first audited write. Every create / update /
delete performed through Forest then writes one row per record, and the **Historic** tab in the
UI reads from the same table.

### Record-history route

`GET /forest/_audit-trail/{collection}/{recordId}` returns `{ data: AuditRecord[] }`, oldest first.
It paginates through the standard `page[size]` / `page[number]` query params and accepts the
following **optional** filters (all combine with `AND`; omitting them keeps the full history):

| query param | format                            | effect                                                       |
| ----------- | --------------------------------- | ------------------------------------------------------------ |
| `userIds`   | comma-separated integers `12,45`  | keep only entries whose `userId` is in the list              |
| `startDate` | `YYYY-MM-DD` or datetime (incl.)  | keep entries from this lower bound onward                    |
| `endDate`   | `YYYY-MM-DD` or datetime (incl.)  | keep entries up to this upper bound                          |

`startDate` / `endDate` are interpreted as **local wall-clock time** in the request `timezone` (the
existing query param, e.g. `Europe/Paris`); the route converts each bound to a UTC instant before
querying the store, so filtering happens at the SQL level rather than in memory. Two shapes are
accepted:

- **Bare day** `YYYY-MM-DD` — `startDate` snaps to the start of the day (`00:00:00.000`), `endDate`
  to the end (`23:59:59.999`).
- **Datetime** `YYYY-MM-DD[T| ]HH:mm[:ss]` — `T` or a space separator, seconds optional. The given
  time is used as-is; when seconds are omitted, `endDate` is completed to `:59.999` (so the minute
  stays inclusive) and `startDate` stays at `:00.000`.

Both bounds are **inclusive**.

Defensive parsing:

- `userIds`: non-numeric tokens are dropped (`12,abc,45` → `12,45`); if nothing numeric remains the
  filter is ignored.
- `startDate` / `endDate`: a value matching none of the accepted formats returns **HTTP 400**
  (`ValidationError`).


### Recommended: gate it behind an environment variable

Keeping the connection string in an env var lets you enable the audit trail per environment and keeps
it inactive (with a warning) when unset:

```ts
const buildAuditTrail = ({ env, logger }) => {
  const connectionString = env.AUDIT_TRAIL_DATABASE_URL;

  if (!connectionString) {
    logger.warn('Audit trail disabled: set AUDIT_TRAIL_DATABASE_URL to enable it.');

    return null;
  }

  return createSqlAuditStore({ connectionString });
};

const auditTrailHandle = buildAuditTrail({ env: process.env, logger: console });

const agent = createAgent({
  /* ...your usual options... */
  auditTrail: auditTrailHandle ? { store: auditTrailHandle.store } : null,
});

if (auditTrailHandle) {
  agent.use((dataSourceCustomizer, collectionCustomizer) =>
    auditTrail(dataSourceCustomizer, collectionCustomizer, { store: auditTrailHandle.store }),
  );
}
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
- Pending migrations run automatically when the agent starts (the audit-trail plugin awaits the
  store's bootstrap before completing setup).
- **Multiple instances:** on Postgres the migrations run inside a transaction-scoped advisory lock,
  so several agents booting at once apply them one after another instead of racing on the same DDL —
  the losers block on the lock, then find the migrations already applied and continue. The `forest`
  schema is created (and committed) first, before the lock, since the migration runner opens its own
  connection and would not see an uncommitted `CREATE SCHEMA`; that step is made idempotent instead
  (existence check + tolerating a concurrent "already exists").

**Evolving the table (maintainers):** append a new entry to the `migrations` array in
`src/migrations.ts` (e.g. an `addColumn`) and update the model in `src/sql-store.ts` to match. Never
edit, reorder or delete an existing migration, and keep changes additive/backward-compatible — the
connection string may point at the customer's own database.

## Options

`createSqlAuditStore(options)`:

| option             | default       | description                                       |
| ------------------ | ------------- | ------------------------------------------------- |
| `connectionString` | _(required)_  | Postgres / SQL connection string for the storage  |
| `schema`           | `forest`      | schema that namespaces Forest-owned tables        |
| `tableName`        | `audit_logs`  | name of the audit table                           |

`auditTrail(dataSourceCustomizer, collectionCustomizer, options)`:

| option   | description                                                                            |
| -------- | ------------------------------------------------------------------------------------- |
| `sink`   | a custom callback called for every audited change (e.g. write to console or syslog)    |
| `store`  | a readable store (`append` + `listByRecord`) — used by the record-history agent route |
| `redact` | `{ [collection]: string[] }` — field values to mask while still recording the change   |

## Notes

- **Source vs storage are independent.** You can audit a **Mongo** datasource and persist the trail
  into **Postgres** via the SQL store — the SQL columns are decoupled from the audited source.
- `createSqlAuditStore` is constructed **synchronously**, so it can be built at module top level and
  handed to `createAgent({ auditTrail: { store } })`. The actual connection and pending migrations
  happen when the audit-trail plugin runs at `agent.start()` — so any connection or migration error
  surfaces during startup, not at the first request.
