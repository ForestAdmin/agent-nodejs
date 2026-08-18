import type {
  AuditHistoryQuery,
  AuditRecord,
  AuditStatus,
  AuditStorageOptions,
  AuditStore,
  PendingAuditRecord,
} from './types';
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
      // Millisecond precision: a bare DATE truncates to whole seconds on MySQL, which would
      // silently drop the fractional part the `/state` boundary and the `id` tiebreaker both rely
      // on for correct ordering.
      timestamp: { type: DataTypes.DATE(3), allowNull: false },
      operation: { type: DataTypes.STRING, allowNull: false },
      collection: { type: DataTypes.STRING, allowNull: false },
      // TEXT, not STRING (VARCHAR(255)): a packed composite-id can exceed 255 characters, and the
      // migration creates the column as such — this must match. Nullable: a pending create's row
      // has no id yet, since the record doesn't exist until the write resolves.
      recordId: { type: DataTypes.TEXT, allowNull: true },
      userId: { type: DataTypes.INTEGER, allowNull: true },
      // Denormalised from the caller at write time — who acted then, not who holds that id today.
      userFirstName: { type: DataTypes.TEXT, allowNull: true },
      userLastName: { type: DataTypes.TEXT, allowNull: true },
      userEmail: { type: DataTypes.TEXT, allowNull: true },
      // `action` / `action_failed` rows only.
      actionName: { type: DataTypes.TEXT, allowNull: true },
      correlationKey: { type: DataTypes.STRING, allowNull: true },
      previousValues: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
      newValues: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'done' },
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

export function toRow(
  record: PendingAuditRecord & { status: AuditStatus },
): Record<string, unknown> {
  return {
    timestamp: record.timestamp,
    operation: record.operation,
    collection: record.collection,
    recordId: record.recordId,
    userId: record.userId,
    userFirstName: record.userFirstName,
    userLastName: record.userLastName,
    userEmail: record.userEmail,
    actionName: record.actionName,
    correlationKey: record.correlationKey,
    previousValues: record.previousValues,
    newValues: record.newValues,
    status: record.status,
  };
}

// A bare `$.${field}` path treats a dot in `field` as a nested-member separator instead of a
// literal character (so `profile.name` would look up `profile` → `name` instead of the top-level
// key `"profile.name"` the audit row actually stores under). Quoting the segment makes it literal.
function jsonPath(field: string): string {
  return `$."${field.replace(/"/g, '\\"')}"`;
}

export function fieldsChangedCondition(sequelize: Sequelize, fields: string[]) {
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
      const path = sequelize.escape(jsonPath(field));

      return [
        `json_type(previous_values, ${path}) IS NOT NULL`,
        `json_type(new_values, ${path}) IS NOT NULL`,
      ];
    });

    return Sequelize.literal(`(${tests.join(' OR ')})`);
  }

  if (dialect === 'mysql' || dialect === 'mariadb') {
    const paths = fields.map(field => sequelize.escape(jsonPath(field))).join(',');

    return Sequelize.literal(
      `(JSON_CONTAINS_PATH(previous_values, 'one', ${paths}) ` +
        `OR JSON_CONTAINS_PATH(new_values, 'one', ${paths}))`,
    );
  }

  if (dialect === 'mssql') {
    const tests = fields.flatMap(field => {
      const path = sequelize.escape(jsonPath(field));

      return [
        `JSON_PATH_EXISTS(previous_values, ${path}) = 1`,
        `JSON_PATH_EXISTS(new_values, ${path}) = 1`,
      ];
    });

    // JSON_PATH_EXISTS requires SQL Server 2022+.
    return Sequelize.literal(`(${tests.join(' OR ')})`);
  }

  throw new Error(`Audit-trail "fields" filter is not supported on dialect "${dialect}"`);
}

// JSON columns are already stored as plain text on dialects with no native JSON type (sqlite,
// mssql); only postgres/mysql/mariadb need an explicit cast before a text match can run on them.
function jsonColumnAsText(sequelize: Sequelize, column: string): string {
  const dialect = sequelize.getDialect();

  if (dialect === 'postgres') return `${column}::text`;
  if (dialect === 'mysql' || dialect === 'mariadb') return `CAST(${column} AS CHAR)`;

  return column;
}

// A free-text search against the *serialized* JSON text naturally covers "keys and scalar values
// at any depth" without walking the structure by hand: both a key and a value appear as a quoted
// literal substring of that text. This runs as a SQL WHERE clause (not an in-memory scan of
// fetched rows), so it composes with pagination and COUNT the same way every other filter does. A
// redacted value can't match a search for the real value — the real value already isn't in this
// text, `redactValues` replaced it before the row was ever written.
export function searchCondition(sequelize: Sequelize, term: string) {
  // Escapes the two LIKE wildcards plus the escape character itself, so a term containing `%`/`_`
  // is matched literally instead of behaving like a pattern.
  const escaped = term.replace(/[\\%_]/g, char => `\\${char}`);
  const pattern = sequelize.escape(`%${escaped}%`);

  const columns = [
    'action_name',
    'user_first_name',
    'user_last_name',
    'user_email',
    jsonColumnAsText(sequelize, 'previous_values'),
    jsonColumnAsText(sequelize, 'new_values'),
  ];

  return Sequelize.literal(
    `(${columns
      .map(column => `LOWER(${column}) LIKE LOWER(${pattern}) ESCAPE '\\'`)
      .join(' OR ')})`,
  );
}

