# Audit trail

Capture who changed what (before/after) for every change Forest performs through its data layer,
and persist it into a SQL database — built directly into the agent.

The audit trail has two decoupled parts, both handled by the agent:

- **Capture** — datasource-agnostic. Forest's collection hooks instrument every collection, so it
  works the same whether the audited datasource is SQL, Sequelize or Mongo.
- **Storage** — a SQL store (Sequelize-backed) that creates the `forest` schema and creates/evolves
  the `audit_logs` table through versioned migrations. The connection is provided by the caller as
  a connection URI string.

## Use it in an agent

Pass an `auditTrail` option to `createAgent`. The agent constructs the SQL store, registers the
CRUD hooks on every collection, and mounts the record-history routes only when this option is set.

```ts
import { createAgent } from '@forestadmin/agent';

const agent = createAgent({
  /* ...your usual options... */
  auditTrail: {
    // `connectionString` may point to an empty database, the database already used by the agent,
    // or a database that already contains the `forest` schema — the schema and table are created
    // only when missing.
    connectionString: process.env.AUDIT_TRAIL_DATABASE_URL,
  },
});
```

That's the whole integration. When the agent starts, it opens the connection and runs any pending
migrations to create/upgrade `forest.audit_logs` — so a bad connection string or a broken migration
fails fast at startup rather than on the first audited write. Every create / update / delete
performed through Forest then writes one row per record, and the **Historic** tab in the UI reads
from the same table.

### Recommended: gate it behind an environment variable

Keeping the connection string in an env var lets you enable the audit trail per environment and
keep it inactive when unset:

```ts
const agent = createAgent({
  /* ...your usual options... */
  auditTrail: process.env.AUDIT_TRAIL_DATABASE_URL
    ? { connectionString: process.env.AUDIT_TRAIL_DATABASE_URL }
    : null,
});
```

## Options

| option             | default       | description                                                                  |
| ------------------ | ------------- | ---------------------------------------------------------------------------- |
| `connectionString` | _(required)_  | Postgres / SQL connection string for the storage                             |
| `schema`           | `forest`      | schema that namespaces Forest-owned tables (ignored on dialects with no schemas) |
| `tableName`        | `audit_logs`  | name of the audit table                                                      |
| `redact`           | `{}`          | `{ [collection]: string[] }` — field values to mask while still recording the change |

### Redaction

A redacted field still produces an audit entry when it changes (so the change is recorded), but its
value is replaced by the `[redacted]` sentinel instead of being stored:

```ts
auditTrail: {
  connectionString: process.env.AUDIT_TRAIL_DATABASE_URL,
  redact: { users: ['ssn', 'password'] },
},
```

## What gets stored

The `forest.audit_logs` table has one row per audited change:

| column            | description                                              |
| ----------------- | -------------------------------------------------------- |
| `id`              | auto-increment primary key                               |
| `timestamp`       | when the change happened                                 |
| `operation`       | `create` / `update` / `delete`                           |
| `collection`      | audited collection name                                  |
| `record_id`       | packed record id (primary keys joined with `\|`)         |
| `user_id`         | the Forest user who made the change                      |
| `correlation_key` | per-request correlation id (groups one request together) |
| `previous_values` | values before the change (JSON)                          |
| `new_values`      | values after the change (JSON)                           |

`previous_values` / `new_values` store **only the parts that actually changed**: for a JSON column,
nested objects and arrays of objects are diffed structurally, so a single sub-field change records
just that leaf rather than the whole document.

Writes initiated from inside a smart action are audited too — `context.collection.update` /
`create` / `delete` calls go through the internal hook decorator and produce rows under the same
correlation key as the action.

## HTTP routes

When `auditTrail` is set, the agent exposes three routes (all behind Forest's auth, gated by
`assertCanRead` on the target collection).

### `GET /forest/_audit-trail/{collection}/{recordId}` — per-record history

Returns the current page of history together with the filtered total:

```json
{ "data": [ /* current page rows */ ], "meta": { "count": 137 } }
```

`meta.count` reflects the active filters (not the absolute total) and is independent of the page.
Optional filters (all combine with `AND`; omitting them keeps the full history):

| query param | format                            | effect                                                       |
| ----------- | --------------------------------- | ------------------------------------------------------------ |
| `userIds`   | comma-separated integers `12,45`  | keep only entries whose `userId` is in the list              |
| `startDate` | `YYYY-MM-DD` or datetime (incl.)  | keep entries from this lower bound onward                    |
| `endDate`   | `YYYY-MM-DD` or datetime (incl.)  | keep entries up to this upper bound                          |

`startDate` / `endDate` are interpreted as **local wall-clock time** in the request `timezone`
(e.g. `Europe/Paris`); the route converts each bound to a UTC instant before querying the store.
Two shapes are accepted:

