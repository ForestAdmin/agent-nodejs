import type { AuditStatus, AuditStore, PendingAuditRecord } from '../../src/audit-trail';
import type * as MigrationsModule from '../../src/audit-trail/migrations';

import { Sequelize } from 'sequelize';

import {
  createSqlAuditStore,
  ensureAuditStorage,
  fieldsChangedCondition,
  searchCondition,
  toRow,
} from '../../src/audit-trail';
import { runAuditMigrations } from '../../src/audit-trail/migrations';

jest.mock('../../src/audit-trail/migrations', () => ({
  runAuditMigrations: jest.fn().mockResolvedValue(undefined),
}));

const record = (over: Partial<PendingAuditRecord> = {}): PendingAuditRecord => ({
  timestamp: '2026-01-02T03:04:05.000Z',
  operation: 'update',
  collection: 'accounts',
  recordId: '1',
  userId: 42,
  userFirstName: 'Jane',
  userLastName: 'Doe',
  userEmail: 'jane.doe@forest.dev',
  actionName: null,
  correlationKey: 'req-1',
  previousValues: { status: 'open' },
  newValues: { status: 'closed' },
  ...over,
});

// The store's public contract is now insertPending-then-confirm; this test's `record()` fixtures
// already carry final values, so seeding just inserts pending and immediately confirms with the
// same values, landing a `done` row equivalent to the old single `append`.
async function seed(store: AuditStore, entry: PendingAuditRecord): Promise<number> {
  const id = await store.insertPending(entry);
  await store.confirm(id, entry);

  return id;
}

