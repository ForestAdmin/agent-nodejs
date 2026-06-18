import type { AuditRecord, AuditStorageOptions, AuditStore } from './types';
import type { Model, ModelStatic } from 'sequelize';

import { DataTypes, Sequelize } from 'sequelize';

import { runAuditMigrations } from './migrations';

export const DEFAULT_SCHEMA = 'forest';
export const DEFAULT_TABLE = 'audit_logs';

/** Dialects that support real schemas (namespaces). Elsewhere the table lives in the default schema. */
const SCHEMA_DIALECTS = new Set(['postgres', 'mssql']);

const MODEL_NAME = 'ForestAuditLog';

/**
 * Declare the audit-log model on a connection. Does not touch the database.
 *
 * Only the actor's `userId` is stored; the rest of the actor identity is persisted elsewhere and
 * correlated through `correlationKey`.
 */
export function defineAuditLogModel(
  sequelize: Sequelize,
  options: { schema?: string; tableName: string },
): ModelStatic<Model> {
  return sequelize.define(
    MODEL_NAME,
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      timestamp: { type: DataTypes.DATE, allowNull: false },
      operation: { type: DataTypes.STRING, allowNull: false },
      collection: { type: DataTypes.STRING, allowNull: false },
      recordId: { type: DataTypes.STRING, allowNull: false },
      userId: { type: DataTypes.INTEGER, allowNull: true },
      correlationKey: { type: DataTypes.STRING, allowNull: true },
      previousValues: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
      newValues: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
    },
    {
      schema: options.schema,
      tableName: options.tableName,
      timestamps: false,
      underscored: true,
      freezeTableName: true,
    },
  );
}

/**
 * Ensure the schema and the audit table exist, then return the model.
 *
 * The schema (when the dialect supports it) and the table are both created and evolved through
 * versioned migrations (see {@link runAuditMigrations}) — so later schema changes are applied instead
 * of being silently skipped the way `sync()` would, and concurrent agent instances bootstrap safely.
 *
 * - empty database          → schema (when supported) and table are created;
 * - database without schema  → schema is created next to the existing tables, table is created;
 * - database with the schema → schema creation is a no-op, only pending migrations run.
 */
export async function ensureAuditStorage(
  sequelize: Sequelize,
  options: { schema?: string; tableName: string },
): Promise<ModelStatic<Model>> {
  const useSchema = SCHEMA_DIALECTS.has(sequelize.getDialect()) ? options.schema : undefined;

  await runAuditMigrations(sequelize, { schema: useSchema, tableName: options.tableName });

  return defineAuditLogModel(sequelize, { schema: useSchema, tableName: options.tableName });
}

/** Map an audit record to a database row. */
export function toRow(record: AuditRecord): Record<string, unknown> {
  return {
    timestamp: record.timestamp,
    operation: record.operation,
    collection: record.collection,
    recordId: record.recordId,
    userId: record.userId,
    correlationKey: record.correlationKey,
    previousValues: record.previousValues,
    newValues: record.newValues,
  };
}

/** Map a database row back to an audit record. Inverse of {@link toRow}. */
export function fromRow(row: Model): AuditRecord {
  const plain = row.get({ plain: true }) as Record<string, unknown>;
  const { timestamp } = plain;

  return {
    timestamp: timestamp instanceof Date ? timestamp.toISOString() : String(timestamp),
    operation: plain.operation as AuditRecord['operation'],
    collection: plain.collection as string,
    recordId: plain.recordId as string,
    userId: plain.userId as number,
    correlationKey: plain.correlationKey as string,
    previousValues: (plain.previousValues as Record<string, unknown>) ?? {},
    newValues: (plain.newValues as Record<string, unknown>) ?? {},
  };
}

/**
 * Return a SQL-backed audit store that both writes and reads from `forest.audit_logs`.
 *
 * Construction is synchronous so the store can be passed to `createAgent({ auditTrail: { store } })`
 * at module top level; the connection is opened lazily on the first append or read. Pass the same
 * store to the plugin (`auditTrail(ds, cc, { store })`) so writes and the record-history route
 * agree on storage.
 */
export function createSqlAuditStore(options: AuditStorageOptions): {
  store: AuditStore;
  close: () => Promise<void>;
} {
  const { connectionString, schema = DEFAULT_SCHEMA, tableName = DEFAULT_TABLE } = options;

  let sequelize: Sequelize | null = null;
  let modelPromise: Promise<ModelStatic<Model>> | null = null;

  const getModel = (): Promise<ModelStatic<Model>> => {
    if (modelPromise) return modelPromise;

    const connection = new Sequelize(connectionString, { logging: false });
    sequelize = connection;
    modelPromise = (async () => {
      try {
        await connection.authenticate();

        return await ensureAuditStorage(connection, { schema, tableName });
      } catch (error) {
        // Reset so a later call can retry once the database is reachable.
        await connection.close().catch(() => undefined);
        sequelize = null;
        modelPromise = null;
        throw error;
      }
    })();

    return modelPromise;
  };

  return {
    store: {
      async append(record) {
        const model = await getModel();
        await model.create(toRow(record));
      },
      async listByRecord({ collection, recordId }) {
        const model = await getModel();
        const rows = await model.findAll({
          where: { collection, recordId },
          order: [['timestamp', 'ASC']],
        });

        return rows.map(fromRow);
      },
    },
    close: async () => {
      if (sequelize) await sequelize.close();
      sequelize = null;
      modelPromise = null;
    },
  };
}