- **Bare day** `YYYY-MM-DD` — `startDate` snaps to the start of the day (`00:00:00.000`), `endDate`
  to the end (`23:59:59.999`).
- **Datetime** `YYYY-MM-DD[T| ]HH:mm[:ss]` — `T` or a space separator, seconds optional. The given
  time is used as-is; when seconds are omitted, `endDate` is completed to `:59.999` and `startDate`
  stays at `:00.000`.

Both bounds are **inclusive**.

Defensive parsing:

- `userIds`: non-numeric tokens are dropped (`12,abc,45` → `12,45`); if nothing numeric remains the
  filter is ignored.
- `startDate` / `endDate`: a value matching none of the accepted formats returns **HTTP 400**.

**Pagination** follows JSON:API: `page[number]` is 1-based (default `1`) and `page[size]` defaults
to `20`, capped at `100`. Out-of-bound or non-numeric values fall back to the defaults.

**Sorting** follows JSON:API `sort` on `timestamp`:

- `sort=-timestamp` — newest first. **Default** when the param is absent (or unrecognized).
- `sort=timestamp` — oldest first.

Ties on equal timestamps fall back to insertion order (the auto-increment `id`), so the order is
deterministic and stable across pages whatever the direction and filters.

### `GET /forest/_audit-trail/correlation/{correlationKey}`

Returns `{ data: AuditRecord[] }` — the operation(s) recorded under one `correlationKey` for a
single record (usually one), oldest first, or an empty array if none.

| query param    | required | effect                                                       |
| -------------- | -------- | ------------------------------------------------------------ |
| `collection`   | yes      | collection the record belongs to (also the permission scope) |
| `recordId`     | yes      | packed record id to scope the lookup                         |
| `timezone`     | no       | accepted for parity with the per-record route                |

A missing `collection` or `recordId` returns **HTTP 400**.

### `GET` / `POST /forest/_audit-trail/correlations` — batch

Returns `{ data: AuditRecord[] }` — a **flat** list of every record whose `correlationKey` is in
`correlationKeys`, scoped to one record (the client groups by `correlationKey`).

| query param       | required | effect                                                       |
| ----------------- | -------- | ------------------------------------------------------------ |
| `correlationKeys` | yes\*    | comma-separated keys; blank tokens are dropped               |
| `collection`      | yes      | collection the record belongs to (also the permission scope) |
| `recordId`        | yes      | packed record id to scope the lookup                         |
| `timezone`        | no       | accepted for parity with the per-record route                |

\* `correlationKeys` is bounded by the page size (≈20). To avoid any URL length limit, the same
route also accepts **`POST`** with a JSON body
`{ "correlationKeys": [...], "collection", "recordId" }` (the body takes precedence over the
query). An empty/absent key list returns `{ data: [] }` without hitting the store.

## Correlation header

Every response carries an `x-forest-correlation-id` header (a UUID generated once per request and
echoed back through CORS). The same id is set as `caller.requestId` for the duration of the request
and is the value stored as `correlation_key` on every row written during that request.

## Schema migrations

The `audit_logs` table is created and evolved through versioned
[Umzug](https://github.com/sequelize/umzug) migrations rather than `sync()`, so schema changes are
actually applied to existing databases (a plain "create if not exists" would silently skip them).

- Applied migrations are tracked in a dedicated `forest.audit_migrations` table, kept separate from
  the default `SequelizeMeta` so it never shares migration state with another component writing to
  the same database.
- Pending migrations run automatically when the agent starts (`agent.start()` awaits the bootstrap
  before mounting the router).
- **Multiple instances:** on Postgres the migrations run inside a transaction-scoped advisory lock,
  so several agents booting at once apply them one after another instead of racing on the same
  DDL — the losers block on the lock, then find the migrations already applied and continue. The
  `forest` schema is created (and committed) first, before the lock, since the migration runner
  opens its own connection and would not see an uncommitted `CREATE SCHEMA`; that step is made
  idempotent (existence check + tolerating a concurrent "already exists").

**Evolving the table (maintainers):** append a new entry to the `migrations` array in
`packages/agent/src/audit-trail/migrations.ts` and update the model in `sql-store.ts` to match.
Never edit, reorder or delete an existing migration, and keep changes additive/backward-compatible
— the connection string may point at the customer's own database.

## Notes

- **Source vs storage are independent.** You can audit a **Mongo** datasource and persist the
  trail into **Postgres** — the SQL columns are decoupled from the audited source.
- The store is constructed when the agent is built, but the actual connection and pending
  migrations only run during `agent.start()`. Any connection or migration error therefore surfaces
  at startup, not on the first request.
