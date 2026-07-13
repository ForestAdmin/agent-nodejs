import type { Logger } from '../ports/logger-port';
import type { Sequelize, Transaction } from 'sequelize';

import { extractErrorMessage } from '../errors';

// The schema both executor tables live under, so a shared customer database stays safe: the executor
// never touches `public`, and its umzug `SequelizeMeta` registries can't collide with the
// agent/server's own. Skipped on SQLite (test suite), which has no schema support.
export const DEFAULT_SCHEMA = 'forest';

// Must stay constant across releases, or an old and a new deploy could migrate concurrently. Shared
// by every executor migration runner so all of them serialize against one another on cold start.
const MIGRATION_ADVISORY_LOCK_KEY = 6_438_071_259_157;

export function resolveSchema(sequelize: Sequelize, configured?: string): string | undefined {
  if (sequelize.getDialect() === 'sqlite') return undefined;

  return configured || DEFAULT_SCHEMA;
}

export function tableId(
  schema: string | undefined,
  tableName: string,
): string | { tableName: string; schema: string } {
  return schema ? { tableName, schema } : tableName;
}

export function tableReference(schema: string | undefined, tableName: string): string {
  return schema ? `"${schema}"."${tableName}"` : `"${tableName}"`;
}

// pg_namespace is world-readable, so this probe needs no special privilege — unlike CREATE SCHEMA.
async function schemaExists(
  sequelize: Sequelize,
  schema: string,
  transaction: Transaction,
): Promise<boolean> {
  const [rows] = (await sequelize.query('SELECT 1 FROM pg_namespace WHERE nspname = $1', {
    bind: [schema],
    transaction,
  })) as [unknown[], unknown];

  return rows.length > 0;
}

// Serializes booting instances via a transaction-scoped advisory lock: auto-releases at commit and
// is pooler-safe (RDS Proxy / PgBouncer), unlike a session lock which would leak there.
async function withMigrationLock(
  sequelize: Sequelize,
  run: (transaction: Transaction) => Promise<unknown>,
): Promise<void> {
  await sequelize.transaction(async transaction => {
    // Stop a client idle-in-transaction timeout from killing this idle txn mid-migration, which
    // would drop the lock.
    await sequelize.query('SET LOCAL idle_in_transaction_session_timeout = 0', { transaction });
    await sequelize.query('SELECT pg_advisory_xact_lock($1)', {
      bind: [MIGRATION_ADVISORY_LOCK_KEY],
      transaction,
    });
    await run(transaction);
  });
}

// Runs an umzug migration set under the executor's shared-database safety rules: on Postgres the
// `forest` schema is created and migrations run behind the advisory lock (one writer across booting
// replicas); on other dialects (SQLite) it just runs. Logs `failMessage` and rethrows on failure.
export async function runMigrations({
  sequelize,
  umzug,
  schema,
  logger,
  failMessage,
}: {
  sequelize: Sequelize;
  umzug: { up: () => Promise<unknown> };
  schema: string | undefined;
  logger?: Logger;
  failMessage: string;
}): Promise<void> {
  try {
    if (sequelize.getDialect() !== 'postgres') {
      await umzug.up();

      return;
    }

    // The migration lock holds one pool connection while umzug opens a second.
    const { pool } = sequelize.connectionManager as unknown as {
      pool?: { maxSize?: number; write?: { maxSize?: number }; read?: { maxSize?: number } };
    };
    // With replication configured, `pool` splits into write/read sub-pools and `maxSize` is
    // undefined; the migration lock runs on the write pool, so size the check against it.
    const poolMax = pool?.maxSize ?? pool?.write?.maxSize ?? pool?.read?.maxSize ?? 1;

    if (poolMax < 2) {
      throw new Error(
        'workflow-executor requires pool.max >= 2 on Postgres: the migration lock holds one connection while migrations run on another',
      );
    }

    // Schema in its own committed transaction so umzug (on other connections) sees it. Probe first
    // and skip CREATE when it already exists: Postgres checks the database-level CREATE privilege
    // even for CREATE SCHEMA IF NOT EXISTS, so an operator can pre-create the schema and grant only
    // schema-level rights, avoiding database-level CREATE. The probe runs inside the lock so the
    // create stays serialized across booting replicas.
    if (schema) {
      await withMigrationLock(sequelize, async transaction => {
        if (!(await schemaExists(sequelize, schema, transaction))) {
          await sequelize.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`, { transaction });
        }
      });
    }

    await withMigrationLock(sequelize, () => umzug.up());
  } catch (error) {
    logger?.('Error', failMessage, { error: extractErrorMessage(error) });
    throw error;
  }
}
