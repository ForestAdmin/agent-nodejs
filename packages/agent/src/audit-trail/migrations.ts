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
  return `${tableName}_migration`;
}

// Qualifies the migration name with the schema/table it targets, so a name is self-descriptive
// when read directly out of the migrations table — e.g. `forest.audit_logs:001-create-audit-logs`.
function qualifiedMigrationName(schema: string | undefined, tableName: string): string {
  return schema
    ? `${schema}.${tableName}:001-create-audit-logs`
    : `${tableName}:001-create-audit-logs`;
}

// Every table name claimed by an audit-trail store configured in this process, keyed by
// `schema\0name` — both its own data table and the migration table Umzug derives from it.
// A second store's data table can otherwise land on the exact name a first store's migration
// table derives to (e.g. `tableName: 'audit'` derives `audit_migration`, which collides with a
// second store's `tableName: 'audit_migration'`), silently adopting that tracking table as its
// own audit table and aborting startup via assertOwnsTable — confusing, since neither store's
// configuration is wrong in isolation. Catching it here, at store-creation time, names the actual
// collision instead of leaving it to that unrelated-looking failure deep inside migration 001.
const claimedTableNames = new Map<string, string>();

function claimTableName(schema: string | undefined, name: string, claimedBy: string): void {
  const key = `${schema ?? ''}\0${name}`;
  const existingOwner = claimedTableNames.get(key);

  if (existingOwner !== undefined && existingOwner !== claimedBy) {
    const target = schema ? `${schema}.${name}` : name;

    throw new Error(
      `[ForestAdmin] Audit trail: "${target}" is claimed by both "tableName: ${claimedBy}" and ` +
        `"tableName: ${existingOwner}" (as either store's own table, or the migration-tracking ` +
        'table Umzug derives from it) — use distinct "tableName" values for each store.',
    );
  }

  claimedTableNames.set(key, claimedBy);
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

async function columnNames(
  queryInterface: QueryInterface,
  table: { tableName: string; schema?: string },
  transaction?: Transaction,
): Promise<Set<string>> {
  // `describeTable`'s options type omits `transaction`, unlike its sibling queryInterface methods,
  // even though it forwards the whole options object into the underlying `sequelize.query()` call
  // (verified against sequelize's own source) — a typings gap, not a runtime one.
  const columns = await queryInterface.describeTable(table, { transaction } as never);

  return new Set(Object.keys(columns));
}

// The migration's own idempotency check (`tableExists`) only asks "is there a table with this
// name", not "is it ours" — so an unrelated customer table happening to share the name would be
// silently adopted. Verifying every column this migration creates catches that.
const AUDIT_LOG_COLUMNS = [
  'id',
  'timestamp',
  'operation',
  'collection',
  'record_id',
  'user_id',
  'user_first_name',
  'user_last_name',
  'user_email',
  'action_name',
  'correlation_key',
  'previous_values',
  'new_values',
  'status',
];

async function assertOwnsTable(
  queryInterface: QueryInterface,
  table: { tableName: string; schema?: string },
  transaction?: Transaction,
): Promise<void> {
  const existing = await columnNames(queryInterface, table, transaction);
  const missing = AUDIT_LOG_COLUMNS.filter(column => !existing.has(column));

  if (missing.length > 0) {
    const target = table.schema ? `${table.schema}.${table.tableName}` : table.tableName;

    throw new Error(
      `[ForestAdmin] Audit trail: "${target}" already exists but is missing column(s) ` +
        `${missing.join(', ')} — it does not look like a Forest audit-trail table. Point ` +
        `auditTrail at a different table via the "tableName" option instead of reusing this one.`,
    );
  }
}

async function ensureIndexes(
  queryInterface: QueryInterface,
  table: { tableName: string; schema?: string },
  transaction?: Transaction,
): Promise<void> {
  const existing = await indexNames(queryInterface, table, transaction);

  const ensureIndex = async (
    fields: Array<string | { name: string; length: number }>,
    name: string,
  ) => {
    if (existing.has(name)) return;

    await queryInterface.addIndex(table, { fields, name, transaction });
  };

  // Length-prefixed so it stays valid on MySQL/MariaDB, which cannot index an unbounded TEXT
  // column directly — `record_id` is TEXT (not VARCHAR) since a packed composite id can be long.
  await ensureIndex([{ name: 'record_id', length: 191 }], `${table.tableName}_record_id`);
  await ensureIndex(['correlation_key'], `${table.tableName}_correlation_key`);
  await ensureIndex(['user_id'], `${table.tableName}_user_id`);
}

function buildMigrations(schema: string | undefined, tableName: string) {
  return [
    {
      name: qualifiedMigrationName(schema, tableName),
      up: async ({ context }: { context: MigrationContext }) => {
        const table = { tableName: context.tableName, schema: context.schema };

        // Idempotent: lets a process that loses a concurrent-boot race retry cleanly instead of
        // failing on a "relation already exists" error from the winner's DDL. Guards against
        // reusing an unrelated table sharing the name, too — see assertOwnsTable.
        if (await context.queryInterface.tableExists(table, { transaction: context.transaction })) {
          await assertOwnsTable(context.queryInterface, table, context.transaction);

          return;
        }

        await context.queryInterface.createTable(
          table,
          {
            id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
            // Millisecond precision: a bare DATE truncates to whole seconds on MySQL, silently
            // dropping the fractional part the `/state` inclusive boundary and the `id` ordering
            // tiebreaker both rely on.
            timestamp: { type: DataTypes.DATE(3), allowNull: false },
            operation: { type: DataTypes.STRING, allowNull: false },
            collection: { type: DataTypes.STRING, allowNull: false },
            // Nullable: a pending create's row has no id yet, since the record doesn't exist
            // until the write resolves.
            record_id: { type: DataTypes.TEXT, allowNull: true },
            user_id: { type: DataTypes.INTEGER, allowNull: true },
            // Denormalised from the caller at write time — who acted then, not who holds that id
            // today.
            user_first_name: { type: DataTypes.TEXT, allowNull: true },
            user_last_name: { type: DataTypes.TEXT, allowNull: true },
            user_email: { type: DataTypes.TEXT, allowNull: true },
            // `action` / `action_failed` rows only.
            action_name: { type: DataTypes.TEXT, allowNull: true },
            correlation_key: { type: DataTypes.STRING, allowNull: true },
            previous_values: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
            new_values: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
            // A row is inserted `pending` before the write runs and confirmed `done` after.
            status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'done' },
          },
          { transaction: context.transaction },
        );

        await ensureIndexes(context.queryInterface, table, context.transaction);
      },
      down: async ({ context }: { context: MigrationContext }) => {
        await context.queryInterface.dropTable(
          { tableName: context.tableName, schema: context.schema },
          { transaction: context.transaction },
        );
      },
    },
  ];
}

export function buildUmzug(
  sequelize: Sequelize,
  options: { schema?: string; tableName: string; transaction?: Transaction },
) {
  claimTableName(options.schema, options.tableName, options.tableName);
  claimTableName(options.schema, migrationsTableName(options.tableName), options.tableName);

  return new Umzug({
    migrations: buildMigrations(options.schema, options.tableName),
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

export function isSchemaAlreadyExistsError(error: unknown): boolean {
  const code = (error as { original?: { code?: string } })?.original?.code;

  return code !== undefined && SCHEMA_ALREADY_EXISTS_CODES.has(code);
}

/**
 * Idempotent CREATE SCHEMA. Must run (and commit) on its own before Umzug, because Umzug's storage
 * opens its own connection to create the meta table and would not see a CREATE SCHEMA still
 * pending in a transaction. Not covered by the advisory lock; the existence check + tolerated
 * "already exists" error makes it safe under concurrent boots instead.
 */
export async function ensureSchema(
  sequelize: Sequelize,
  schema: string | undefined,
): Promise<void> {
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
