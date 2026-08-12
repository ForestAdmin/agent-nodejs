import type { AuditRecord } from '../../src/audit-trail';

import { Sequelize } from 'sequelize';

import { ensureAuditStorage, toRow } from '../../src/audit-trail';
import { runAuditMigrations } from '../../src/audit-trail/migrations';

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

    const [applied] = await sequelize.query(
      'SELECT name FROM "audit_logs_migrations" ORDER BY name',
    );
    expect(applied).toEqual([
      { name: '001-create-audit-logs' },
      { name: '002-index-record-and-correlation' },
      { name: '003-widen-record-id' },
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

  it('widens record_id to TEXT so a long packed composite id round-trips', async () => {
    const sequelize = new Sequelize('sqlite::memory:', { logging: false });
    await runAuditMigrations(sequelize, { tableName: 'audit_logs' });

    const longId = 'x'.repeat(500);
    await sequelize.query(
      'INSERT INTO audit_logs ' +
        '(timestamp, operation, collection, record_id, previous_values, new_values) ' +
        "VALUES (:timestamp, 'update', 'accounts', :recordId, '{}', '{}')",
      { replacements: { timestamp: new Date().toISOString(), recordId: longId } },
    );

    const [rows] = await sequelize.query('SELECT record_id FROM audit_logs');
    expect((rows as Array<{ record_id: string }>)[0].record_id).toHaveLength(500);

    await sequelize.close();
  });

  it('scopes migration state by tableName so two stores in the same schema do not collide', async () => {
    const sequelize = new Sequelize('sqlite::memory:', { logging: false });

    await runAuditMigrations(sequelize, { tableName: 'audit_logs' });
    // A second, differently-named table must still get its own migrations applied rather than
    // Umzug treating them as already-done because of the first table's migration state.
    await runAuditMigrations(sequelize, { tableName: 'other_audit_logs' });

    const description = await sequelize.getQueryInterface().describeTable('other_audit_logs');
    expect(Object.keys(description)).toContain('record_id');

    await sequelize.close();
  });

  it('tolerates the table and indexes already existing from a concurrent-boot race', async () => {
    const sequelize = new Sequelize('sqlite::memory:', { logging: false });
    // Simulate a partial prior run: the table and its migration 003 column width are already in
    // place, but nothing was logged as applied yet.
    await runAuditMigrations(sequelize, { tableName: 'audit_logs' });
    await sequelize.query('DELETE FROM "audit_logs_migrations"');

    await expect(
      runAuditMigrations(sequelize, { tableName: 'audit_logs' }),
    ).resolves.toBeUndefined();

    const [applied] = await sequelize.query(
      'SELECT name FROM "audit_logs_migrations" ORDER BY name',
    );
    expect(applied).toHaveLength(3);

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
