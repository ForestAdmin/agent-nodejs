import type { QueryInterface, Sequelize, Transaction } from 'sequelize';

import { DataTypes } from 'sequelize';
import { SequelizeStorage, Umzug } from 'umzug';

export type MigrationContext = {
  queryInterface: QueryInterface;
  schema?: string;
  tableName: string;
  transaction?: Transaction;
};

// Arbitrary but stable pair, only needs to be unique across the advisory locks the application
// takes — the audit-trail migration is the only critical section we hold this lock for.
const ADVISORY_LOCK: readonly [number, number] = [0x464f, 0x5254];

// Scoped by `tableName` (not a single fixed name) so two stores configured with different table
// names in the same schema don't share migration state — otherwise Umzug would see the second
// store's migrations as already applied and never create its table.
function migrationsTableName(tableName: string): string {
  return `${tableName}_migrations`;
}

async function indexNames(
  queryInterface: QueryInterface,
  table: { tableName: string; schema?: string },
  transaction?: Transaction,
): Promise<Set<string>> {
  const indexes = (await queryInterface.showIndex(table, { transaction })) as Array<{
    name: string;
  }>;

  return new Set(indexes.map(index => index.name));
}

// Append-only. To evolve the schema, add a new entry at the end — never edit, reorder or delete
// an existing one (already-applied migrations are skipped).
const migrations = [
  {
    name: '001-create-audit-logs',
    up: async ({ context }: { context: MigrationContext }) => {
      const table = { tableName: context.tableName, schema: context.schema };

      // Idempotent: lets a process that loses a concurrent-boot race retry cleanly instead of
      // failing on a "relation already exists" error from the winner's DDL.
      if (await context.queryInterface.tableExists(table, { transaction: context.transaction })) {
        return;
      }

      await context.queryInterface.createTable(
        table,
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
        { transaction: context.transaction },
      );
    },
    down: async ({ context }: { context: MigrationContext }) => {
      await context.queryInterface.dropTable(
        { tableName: context.tableName, schema: context.schema },
        { transaction: context.transaction },
      );
    },
  },
  {
    name: '002-index-record-and-correlation',
    up: async ({ context }: { context: MigrationContext }) => {
      const table = { tableName: context.tableName, schema: context.schema };
      const existing = await indexNames(context.queryInterface, table, context.transaction);

      const ensureIndex = async (fields: string[], name: string) => {
        if (existing.has(name)) return;

        await context.queryInterface.addIndex(table, fields, {
          name,
          transaction: context.transaction,
        });
      };

      await ensureIndex(['record_id'], `${context.tableName}_record_id`);
      await ensureIndex(['correlation_key'], `${context.tableName}_correlation_key`);
      await ensureIndex(['user_id'], `${context.tableName}_user_id`);
    },
    down: async ({ context }: { context: MigrationContext }) => {
      const table = { tableName: context.tableName, schema: context.schema };
      const options = { transaction: context.transaction };

      await context.queryInterface.removeIndex(table, `${context.tableName}_record_id`, options);
      await context.queryInterface.removeIndex(
        table,
        `${context.tableName}_correlation_key`,
        options,
      );
      await context.queryInterface.removeIndex(table, `${context.tableName}_user_id`, options);
    },
  },
  {
    // `record_id` was VARCHAR(255): a packed composite id can exceed that, silently failing every
    // write for the affected record. Widened to TEXT; the index is rebuilt with a length prefix so
    // it stays valid on MySQL/MariaDB, which cannot index an unbounded TEXT column directly.
    //
    // On dialects that implement `changeColumn` as a table rebuild (e.g. sqlite), every existing
    // index is silently dropped along with the old table — so all of migration 002's indexes, not
    // just this one, are re-created afterward if they're found missing.
    name: '003-widen-record-id',
    up: async ({ context }: { context: MigrationContext }) => {
      const table = { tableName: context.tableName, schema: context.schema };
      const options = { transaction: context.transaction };

      await context.queryInterface.changeColumn(
        table,
        'record_id',
        { type: DataTypes.TEXT, allowNull: false },
        options,
      );

      const existing = await indexNames(context.queryInterface, table, context.transaction);

      const ensureIndex = async (
        fields: Array<string | { name: string; length: number }>,
        name: string,
      ) => {
        if (existing.has(name)) return;

        await context.queryInterface.addIndex(table, {
          fields,
          name,
          transaction: context.transaction,
        });
      };

      await ensureIndex([{ name: 'record_id', length: 191 }], `${context.tableName}_record_id`);
      await ensureIndex(['correlation_key'], `${context.tableName}_correlation_key`);
      await ensureIndex(['user_id'], `${context.tableName}_user_id`);
    },
    down: async ({ context }: { context: MigrationContext }) => {
      const table = { tableName: context.tableName, schema: context.schema };
      const options = { transaction: context.transaction };

      await context.queryInterface.changeColumn(
        table,
        'record_id',
        { type: DataTypes.STRING, allowNull: false },
        options,
      );

      const existing = await indexNames(context.queryInterface, table, context.transaction);

      const ensureIndex = async (fields: string[], name: string) => {
        if (existing.has(name)) return;

        await context.queryInterface.addIndex(table, fields, {
          name,
          transaction: context.transaction,
        });
      };

      await ensureIndex(['record_id'], `${context.tableName}_record_id`);
      await ensureIndex(['correlation_key'], `${context.tableName}_correlation_key`);
      await ensureIndex(['user_id'], `${context.tableName}_user_id`);
    },
  },
];

function buildUmzug(
  sequelize: Sequelize,
  options: { schema?: string; tableName: string; transaction?: Transaction },
) {
  return new Umzug({
    migrations,
    context: {
      queryInterface: sequelize.getQueryInterface(),
      schema: options.schema,
      tableName: options.tableName,
      transaction: options.transaction,
    },
    storage: new SequelizeStorage({
      sequelize,
      schema: options.schema,
      tableName: migrationsTableName(options.tableName),
      // Sequelize caches model definitions by name on the `Sequelize` instance: without a distinct
      // name here, a second store sharing that instance (a different `tableName`, same connection)
      // would reuse the first store's model and read/write the wrong migration-state table.
      modelName: migrationsTableName(options.tableName),
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
 * run inside a transaction-scoped advisory lock, and every DDL statement runs on that same
 * transaction, so concurrent agent boots serialize on the DDL and a failure partway through a
 * migration rolls back cleanly instead of leaving partial DDL behind. Other dialects have no
 * equivalent distributed lock; each migration instead checks what already exists before creating
 * it, which closes most — but not all — of the race window on a truly simultaneous boot.
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

    await buildUmzug(sequelize, { ...options, transaction }).up();
  });
}
