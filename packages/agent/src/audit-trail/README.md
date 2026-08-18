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

Sequelize does not bundle database drivers, so install the one matching `connectionString`'s
dialect — e.g. `pg` and `pg-hstore` for PostgreSQL — even in an agent whose main datasource isn't SQL.

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
| `critical`         | `false`       | `true` refuses a write when its pending audit entry fails to record; see [Write protocol](#write-protocol) |

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

| column               | description                                                       |
| -------------------- | ------------------------------------------------------------------ |
| `id`                 | auto-increment primary key; exposed in the API response too, as `id` |
| `timestamp`          | when the change happened                                           |
| `operation`          | `create` / `update` / `delete` / `action` / `action_failed`        |
| `collection`         | audited collection name                                            |
| `record_id`          | packed record id (primary keys joined with `\|`); `null` for a `create` row still `pending` (the record's id isn't assigned yet) |
| `user_id`            | id of the Forest user who made the change                          |
| `user_first_name`    | that user's first name, denormalized at write time                 |
| `user_last_name`     | that user's last name, denormalized at write time                  |
| `user_email`         | that user's email, denormalized at write time                      |
| `action_name`        | the smart action's name, for `action` / `action_failed` rows only (`null` otherwise) |
| `correlation_key`    | per-request correlation id (groups one request together)           |
| `previous_values`    | values before the change (JSON)                                    |
| `new_values`         | values after the change (JSON)                                     |
| `status`             | `pending` or `done` — see [Write protocol](#write-protocol)         |

The identity columns (`user_first_name`/`user_last_name`/`user_email`) are copied from the caller
**at the moment of the write**, not looked up live from the current user record: a row reflects who
acted *then*, not who holds that user id today (a renamed, deleted or reassigned account doesn't
rewrite history).

`previous_values` / `new_values` store **only the parts that actually changed**: for a JSON column,
nested objects and arrays of objects are diffed structurally, so a single sub-field change records
just that leaf rather than the whole document. A key present on only one side (a nested field that
was added, or one that was removed) is simply **omitted** from the other side — never written as a
placeholder — so `'key' in previousValues` is itself the signal that the key didn't exist before.

Writes initiated from inside a smart action are audited too — `context.collection.update` /
`create` / `delete` calls go through the internal hook decorator and produce rows under the same
correlation key as the action.

The action invocation itself is also recorded — one row per targeted record, or one row attached to
no record (`record_id: ''`) for a global action or a select-all bulk run. This is the only way a
smart action shows up in the trail when its `execute()` doesn't go through the Forest data layer
(e.g. it calls an external API): the before/after hooks above can't see that.

`previous_values` holds the form the operator submitted (redacted per `redact`); `new_values` holds
a summary of what the action answered — `type`, plus whichever of `message`, `name`, `mimeType`,
`method`, `url`, `path` apply to that result. A `Success`/`Error` result's `html`, a `Webhook`'s
`headers`/`body` (which routinely carry credentials) and a `File` result's contents are deliberately
dropped — file bytes don't belong in an audit table.

`operation` is `action`, or `action_failed` when the action either threw (`new_values` is then
empty — there was no answer to summarize) or resolved with an `Error`-type result (`new_values` then
holds that result's `type`/`message`). Neither value object is a record's before/after: they hold a
form and a reply, not column values, so **an action row is excluded from the `/state` (state-at-a-
past-timestamp) route** rather than replayed as a diff — an action's effect on the data still shows
up through the `create`/`update`/`delete` rows it produced under the same correlation key.

Which action ran **is** recorded here, in `action_name` (unlike a create/update/delete row, where
it's always `null`).

## Write protocol

Every row is written in two phases: a `pending` row is inserted **before** the write runs, carrying
whatever is already known at that point (identity, `record_id` where it exists yet, the
before-values); once the write resolves, that same row is updated to `status: 'done'` with the
values the write actually produced (`operation`, final `record_id`, `previous_values`, `new_values`).

This replaces a simpler fire-and-forget append after the fact, and exists for one reason: recording
*after* the write means a broken audit store fails the request at the one moment failing is
useless — the write already committed. Recording *before* means the request can instead be refused
before anything happens, if that's what you want.

That's what the `critical` option controls:

- **`critical: false`** (default) — a failure inserting the pending row is logged and swallowed; the
  write proceeds exactly as it does today, just without an audit entry for it.
- **`critical: true`** — the same failure instead refuses the operation: nothing is written, no
  compensating write is issued.

What this buys is **no unaudited write, not every row holding exact after-values**. A row left
`pending` means the write may or may not have landed — the confirm step that would have flipped it
to `done` never ran, for whatever reason (a crash, a lost connection, the process being killed
between the write and the confirm). That residue is evidence a write was attempted and never
confirmed, and reading it that way is the point: don't delete a `pending` row, don't fill it in —
its very presence tells you where to look.

A bulk update or delete's before-write snapshot is capped at 1000 records: hitting the cap logs an
explicit warning naming the collection and operation rather than silently auditing only part of a
larger operation.

## HTTP routes

When `auditTrail` is set, the agent exposes three routes (all behind Forest's auth, gated by
`assertCanRead` on the target collection). When the caller's role has a record-level scope on that
collection, every route below — including the correlation lookups — additionally requires the
target id to currently exist and match that scope. A scope can't be evaluated against a record that
no longer exists, so this only refuses a still-existing, out-of-scope id: once a record is genuinely
deleted, anyone who can read the collection can see its history, reconstructed state, or correlated
operations, scope aside — inspecting what was deleted is much of the point of an audit trail.

One exception: on the per-record history route, a `delete` row's `previousValues` is the record's
full last known state — if that state itself would have failed the caller's scope (e.g. it belonged
to a team the caller isn't scoped to), `previousValues` is withheld from that row (replaced with
`{}`) while the row itself — that a deletion happened, by whom and when — stays visible. This
doesn't yet extend to the `/state` route's reconstructed value for the same case; closing that
consistently is a separate, larger decision.

### `GET /forest/_audit-trail/{collection}/{recordId}` — per-record history

Returns the current page of history together with the filtered total:

```json
{ "data": [ /* current page rows */ ], "meta": { "count": 137 } }
```

`meta.count` reflects the active filters (not the absolute total) and is independent of the page.

On the **first fetch only** (no `page[number]` given at all — an explicit `page[number]=1` does not
count), the response also carries `meta.availableUsers`: the distinct authors matching the active
filters, independent of pagination —
`[{ "id": 1, "firstName": "Jane", "lastName": "Doe", "email": "jane@forest.dev" }, ...]`. Any later
fetch (an explicit `page[number]`, whatever its value) omits the key entirely rather than sending an
empty array, so the front is expected to keep the list it already saw — the same rule Forest's
activity-logs route uses.

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

This header is emitted on every response regardless of whether `auditTrail` is configured — it isn't
a signal that the feature is enabled. `POST /forest/_internal/capabilities` reports
`agentCapabilities.canUseAuditTrail: true` when it is; the frontend should gate the History tab on
that flag, not on the header's presence.

## Schema migrations

The `audit_logs` table is created and evolved through versioned
[Umzug](https://github.com/sequelize/umzug) migrations rather than `sync()`, so schema changes are
actually applied to existing databases (a plain "create if not exists" would silently skip them).

- Applied migrations are tracked in a dedicated `{tableName}_migration` table (e.g.
  `audit_logs_migration`), scoped per `tableName` so two stores configured with different table
  names in the same schema never share migration state, and kept separate from the default
  `SequelizeMeta` so it never shares migration state with another component writing to the same
  database.
- Each migration's name is qualified with the schema and table it targets — e.g.
  `forest.audit_logs:001-create-audit-logs` — so it's self-descriptive when read directly out of
  that table, without needing to already know which physical table you're looking at.
- Pending migrations run automatically when the agent starts (`agent.start()` awaits the bootstrap
  before mounting the router).
- **Multiple instances:** on Postgres the migrations run inside a transaction-scoped advisory lock,
  so several agents booting at once apply them one after another instead of racing on the same
  DDL — the losers block on the lock, then find the migration already applied and continue. The
  `forest` schema is created (and committed) first, before the lock, since the migration runner
  opens its own connection and would not see an uncommitted `CREATE SCHEMA`; that step is made
  idempotent (existence check + tolerating a concurrent "already exists").

**Evolving the table (maintainers):** append a new migration to the array built in
`packages/agent/src/audit-trail/migrations.ts` and update the model in `sql-store.ts` to match.
Never edit, reorder or delete an existing migration once it has shipped, and keep changes
additive/backward-compatible — the connection string may point at the customer's own database.

## Notes

- **Source vs storage are independent.** You can audit a **Mongo** datasource and persist the
  trail into **Postgres** — the SQL columns are decoupled from the audited source.
- The store is constructed when the agent is built, but the actual connection and pending
  migrations only run during `agent.start()`. Any connection or migration error therefore surfaces
  at startup, not on the first request.
