import type { QueryInterface, Sequelize, Transaction } from 'sequelize';

import { DataTypes } from 'sequelize';
import { SequelizeStorage, Umzug } from 'umzug';

export type MigrationContext = {
  queryInterface: QueryInterface;
  schema?: string;
  tableName: string;
};

// Dedicated table tracking which audit migrations have been applied. Kept separate from the default
// `SequelizeMeta` (and namespaced in the `forest` schema) so it never shares migration state with
// another component writing to the same database — e.g. the workflow executor, which keeps its own
// `SequelizeMeta` in the default schema.
const MIGRATIONS_TABLE = 'audit_migrations';

// Arbitrary but stable key pair identifying the audit-trail migration critical section. It only has
// to be unique enough not to collide with other advisory locks the application might take.
const ADVISORY_LOCK: readonly [number, number] = [0x464f, 0x5254]; // "FO", "RT"

/**
 * Ordered, append-only list of audit-table migrations. To evolve the schema, add a new entry at the
 * end — never edit, reorder or delete an existing one (already-applied migrations are skipped).
 */
const migrations = [
  {
    name: '001-create-audit-logs',
    up: async ({ context }: { context: MigrationContext }) => {
      await context.queryInterface.createTable(
        { tableName: context.tableName, schema: context.schema },
        {
          id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
          timestamp: { type: DataTypes.DATE, allowNull: false },
          operation: { type: DataTypes.STRING, allowNull: false },
          collection: { type: DataTypes.STRING, allowNull: false },
          record_id: { type: DataTypes.STRING, allowNull: false },
          user_id: { type: DataTypes.INTEGER, allowNull: true },
          correlation_key: { type: DataTypes.STRING, allowNull: true },
          previous_values: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
          new_values: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
        },
      );
    },
    down: async ({ context }: { context: MigrationContext }) => {
      await context.queryInterface.dropTable({
        tableName: context.tableName,
        schema: context.schema,
      });
    },
  },
  {
    name: '002-index-record-and-correlation',
    up: async ({ context }: { context: MigrationContext }) => {
      const table = { tableName: context.tableName, schema: context.schema };

      // record_id powers the per-record history lookup, correlation_key groups a request's changes,
      // user_id filters the log by the user who made the change.
      await context.queryInterface.addIndex(table, ['record_id'], {
        name: `${context.tableName}_record_id`,
      });
      await context.queryInterface.addIndex(table, ['correlation_key'], {
        name: `${context.tableName}_correlation_key`,
      });
      await context.queryInterface.addIndex(table, ['user_id'], {
        name: `${context.tableName}_user_id`,
      });
    },
    down: async ({ context }: { context: MigrationContext }) => {
      const table = { tableName: context.tableName, schema: context.schema };

      await context.queryInterface.removeIndex(table, `${context.tableName}_record_id`);
      await context.queryInterface.removeIndex(table, `${context.tableName}_correlation_key`);
      await context.queryInterface.removeIndex(table, `${context.tableName}_user_id`);
    },
  },
];

function buildUmzug(sequelize: Sequelize, options: { schema?: string; tableName: string }) {
  return new Umzug({
    migrations,
    context: {
      queryInterface: sequelize.getQueryInterface(),
      schema: options.schema,
      tableName: options.tableName,
    },
    // Dedicated tracking table, namespaced in the `forest` schema (see MIGRATIONS_TABLE).
    storage: new SequelizeStorage({
      sequelize,
      schema: options.schema,
      tableName: MIGRATIONS_TABLE,
    }),
    logger: undefined,
  });
}

/**
 * Create the schema (namespace) when it is missing. No-op when no schema is requested — dialects
 * without schema support pass `undefined`. When a transaction is given the work runs inside it, so
 * on Postgres it is covered by the migration advisory lock.
 */
async function ensureSchema(
  sequelize: Sequelize,
  schema: string | undefined,
  transaction?: Transaction,
): Promise<void> {
  if (!schema) return;

  const queryInterface = sequelize.getQueryInterface();
  // showAllSchemas keeps the operation idempotent regardless of the server version, since
  // CREATE SCHEMA only emits IF NOT EXISTS on recent databases.
  const schemas = (await queryInterface.showAllSchemas({ transaction })) as unknown as string[];

  if (!schemas.includes(schema)) {
    await queryInterface.createSchema(schema, { transaction });
  }
}

/**
 * Create the schema then apply every pending audit-table migration.
 *
 * On Postgres the schema creation, the meta-table creation and every migration run together inside a
 * single transaction-scoped advisory lock, so several agent instances booting at once perform the
 * whole bootstrap one after another instead of racing on the same DDL — the losers block on the
 * lock, then find the migrations already applied and continue. Other dialects have no cross-instance
 * lock; their individual statements are idempotent.
 */
export async function runAuditMigrations(
  sequelize: Sequelize,
  options: { schema?: string; tableName: string },
): Promise<void> {
  if (sequelize.getDialect() !== 'postgres') {
    await ensureSchema(sequelize, options.schema);
    await buildUmzug(sequelize, options).up();

    return;
  }

  await sequelize.transaction(async transaction => {
    await sequelize.query('SELECT pg_advisory_xact_lock(:a, :b)', {
      transaction,
      replacements: { a: ADVISORY_LOCK[0], b: ADVISORY_LOCK[1] },
    });

    await ensureSchema(sequelize, options.schema, transaction);
    await buildUmzug(sequelize, options).up();
  });
}
