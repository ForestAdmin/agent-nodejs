import type { AuditRecord } from '../src';
import type * as MigrationsModule from '../src/migrations';

import { Sequelize } from 'sequelize';

import { createSqlAuditStore, ensureAuditStorage, toRow } from '../src';
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

  it('runs the migrations on the first init() call and short-circuits on subsequent ones', async () => {
    (runAuditMigrations as jest.Mock).mockClear();
    const { store, close } = createSqlAuditStore({ connectionString: 'sqlite::memory:' });

    await store.init?.();
    await store.init?.();
    await store.init?.();

    // ensureAuditStorage delegates to runAuditMigrations once; subsequent init() calls reuse
    // the cached connection instead of re-running migrations.
    expect(runAuditMigrations).toHaveBeenCalledTimes(1);

    await close();
  });

  it('honors the skip and limit parameters in listByRecord', async () => {
    const { store, close } = createSqlAuditStore({ connectionString: 'sqlite::memory:' });

    await store.append(record({ timestamp: '2026-01-02T00:00:01.000Z' }));
    await store.append(record({ timestamp: '2026-01-02T00:00:02.000Z' }));
    await store.append(record({ timestamp: '2026-01-02T00:00:03.000Z' }));
    await store.append(record({ timestamp: '2026-01-02T00:00:04.000Z' }));

    const page = await store.listByRecord({
      collection: 'accounts',
      recordId: '1',
      skip: 1,
      limit: 2,
    });

    expect(page.map(entry => entry.timestamp)).toEqual([
      '2026-01-02T00:00:02.000Z',
      '2026-01-02T00:00:03.000Z',
    ]);

    await close();
  });

  it('filters by userIds at the query level', async () => {
    const { store, close } = createSqlAuditStore({ connectionString: 'sqlite::memory:' });

    await store.append(record({ recordId: '1', userId: 1 }));
    await store.append(record({ recordId: '1', userId: 2 }));
    await store.append(record({ recordId: '1', userId: 3 }));

    const history = await store.listByRecord({
      collection: 'accounts',
      recordId: '1',
      userIds: [1, 3],
    });

    expect(history.map(r => r.userId)).toEqual([1, 3]);

    await close();
  });

  it('filters by the inclusive startTimestamp/endTimestamp range at the query level', async () => {
    const { store, close } = createSqlAuditStore({ connectionString: 'sqlite::memory:' });

    await store.append(record({ recordId: '1', timestamp: '2026-01-01T00:00:00.000Z' }));
    await store.append(record({ recordId: '1', timestamp: '2026-01-02T00:00:00.000Z' }));
    await store.append(record({ recordId: '1', timestamp: '2026-01-03T00:00:00.000Z' }));

    const history = await store.listByRecord({
      collection: 'accounts',
      recordId: '1',
      startTimestamp: '2026-01-02T00:00:00.000Z',
      endTimestamp: '2026-01-03T00:00:00.000Z',
    });

    expect(history.map(r => r.timestamp)).toEqual([
      '2026-01-02T00:00:00.000Z',
      '2026-01-03T00:00:00.000Z',
    ]);

    await close();
  });
});
