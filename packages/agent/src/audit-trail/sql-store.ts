import type { AuditHistoryQuery, AuditRecord, AuditStorageOptions, AuditStore } from './types';
import type { Model, ModelStatic } from 'sequelize';

import { DataTypes, Op, Sequelize } from 'sequelize';

import { runAuditMigrations } from './migrations';

export const DEFAULT_SCHEMA = 'forest';
export const DEFAULT_TABLE = 'audit_logs';

const DIALECTS_WITH_SCHEMAS = new Set(['postgres', 'mssql']);

const MODEL_NAME = 'ForestAuditLog';

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

export async function ensureAuditStorage(
  sequelize: Sequelize,
  options: { schema?: string; tableName: string },
): Promise<ModelStatic<Model>> {
  const schema = DIALECTS_WITH_SCHEMAS.has(sequelize.getDialect()) ? options.schema : undefined;

  await runAuditMigrations(sequelize, { schema, tableName: options.tableName });

  return defineAuditLogModel(sequelize, { schema, tableName: options.tableName });
}

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

function fieldsChangedCondition(sequelize: Sequelize, fields: string[]) {
  const dialect = sequelize.getDialect();

  if (dialect === 'postgres') {
    const keys = fields.map(field => sequelize.escape(field)).join(',');

    return Sequelize.literal(
      `(jsonb_exists_any("previous_values"::jsonb, ARRAY[${keys}]) ` +
        `OR jsonb_exists_any("new_values"::jsonb, ARRAY[${keys}]))`,
    );
  }

  if (dialect === 'sqlite') {
    const tests = fields.flatMap(field => {
      const path = sequelize.escape(`$.${field}`);

      return [
        `json_type(previous_values, ${path}) IS NOT NULL`,
        `json_type(new_values, ${path}) IS NOT NULL`,
      ];
    });

    return Sequelize.literal(`(${tests.join(' OR ')})`);
  }

  if (dialect === 'mysql' || dialect === 'mariadb') {
    const paths = fields.map(field => sequelize.escape(`$.${field}`)).join(',');

    return Sequelize.literal(
      `(JSON_CONTAINS_PATH(previous_values, 'one', ${paths}) ` +
        `OR JSON_CONTAINS_PATH(new_values, 'one', ${paths}))`,
    );
  }

  throw new Error(`Audit-trail "fields" filter is not supported on dialect "${dialect}"`);
}

function buildHistoryWhereClause(
  { collection, recordId, userIds, startTimestamp, endTimestamp, fields }: AuditHistoryQuery,
  sequelize: Sequelize,
): Record<string | symbol, unknown> {
  const where: Record<string | symbol, unknown> = { collection, recordId };

  if (userIds) where.userId = { [Op.in]: userIds };

  const timestampRange: Record<symbol, Date> = {};
  if (startTimestamp) timestampRange[Op.gte] = new Date(startTimestamp);
  if (endTimestamp) timestampRange[Op.lte] = new Date(endTimestamp);
  if (Object.getOwnPropertySymbols(timestampRange).length) where.timestamp = timestampRange;

  if (fields?.length) where[Op.and] = [fieldsChangedCondition(sequelize, fields)];

  return where;
}

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
 * Returns a SQL-backed audit store. Construction is synchronous so the store can be passed to
 * `createAgent` at module top level; the connection (and pending migrations) only run when
 * `store.init()` is awaited during `agent.start()`. The store also self-initializes on the first
 * append or read so tests and manual scripts work without an explicit init.
 */
export function createSqlAuditStore(options: AuditStorageOptions): {
  store: AuditStore;
  close: () => Promise<void>;
} {
  const { connectionString, schema = DEFAULT_SCHEMA, tableName = DEFAULT_TABLE } = options;

  let sequelize: Sequelize | null = null;
  let bootstrap: Promise<{ model: ModelStatic<Model>; connection: Sequelize }> | null = null;

  const init = (): Promise<{ model: ModelStatic<Model>; connection: Sequelize }> => {
    if (bootstrap) return bootstrap;

    const connection = new Sequelize(connectionString, { logging: false });
    sequelize = connection;
    bootstrap = (async () => {
      try {
        await connection.authenticate();
        const model = await ensureAuditStorage(connection, { schema, tableName });

        return { model, connection };
      } catch (error) {
        // Reset so a later call can retry once the database is reachable.
        await connection.close().catch(() => undefined);
        sequelize = null;
        bootstrap = null;
        throw error;
      }
    })();

    return bootstrap;
  };

  // Insertion-order tiebreaker on `id` keeps paging deterministic when timestamps collide.
  const chronologicalOrder = [
    ['timestamp', 'ASC'],
    ['id', 'ASC'],
  ] as const;

  return {
    store: {
      async init() {
        await init();
      },
      async append(record) {
        const { model } = await init();
        await model.create(toRow(record));
      },
      async listByRecord(query) {
        const { model, connection } = await init();
        const { skip = 0, limit, order = 'asc' } = query;
        const direction = order === 'desc' ? 'DESC' : 'ASC';

        const rows = await model.findAll({
          where: buildHistoryWhereClause(query, connection),
          order: [
            ['timestamp', direction],
            ['id', 'ASC'],
          ],
          offset: skip,
          limit,
        });

        return rows.map(fromRow);
      },
      async countByRecord(query) {
        const { model, connection } = await init();

        return model.count({ where: buildHistoryWhereClause(query, connection) });
      },
      async listByCorrelation({ collection, recordId, correlationKey }) {
        const { model } = await init();

        const rows = await model.findAll({
          where: { collection, recordId, correlationKey },
          order: chronologicalOrder as never,
        });

        return rows.map(fromRow);
      },
      async listByCorrelations({ collection, recordId, correlationKeys }) {
        if (!correlationKeys.length) return [];

        const { model } = await init();

        const rows = await model.findAll({
          where: { collection, recordId, correlationKey: { [Op.in]: correlationKeys } },
          order: chronologicalOrder as never,
        });

        return rows.map(fromRow);
      },
    },
    close: async () => {
      if (sequelize) await sequelize.close();
      sequelize = null;
      bootstrap = null;
    },
  };
}