describe('toRow', () => {
  it('maps every audit-record field, including the flat user id', () => {
    const status: AuditStatus = 'done';

    expect(toRow({ ...record(), status })).toEqual({
      timestamp: '2026-01-02T03:04:05.000Z',
      operation: 'update',
      collection: 'accounts',
      recordId: '1',
      userId: 42,
      userFirstName: 'Jane',
      userLastName: 'Doe',
      userEmail: 'jane.doe@forest.dev',
      actionName: null,
      correlationKey: 'req-1',
      previousValues: { status: 'open' },
      newValues: { status: 'closed' },
      status: 'done',
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
    const actual = jest.requireActual<typeof MigrationsModule>('../../src/audit-trail/migrations');
    (runAuditMigrations as jest.Mock).mockImplementation(actual.runAuditMigrations);
  });

  afterAll(() => {
    (runAuditMigrations as jest.Mock).mockReset();
    (runAuditMigrations as jest.Mock).mockResolvedValue(undefined);
  });

  it('resets internal state after a failed init so a later call can retry', async () => {
    const { store, close } = createSqlAuditStore({ connectionString: 'sqlite::memory:' });
    (runAuditMigrations as jest.Mock).mockImplementationOnce(() =>
      Promise.reject(new Error('boom')),
    );

    await expect(store.insertPending(record())).rejects.toThrow('boom');
    await expect(store.insertPending(record())).resolves.toEqual(expect.any(Number));

    await close();
  });

  it('never adopts a transaction from Sequelize.useCLS, even when a host process sets one', async () => {
    // `Sequelize._cls` is a class-level static, shared by every Sequelize instance in the same
    // loaded copy of the package — including this store's own, unrelated connection. A query
    // that omits `transaction` reads it as the ambient transaction (and thus connection) to use.
    // Migrations run their own explicit `sequelize.transaction(...)`, which — unlike a plain
    // query — invokes CLS's `.run()`/`.bind()` too; warming the store up before CLS is active
    // keeps this fake namespace to the one method (`.get()`) the vulnerable path actually calls,
    // without having to reimplement the rest of a real CLS namespace's contract.
    const { store, close } = createSqlAuditStore({ connectionString: 'sqlite::memory:' });
    const id = await store.insertPending(record());

    const connectionAccessed = jest.fn();
    const hijackedTransaction = {
      get connection() {
        connectionAccessed();

        return { fakeConnection: true };
      },
    };
    // Reflect avoids both a dot-notation member expression (forbidden on a dangling-underscore
    // name) and an object-literal property of the same name (same rule, same reason).
    Reflect.set(Sequelize, '_cls', {
      get: (key: string) => (key === 'transaction' ? hijackedTransaction : undefined),
    });

    try {
      await expect(
        store.confirm(id, {
          operation: 'update',
          recordId: '1',
          previousValues: {},
          newValues: {},
        }),
      ).resolves.toBeUndefined();

      expect(connectionAccessed).not.toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(Sequelize, '_cls');
    }

    await close();
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

    await seed(store, second);
    await seed(store, first);
    await seed(store, otherRecord);

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

    await seed(store, record());

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

    await seed(store, record({ timestamp: '2026-01-02T00:00:01.000Z' }));
    await seed(store, record({ timestamp: '2026-01-02T00:00:02.000Z' }));
    await seed(store, record({ timestamp: '2026-01-02T00:00:03.000Z' }));
    await seed(store, record({ timestamp: '2026-01-02T00:00:04.000Z' }));

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

    await seed(store, record({ recordId: '1', userId: 1 }));
    await seed(store, record({ recordId: '1', userId: 2 }));
    await seed(store, record({ recordId: '1', userId: 3 }));

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

    await seed(store, record({ recordId: '1', timestamp: '2026-01-01T00:00:00.000Z' }));
    await seed(store, record({ recordId: '1', timestamp: '2026-01-02T00:00:00.000Z' }));
    await seed(store, record({ recordId: '1', timestamp: '2026-01-03T00:00:00.000Z' }));

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

  it('counts all matching rows in countByRecord, ignoring skip and limit', async () => {
    const { store, close } = createSqlAuditStore({ connectionString: 'sqlite::memory:' });

    await Promise.all(
      [1, 2, 3, 4].map(i =>
        seed(store, record({ recordId: '1', timestamp: `2026-01-0${i}T00:00:00.000Z` })),
      ),
    );

    const count = await store.countByRecord({
      collection: 'accounts',
      recordId: '1',
      skip: 2,
      limit: 1,
    });

    expect(count).toBe(4);

    await close();
  });

  it('keeps only entries that touched at least one of the requested fields', async () => {
    const { store, close } = createSqlAuditStore({ connectionString: 'sqlite::memory:' });

    await seed(
      store,
      record({
        recordId: '1',
        timestamp: '2026-01-01T00:00:00.000Z',
        previousValues: { name: 'a' },
        newValues: { name: 'b' },
      }),
    );
    await seed(
      store,
      record({
        recordId: '1',
        timestamp: '2026-01-02T00:00:00.000Z',
        previousValues: { email: 'x' },
        newValues: { email: 'y' },
      }),
    );
    await seed(
      store,
      record({
        recordId: '1',
        timestamp: '2026-01-03T00:00:00.000Z',
        previousValues: { age: 1 },
        newValues: { age: 2 },
      }),
    );

    const history = await store.listByRecord({
      collection: 'accounts',
      recordId: '1',
      fields: ['name', 'email'],
    });

    expect(history.map(r => r.timestamp)).toEqual([
      '2026-01-01T00:00:00.000Z',
      '2026-01-02T00:00:00.000Z',
    ]);

    await close();
  });

  it('paginates after applying the fields filter', async () => {
    const { store, close } = createSqlAuditStore({ connectionString: 'sqlite::memory:' });

    await seed(
      store,
      record({
        recordId: '1',
        timestamp: '2026-01-01T00:00:00.000Z',
        previousValues: { name: 'a' },
        newValues: { name: 'b' },
      }),
    );
    await seed(
      store,
      record({
        recordId: '1',
        timestamp: '2026-01-02T00:00:00.000Z',
        previousValues: { other: 1 },
        newValues: { other: 2 },
      }),
    );
    await seed(
      store,
      record({
        recordId: '1',
        timestamp: '2026-01-03T00:00:00.000Z',
        previousValues: { name: 'c' },
        newValues: { name: 'd' },
      }),
    );
    await seed(
      store,
      record({
        recordId: '1',
        timestamp: '2026-01-04T00:00:00.000Z',
        previousValues: { name: 'e' },
        newValues: { name: 'f' },
      }),
    );

    const page = await store.listByRecord({
      collection: 'accounts',
      recordId: '1',
      fields: ['name'],
      skip: 1,
      limit: 1,
    });

    expect(page.map(r => r.timestamp)).toEqual(['2026-01-03T00:00:00.000Z']);

    await close();
  });

  it('counts only entries that touched at least one of the requested fields', async () => {
    const { store, close } = createSqlAuditStore({ connectionString: 'sqlite::memory:' });

    await seed(
      store,
      record({ recordId: '1', previousValues: { name: 'a' }, newValues: { name: 'b' } }),
    );
    await seed(
      store,
      record({ recordId: '1', previousValues: { other: 1 }, newValues: { other: 2 } }),
    );
    await seed(
      store,
      record({ recordId: '1', previousValues: { name: 'c' }, newValues: { name: 'd' } }),
    );

    const count = await store.countByRecord({
      collection: 'accounts',
      recordId: '1',
      fields: ['name'],
    });

    expect(count).toBe(2);

    await close();
  });

  it('counts only the rows matching the active filters', async () => {
    const { store, close } = createSqlAuditStore({ connectionString: 'sqlite::memory:' });

    await seed(store, record({ recordId: '1', userId: 1 }));
    await seed(store, record({ recordId: '1', userId: 2 }));
    await seed(store, record({ recordId: '1', userId: 1 }));

    const count = await store.countByRecord({
      collection: 'accounts',
      recordId: '1',
      userIds: [1],
    });

    expect(count).toBe(2);

    await close();
  });

  it('orders newest first when order is desc', async () => {
    const { store, close } = createSqlAuditStore({ connectionString: 'sqlite::memory:' });

    await seed(store, record({ recordId: '1', timestamp: '2026-01-01T00:00:00.000Z' }));
    await seed(store, record({ recordId: '1', timestamp: '2026-01-02T00:00:00.000Z' }));
    await seed(store, record({ recordId: '1', timestamp: '2026-01-03T00:00:00.000Z' }));

    const history = await store.listByRecord({
      collection: 'accounts',
      recordId: '1',
      order: 'desc',
    });

    expect(history.map(r => r.timestamp)).toEqual([
      '2026-01-03T00:00:00.000Z',
      '2026-01-02T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z',
    ]);

    await close();
  });

  it('keeps equal-timestamp rows in insertion order (id tie-breaker)', async () => {
    const { store, close } = createSqlAuditStore({ connectionString: 'sqlite::memory:' });
    const timestamp = '2026-01-01T00:00:00.000Z';

    await seed(store, record({ recordId: '1', timestamp, correlationKey: 'first' }));
    await seed(store, record({ recordId: '1', timestamp, correlationKey: 'second' }));
    await seed(store, record({ recordId: '1', timestamp, correlationKey: 'third' }));

    const history = await store.listByRecord({ collection: 'accounts', recordId: '1' });

    expect(history.map(r => r.correlationKey)).toEqual(['first', 'second', 'third']);

    await close();
  });

  it('keeps equal-timestamp rows in reverse insertion order when order is desc', async () => {
    const { store, close } = createSqlAuditStore({ connectionString: 'sqlite::memory:' });
    const timestamp = '2026-01-01T00:00:00.000Z';

    await seed(store, record({ recordId: '1', timestamp, correlationKey: 'first' }));
    await seed(store, record({ recordId: '1', timestamp, correlationKey: 'second' }));
    await seed(store, record({ recordId: '1', timestamp, correlationKey: 'third' }));

    const history = await store.listByRecord({
      collection: 'accounts',
      recordId: '1',
      order: 'desc',
    });

    expect(history.map(r => r.correlationKey)).toEqual(['third', 'second', 'first']);

    await close();
  });

  it('returns rows recorded under a correlationKey for a record, scoped and oldest first', async () => {
    const { store, close } = createSqlAuditStore({ connectionString: 'sqlite::memory:' });

    await seed(
      store,
      record({ recordId: '1', correlationKey: 'req-1', timestamp: '2026-01-01T00:00:02.000Z' }),
    );
    await seed(
      store,
      record({ recordId: '1', correlationKey: 'req-1', timestamp: '2026-01-01T00:00:01.000Z' }),
    );
    await seed(store, record({ recordId: '1', correlationKey: 'req-2' }));
    await seed(store, record({ recordId: '2', correlationKey: 'req-1' }));

    const history = await store.listByCorrelation({
      collection: 'accounts',
      recordId: '1',
      correlationKey: 'req-1',
    });

    expect(history.map(r => r.timestamp)).toEqual([
      '2026-01-01T00:00:01.000Z',
      '2026-01-01T00:00:02.000Z',
    ]);

    await close();
  });

  it('returns a flat list across multiple correlationKeys for a record, oldest first', async () => {
    const { store, close } = createSqlAuditStore({ connectionString: 'sqlite::memory:' });

    await seed(
      store,
      record({ recordId: '1', correlationKey: 'a', timestamp: '2026-01-01T00:00:03.000Z' }),
    );
    await seed(
      store,
      record({ recordId: '1', correlationKey: 'b', timestamp: '2026-01-01T00:00:01.000Z' }),
    );
    await seed(store, record({ recordId: '1', correlationKey: 'c' }));
    await seed(store, record({ recordId: '2', correlationKey: 'a' }));

    const history = await store.listByCorrelations({
      collection: 'accounts',
      recordId: '1',
      correlationKeys: ['a', 'b'],
    });

    expect(history.map(r => r.correlationKey)).toEqual(['b', 'a']);

    await close();
  });

  it('returns an empty array for an empty key list without querying', async () => {
    const { store, close } = createSqlAuditStore({ connectionString: 'sqlite::memory:' });

    await seed(store, record({ recordId: '1', correlationKey: 'a' }));

    expect(
      await store.listByCorrelations({
        collection: 'accounts',
        recordId: '1',
        correlationKeys: [],
      }),
    ).toEqual([]);

    await close();
  });

  it('keeps only entries that touched a field whose name contains a dot (sqlite)', async () => {
    const { store, close } = createSqlAuditStore({ connectionString: 'sqlite::memory:' });

    await seed(
      store,
      record({
        recordId: '1',
        timestamp: '2026-01-01T00:00:00.000Z',
        previousValues: { 'profile.name': 'a' },
        newValues: { 'profile.name': 'b' },
      }),
    );
    await seed(
      store,
      record({
        recordId: '1',
        timestamp: '2026-01-02T00:00:00.000Z',
        previousValues: { other: 1 },
        newValues: { other: 2 },
      }),
    );

    const history = await store.listByRecord({
      collection: 'accounts',
      recordId: '1',
      fields: ['profile.name'],
    });

    expect(history.map(r => r.timestamp)).toEqual(['2026-01-01T00:00:00.000Z']);

    await close();
  });

  it('search matches a nested value at any depth, case-insensitively', async () => {
    const { store, close } = createSqlAuditStore({ connectionString: 'sqlite::memory:' });

    await seed(
      store,
      record({
        recordId: '1',
        timestamp: '2026-01-01T00:00:00.000Z',
        previousValues: { address: { city: 'Paris' } },
        newValues: { address: { city: 'Lyon' } },
      }),
    );
    await seed(
      store,
      record({
        recordId: '1',
        timestamp: '2026-01-02T00:00:00.000Z',
        previousValues: { name: 'Acme' },
        newValues: { name: 'Globex' },
      }),
    );

    const history = await store.listByRecord({
      collection: 'accounts',
      recordId: '1',
      search: 'lyon',
    });

    expect(history.map(r => r.timestamp)).toEqual(['2026-01-01T00:00:00.000Z']);

    await close();
  });

  it('search matches a nested key at any depth', async () => {
    const { store, close } = createSqlAuditStore({ connectionString: 'sqlite::memory:' });

    await seed(
      store,
      record({
        recordId: '1',
        previousValues: {},
        newValues: { address: { postalCode: '69000' } },
      }),
    );

    const history = await store.listByRecord({
      collection: 'accounts',
      recordId: '1',
      search: 'postalCode',
    });

    expect(history).toHaveLength(1);

    await close();
  });

  it('search matches actionName', async () => {
    const { store, close } = createSqlAuditStore({ connectionString: 'sqlite::memory:' });

    await seed(store, record({ recordId: '1', actionName: 'Send invoice' }));

    await expect(
      store.listByRecord({ collection: 'accounts', recordId: '1', search: 'invoice' }),
    ).resolves.toHaveLength(1);

    await close();
  });

  it('search matches the denormalized user identity columns', async () => {
    const { store, close } = createSqlAuditStore({ connectionString: 'sqlite::memory:' });

    await seed(store, record({ recordId: '1' }));

    await expect(
      store.listByRecord({ collection: 'accounts', recordId: '1', search: 'Doe' }),
    ).resolves.toHaveLength(1);
    await expect(
      store.listByRecord({ collection: 'accounts', recordId: '1', search: 'forest.dev' }),
    ).resolves.toHaveLength(1);
    await expect(
      store.listByRecord({ collection: 'accounts', recordId: '1', search: 'no-such-match' }),
    ).resolves.toEqual([]);

    await close();
  });

  it('search does not match a value that was redacted before it was ever stored', async () => {
    const { store, close } = createSqlAuditStore({ connectionString: 'sqlite::memory:' });

    // Simulates what instrument.ts's redactValues does before a redacted row ever reaches the
    // store: the real value is replaced on both sides, so it is never written anywhere.
    await seed(
      store,
      record({
        recordId: '1',
        previousValues: { ssn: '[redacted]' },
        newValues: { ssn: '[redacted]' },
      }),
    );

    await expect(
      store.listByRecord({ collection: 'accounts', recordId: '1', search: '123-45-6789' }),
    ).resolves.toEqual([]);
    await expect(
      store.listByRecord({ collection: 'accounts', recordId: '1', search: 'redacted' }),
    ).resolves.toHaveLength(1);

    await close();
  });

  it('search composes as AND with other filters', async () => {
    const { store, close } = createSqlAuditStore({ connectionString: 'sqlite::memory:' });

    await seed(store, record({ recordId: '1', userId: 1, newValues: { city: 'Lyon' } }));
    await seed(store, record({ recordId: '1', userId: 2, newValues: { city: 'Lyon' } }));

    const history = await store.listByRecord({
      collection: 'accounts',
      recordId: '1',
      search: 'Lyon',
      userIds: [1],
    });

    expect(history.map(r => r.userId)).toEqual([1]);

    await close();
  });

  it('countByRecord reflects the search filter', async () => {
    const { store, close } = createSqlAuditStore({ connectionString: 'sqlite::memory:' });

    await seed(store, record({ recordId: '1', newValues: { city: 'Lyon' } }));
    await seed(store, record({ recordId: '1', newValues: { city: 'Paris' } }));

    await expect(
      store.countByRecord({ collection: 'accounts', recordId: '1', search: 'Lyon' }),
    ).resolves.toBe(1);

    await close();
  });

  it('inserts a batch and returns one id per record, in the same order', async () => {
    const { store, close } = createSqlAuditStore({ connectionString: 'sqlite::memory:' });

    const ids = await store.insertPendingBatch([
      record({ recordId: '1' }),
      record({ recordId: '2' }),
      record({ recordId: '3' }),
    ]);

    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);

    await close();
  });

  it('confirms a pending row to done with the final operation/recordId/values', async () => {
    const { store, close } = createSqlAuditStore({ connectionString: 'sqlite::memory:' });

    const id = await store.insertPending(record({ recordId: null, newValues: {} }));
    await store.confirm(id, {
      operation: 'create',
      recordId: '1',
      previousValues: {},
      newValues: { status: 'open' },
    });

    const [entry] = await store.listByRecord({ collection: 'accounts', recordId: '1' });
    expect(entry).toMatchObject({
      operation: 'create',
      recordId: '1',
      newValues: { status: 'open' },
    });

    await close();
  });

  it('returns one distinct user per matching row, ignoring pagination', async () => {
    const { store, close } = createSqlAuditStore({ connectionString: 'sqlite::memory:' });

    await seed(store, record({ recordId: '1', userId: 1, userFirstName: 'Jane' }));
    await seed(store, record({ recordId: '1', userId: 1, userFirstName: 'Jane' }));
    await seed(store, record({ recordId: '1', userId: 2, userFirstName: 'John' }));

    const users = await store.listDistinctUsers({ collection: 'accounts', recordId: '1' });

    expect(users.map(user => user.id).sort()).toEqual([1, 2]);

    await close();
  });
});

describe('fieldsChangedCondition', () => {
  it('does not throw on mssql and quotes a dotted field as a literal path segment', () => {
    const sequelize = new Sequelize('mssql://user:pwd@localhost/db', { logging: false });

    const condition = fieldsChangedCondition(sequelize, ['profile.name']);

    expect(condition.val).toContain('JSON_PATH_EXISTS');
    expect(condition.val).toContain('$."profile.name"');
  });

  it('quotes a dotted field as a literal path segment on mysql/mariadb', () => {
    const sequelize = new Sequelize('mysql://user:pwd@localhost/db', { logging: false });

    const condition = fieldsChangedCondition(sequelize, ['profile.name']);

    expect(condition.val).toContain('JSON_CONTAINS_PATH');
    expect(condition.val).toContain('$.\\"profile.name\\"');
  });

  it('matches on the literal top-level key on postgres regardless of dots', () => {
    const sequelize = new Sequelize('postgres://user:pwd@localhost:5432/db', { logging: false });

    const condition = fieldsChangedCondition(sequelize, ['profile.name']);

    expect(condition.val).toContain('jsonb_exists_any');
    expect(condition.val).toContain("'profile.name'");
  });

  it('throws for a dialect it does not support', () => {
    const fakeSequelize = {
      getDialect: () => 'oracle',
      escape: (value: string) => `'${value}'`,
    } as unknown as Sequelize;

    expect(() => fieldsChangedCondition(fakeSequelize, ['name'])).toThrow(
      'Audit-trail "fields" filter is not supported on dialect "oracle"',
    );
  });
});

describe('searchCondition', () => {
  it('casts previous_values/new_values to text on postgres', () => {
    const sequelize = new Sequelize('postgres://user:pwd@localhost:5432/db', { logging: false });

    const condition = searchCondition(sequelize, 'Lyon');

    expect(condition.val).toContain('previous_values::text');
    expect(condition.val).toContain('new_values::text');
    expect(condition.val).toContain("LOWER('%Lyon%')");
  });

  it('casts previous_values/new_values with CAST(... AS CHAR) on mysql/mariadb', () => {
    const sequelize = new Sequelize('mysql://user:pwd@localhost/db', { logging: false });

    const condition = searchCondition(sequelize, 'Lyon');

    expect(condition.val).toContain('CAST(previous_values AS CHAR)');
    expect(condition.val).toContain('CAST(new_values AS CHAR)');
  });

  it('does not cast previous_values/new_values on sqlite or mssql, already stored as text', () => {
    const sqlite = new Sequelize('sqlite::memory:', { logging: false });
    const mssql = new Sequelize('mssql://user:pwd@localhost/db', { logging: false });

    expect(searchCondition(sqlite, 'Lyon').val).toMatch(/LOWER\(previous_values\)/);
    expect(searchCondition(mssql, 'Lyon').val).toMatch(/LOWER\(previous_values\)/);
  });

  it('matches against the identity columns as well as the JSON columns', () => {
    const sequelize = new Sequelize('sqlite::memory:', { logging: false });

    const condition = searchCondition(sequelize, 'Lyon');

    expect(condition.val).toContain('action_name');
    expect(condition.val).toContain('user_first_name');
    expect(condition.val).toContain('user_last_name');
    expect(condition.val).toContain('user_email');
  });

  it('escapes a literal % or _ in the search term so it is matched literally, not as a wildcard', () => {
    const sequelize = new Sequelize('sqlite::memory:', { logging: false });

    const condition = searchCondition(sequelize, '50%_off');

    expect(condition.val).toContain("LOWER('%50~%~_off%')");
    expect(condition.val).toContain("ESCAPE '~'");
  });

  it('escapes a literal ~ in the search term too, since it is now the escape character', () => {
    const sequelize = new Sequelize('sqlite::memory:', { logging: false });

    const condition = searchCondition(sequelize, 'a~b');

    expect(condition.val).toContain("LOWER('%a~~b%')");
  });

  it('never uses a backslash as the escape character, which MySQL/MariaDB parse as a string-literal escape under the default sql_mode', () => {
    const sequelize = new Sequelize('mysql://user:pwd@localhost/db', { logging: false });

    const condition = searchCondition(sequelize, 'Lyon');

    expect(condition.val).not.toContain('\\');
    expect(condition.val).toContain("ESCAPE '~'");
  });
});
