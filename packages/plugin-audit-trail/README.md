# @forestadmin/plugin-audit-trail

Capture who changed what (before/after) for every change Forest performs through its data layer, and
persist it into a SQL database.

The plugin has two decoupled parts:

- **Capture** — datasource-agnostic. It instruments every collection through the Forest customizer
  hooks, so it works the same whether the audited datasource is SQL, Sequelize or Mongo.
- **Storage** — where the audit records are written. This package ships a **SQL sink** that creates
  the `forest` schema and the `audit_logs` table on the fly, plus an in-memory store for tests.

## Install

```bash
yarn add @forestadmin/plugin-audit-trail
```

## Use it in an agent

The SQL sink connects and bootstraps its schema/table asynchronously, so it is built inside an
**async plugin** — Forest awaits queued plugins when the agent starts.

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

That's the whole integration. On startup the plugin creates `forest.audit_logs` if it does not
exist; every create / update / delete performed through Forest then writes one row per record.

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
