import type { QueryInterface, Sequelize } from 'sequelize';

import { DataTypes } from 'sequelize';
import { SequelizeStorage, Umzug } from 'umzug';

export type MigrationContext = {
  queryInterface: QueryInterface;
  schema?: string;
  tableName: string;
};

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
];

function buildUmzug(sequelize: Sequelize, options: { schema?: string; tableName: string }) {
  return new Umzug({
    migrations,
    context: {
      queryInterface: sequelize.getQueryInterface(),
      schema: options.schema,
      tableName: options.tableName,
    },
    // Default tracking table (`SequelizeMeta`), namespaced in the `forest` schema so it never
    // collides with a `SequelizeMeta` the customer might own in their default schema.
    storage: new SequelizeStorage({ sequelize, schema: options.schema }),
    logger: undefined,
  });
}

/**
 * Apply every pending audit-table migration.
 *
 * On Postgres the run is wrapped in a transaction-scoped advisory lock so that several agent
 * instances booting at once migrate one after another instead of racing on the same DDL. The schema
 * (namespace) is expected to already exist — it is a prerequisite for the migrations storage table.
 */
export async function runAuditMigrations(
  sequelize: Sequelize,
  options: { schema?: string; tableName: string },
): Promise<void> {
  const umzug = buildUmzug(sequelize, options);

  if (sequelize.getDialect() !== 'postgres') {
    await umzug.up();

    return;
  }

  await sequelize.transaction(async transaction => {
    await sequelize.query('SELECT pg_advisory_xact_lock(:a, :b)', {
      transaction,
      replacements: { a: ADVISORY_LOCK[0], b: ADVISORY_LOCK[1] },
    });

    await umzug.up();
  });
}
