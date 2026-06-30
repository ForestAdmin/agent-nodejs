import type { QueryInterface, Sequelize } from 'sequelize';

import { DataTypes } from 'sequelize';
import { SequelizeStorage, Umzug } from 'umzug';

export type MigrationContext = {
  queryInterface: QueryInterface;
  schema?: string;
  tableName: string;
};

// Kept separate from the default `SequelizeMeta` so the audit trail's migration state never
// collides with another component (e.g. the workflow executor) writing to the same database.
const MIGRATIONS_TABLE = 'audit_migrations';

// Arbitrary but stable pair, only needs to be unique across the advisory locks the application
// takes — the audit-trail migration is the only critical section we hold this lock for.
const ADVISORY_LOCK: readonly [number, number] = [0x464f, 0x5254];

// Append-only. To evolve the schema, add a new entry at the end — never edit, reorder or delete
// an existing one (already-applied migrations are skipped).
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
    storage: new SequelizeStorage({
      sequelize,
      schema: options.schema,
      tableName: MIGRATIONS_TABLE,
    }),
    logger: undefined,
  });
}

// 42P06 = duplicate_schema (Postgres ≥ 9.2), 23505 = unique_violation on pg_namespace.
const SCHEMA_ALREADY_EXISTS_CODES = new Set(['42P06', '23505']);

function isSchemaAlreadyExistsError(error: unknown): boolean {
  const code = (error as { original?: { code?: string } })?.original?.code;

  return code !== undefined && SCHEMA_ALREADY_EXISTS_CODES.has(code);
}

/**
 * Idempotent CREATE SCHEMA. Must run (and commit) on its own before Umzug, because Umzug's storage
 * opens its own connection to create the meta table and would not see a CREATE SCHEMA still
 * pending in a transaction. Not covered by the advisory lock; the existence check + tolerated
 * "already exists" error makes it safe under concurrent boots instead.
 */
async function ensureSchema(sequelize: Sequelize, schema: string | undefined): Promise<void> {
  if (!schema) return;

  const queryInterface = sequelize.getQueryInterface();
  const schemas = (await queryInterface.showAllSchemas()) as unknown as string[];

  if (schemas.includes(schema)) return;

  try {
    await queryInterface.createSchema(schema);
  } catch (error) {
    if (!isSchemaAlreadyExistsError(error)) throw error;
  }
}

/**
 * Creates the schema then applies every pending audit-table migration. On Postgres the migrations
 * run inside a transaction-scoped advisory lock so concurrent agent boots serialize on the DDL —
 * losers block on the lock, then find the migrations already applied. Other dialects rely on the
 * idempotency of their individual statements.
 */
export async function runAuditMigrations(
  sequelize: Sequelize,
  options: { schema?: string; tableName: string },
): Promise<void> {
  await ensureSchema(sequelize, options.schema);

  if (sequelize.getDialect() !== 'postgres') {
    await buildUmzug(sequelize, options).up();

    return;
  }

  await sequelize.transaction(async transaction => {
    await sequelize.query('SELECT pg_advisory_xact_lock(:a, :b)', {
      transaction,
      replacements: { a: ADVISORY_LOCK[0], b: ADVISORY_LOCK[1] },
    });

    await buildUmzug(sequelize, options).up();
  });
}
