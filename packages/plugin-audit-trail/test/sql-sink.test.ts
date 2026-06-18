import type { AuditRecord } from '../src';
import type * as MigrationsModule from '../src/migrations';

import { Sequelize } from 'sequelize';

import { createSqlAuditSink, createSqlAuditStore, ensureAuditStorage, toRow } from '../src';
import { runAuditMigrations } from '../src/migrations';

jest.mock('../src/migrations', () => ({
  runAuditMigrations: jest.fn().mockResolvedValue(undefined),
}));

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

describe('toRow', () => {
  it('maps every audit-record field, including the flat user id', () => {
    expect(toRow(record())).toEqual({
      timestamp: '2026-01-02T03:04:05.000Z',
      operation: 'update',
      collection: 'accounts',
      recordId: '1',
      userId: 42,
      correlationKey: 'req-1',
      previousValues: { status: 'open' },
      newValues: { status: 'closed' },
    });
  });
});

describe('ensureAuditStorage', () => {
  afterEach(() => jest.clearAllMocks());

  it('runs the migrations with the schema on a dialect that supports schemas (postgres)', async () => {
    const sequelize = new Sequelize('postgres://user:pwd@localhost:5432/db', { logging: false });

    await ensureAuditStorage(sequelize, { schema: 'forest', tableName: 'audit_logs' });

    expect(runAuditMigrations).toHaveBeenCalledWith(sequelize, {
      schema: 'forest',
      tableName: 'audit_logs',
    });
  });

  it('runs the migrations without a schema on a dialect without schemas (sqlite)', async () => {
    const sequelize = new Sequelize('sqlite::memory:', { logging: false });

    await ensureAuditStorage(sequelize, { schema: 'forest', tableName: 'audit_logs' });

    // sqlite has no schemas: the namespace must be dropped so the table lands in the default schema.
    expect(runAuditMigrations).toHaveBeenCalledWith(sequelize, {
      schema: undefined,
      tableName: 'audit_logs',
    });

    await sequelize.close();
  });
});

describe('createSqlAuditSink', () => {
  afterEach(() => jest.clearAllMocks());

  it('connects, runs the migrations and returns a sink + close', async () => {
    const { sink, close } = await createSqlAuditSink({
      connectionString: 'sqlite::memory:',
      tableName: 'audit_logs',
    });

    expect(typeof sink).toBe('function');
    expect(runAuditMigrations).toHaveBeenCalled();

    await close();
  });
});

describe('createSqlAuditStore (sqlite round-trip)', () => {
  // The module-level mock turns runAuditMigrations into a no-op, but the round-trip tests need
  // the real migrations so the audit_logs table actually exists in the sqlite database.
  beforeAll(() => {
    const actual = jest.requireActual<typeof MigrationsModule>('../src/migrations');
    (runAuditMigrations as jest.Mock).mockImplementation(actual.runAuditMigrations);
  });

  afterAll(() => {
    (runAuditMigrations as jest.Mock).mockReset();
    (runAuditMigrations as jest.Mock).mockResolvedValue(undefined);
  });

  it('returns rows previously appended, sorted by timestamp, scoped to a single record', async () => {
    const { store, close } = createSqlAuditStore({ connectionString: 'sqlite::memory:' });

    const first = record({ timestamp: '2026-01-02T03:04:05.000Z', recordId: '1' });
    const second = record({
      timestamp: '2026-01-02T03:04:06.000Z',
      recordId: '1',
      previousValues: { status: 'closed' },
      newValues: { status: 'open' },
    });
    const otherRecord = record({ recordId: '2' });

    await store.append(second);
    await store.append(first);
    await store.append(otherRecord);

    const history = await store.listByRecord({ collection: 'accounts', recordId: '1' });

    expect(history).toEqual([
      expect.objectContaining({ timestamp: '2026-01-02T03:04:05.000Z' }),
      expect.objectContaining({ timestamp: '2026-01-02T03:04:06.000Z' }),
    ]);
    expect(history).toHaveLength(2);

    await close();
  });

  it('returns an empty array when no row matches the queried record', async () => {
    const { store, close } = createSqlAuditStore({ connectionString: 'sqlite::memory:' });

    await store.append(record());

    expect(await store.listByRecord({ collection: 'accounts', recordId: 'missing' })).toEqual([]);

    await close();
  });
});