function buildHistoryWhereClause(
  {
    collection,
    recordId,
    userIds,
    startTimestamp,
    endTimestamp,
    fields,
    search,
  }: AuditHistoryQuery,
  sequelize: Sequelize,
): Record<string | symbol, unknown> {
  const where: Record<string | symbol, unknown> = { collection, recordId };

  if (userIds) where.userId = { [Op.in]: userIds };

  const timestampRange: Record<symbol, Date> = {};
  if (startTimestamp) timestampRange[Op.gte] = new Date(startTimestamp);
  if (endTimestamp) timestampRange[Op.lte] = new Date(endTimestamp);
  if (Object.getOwnPropertySymbols(timestampRange).length) where.timestamp = timestampRange;

  const andConditions = [];
  if (fields?.length) andConditions.push(fieldsChangedCondition(sequelize, fields));
  if (search) andConditions.push(searchCondition(sequelize, search));
  if (andConditions.length) where[Op.and] = andConditions;

  return where;
}

export function fromRow(row: Model): AuditRecord {
  const plain = row.get({ plain: true }) as Record<string, unknown>;
  const { timestamp } = plain;

  return {
    id: Number(plain.id),
    timestamp: timestamp instanceof Date ? timestamp.toISOString() : String(timestamp),
    operation: plain.operation as AuditRecord['operation'],
    collection: plain.collection as string,
    recordId: (plain.recordId as string) ?? null,
    userId: plain.userId as number,
    userFirstName: (plain.userFirstName as string) ?? null,
    userLastName: (plain.userLastName as string) ?? null,
    userEmail: (plain.userEmail as string) ?? null,
    actionName: (plain.actionName as string) ?? null,
    correlationKey: plain.correlationKey as string,
    previousValues: (plain.previousValues as Record<string, unknown>) ?? {},
    newValues: (plain.newValues as Record<string, unknown>) ?? {},
    status: plain.status as AuditStatus,
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
      async insertPending(record) {
        const { model } = await init();
        const row = await model.create(toRow({ ...record, status: 'pending' }));

        return Number(row.get('id'));
      },
      // Per-row generated ids from one statement are trustworthy on every supported dialect:
      // Postgres/MSSQL return them natively (RETURNING/OUTPUT), Sequelize infers them sequentially
      // from the single last-insert-id on MySQL/MariaDB (safe because a multi-row INSERT holds the
      // table's auto-increment lock for the whole statement under the default lock mode — no other
      // connection's insert can land an id in the middle of this batch), and sqlite returns them
      // directly too (verified empirically).
      async insertPendingBatch(records) {
        const { model } = await init();
        const rows = await model.bulkCreate(
          records.map(record => toRow({ ...record, status: 'pending' })),
        );

        return rows.map(row => Number(row.get('id')));
      },
      async confirm(id, patch) {
        const { model } = await init();
        await model.update({ ...patch, status: 'done' }, { where: { id } });
      },
      async listByRecord(query) {
        const { model, connection } = await init();
        const { skip = 0, limit, order = 'asc' } = query;
        const direction = order === 'desc' ? 'DESC' : 'ASC';

        const rows = await model.findAll({
          where: buildHistoryWhereClause(query, connection),
          order: [
            ['timestamp', direction],
            ['id', direction],
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
      async listDistinctUsers(query) {
        const { model, connection } = await init();

        // MAX() rather than a bare column: grouping by `user_id` alone is invalid in strict SQL
        // unless every selected column is either grouped or aggregated.
        const rows = (await model.findAll({
          where: buildHistoryWhereClause(query as AuditHistoryQuery, connection),
          attributes: [
            'userId',
            [Sequelize.fn('MAX', Sequelize.col('user_first_name')), 'userFirstName'],
            [Sequelize.fn('MAX', Sequelize.col('user_last_name')), 'userLastName'],
            [Sequelize.fn('MAX', Sequelize.col('user_email')), 'userEmail'],
          ],
          group: ['userId'],
          raw: true,
        })) as unknown as Array<{
          userId: number;
          userFirstName: string | null;
          userLastName: string | null;
          userEmail: string | null;
        }>;

        return rows.map(row => ({
          id: row.userId,
          firstName: row.userFirstName ?? null,
          lastName: row.userLastName ?? null,
          email: row.userEmail ?? null,
        }));
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
