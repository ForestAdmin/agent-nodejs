import type { AuditRecord } from '../src';

import { Sequelize } from 'sequelize';

import { ensureAuditStorage, toRow } from '../src';
import { runAuditMigrations } from '../src/migrations';

const record = (over: Partial<AuditRecord> = {}): AuditRecord => ({
  timestamp: '2026-01-02T03:04:05.000Z',
  operation: 'update',
  collection: 'accounts',
  recordId: '1',
  userId: 42,
  correlationKey: 'req-1',
  previousValues: { status: 'open' },
  newValues: { status: 'closed' },
  ...over,
});

describe('runAuditMigrations (sqlite)', () => {
  it('creates the audit table with the expected columns', async () => {
    const sequelize = new Sequelize('sqlite::memory:', { logging: false });

    await runAuditMigrations(sequelize, { tableName: 'audit_logs' });

    const description = await sequelize.getQueryInterface().describeTable('audit_logs');
    expect(Object.keys(description).sort()).toEqual([
      'collection',
      'correlation_key',
      'id',
      'new_values',
      'operation',
      'previous_values',
      'record_id',
      'timestamp',
      'user_id',
    ]);

    await sequelize.close();
  });

  it('records the applied migration and is idempotent across runs', async () => {
    const sequelize = new Sequelize('sqlite::memory:', { logging: false });

    await runAuditMigrations(sequelize, { tableName: 'audit_logs' });
    // A second run must not throw nor re-apply the migrations.
    await expect(
      runAuditMigrations(sequelize, { tableName: 'audit_logs' }),
    ).resolves.toBeUndefined();

    const [applied] = await sequelize.query('SELECT name FROM "SequelizeMeta" ORDER BY name');
    expect(applied).toEqual([
      { name: '001-create-audit-logs' },
      { name: '002-index-record-and-correlation' },
    ]);

    await sequelize.close();
  });

  it('indexes record_id, correlation_key and user_id', async () => {
    const sequelize = new Sequelize('sqlite::memory:', { logging: false });

    await runAuditMigrations(sequelize, { tableName: 'audit_logs' });

    const indexes = (await sequelize.getQueryInterface().showIndex('audit_logs')) as Array<{
      name: string;
    }>;
    expect(indexes.map(index => index.name)).toEqual(
      expect.arrayContaining([
        'audit_logs_record_id',
        'audit_logs_correlation_key',
        'audit_logs_user_id',
      ]),
    );

    await sequelize.close();
  });
});

describe('ensureAuditStorage + insert (sqlite end to end)', () => {
  it('migrates the table and persists a record into it', async () => {
    const sequelize = new Sequelize('sqlite::memory:', { logging: false });

    const model = await ensureAuditStorage(sequelize, {
      schema: 'forest',
      tableName: 'audit_logs',
    });
    await model.create(toRow(record()));

    const rows = await model.findAll();
    expect(rows).toHaveLength(1);
    expect(rows[0].toJSON()).toMatchObject({
      operation: 'update',
      collection: 'accounts',
      recordId: '1',
      userId: 42,
    });

    await sequelize.close();
  });
});
