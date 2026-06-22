import { Sequelize } from 'sequelize';

import DatabaseStore from '../../src/stores/database-store';

// Real-Postgres integration test. Skipped unless WORKFLOW_EXECUTOR_TEST_DATABASE_URL points at a
// reachable Postgres (CI has none), e.g.
//   WORKFLOW_EXECUTOR_TEST_DATABASE_URL=postgres://forest:secret@localhost:5435/forest
const PG_URL = process.env.WORKFLOW_EXECUTOR_TEST_DATABASE_URL;
const describePg = PG_URL ? describe : describe.skip;

// Keep in sync with MIGRATION_ADVISORY_LOCK_KEY in database-store.ts.
const LOCK_KEY = 6_438_071_259_157;
const SCHEMA = 'forest';

interface RawConnection {
  query(sql: string, values?: unknown[]): Promise<unknown>;
}

const makeSequelize = () => new Sequelize(PG_URL as string, { logging: false });

const count = async (sequelize: Sequelize, sql: string): Promise<number> => {
  const [rows] = await sequelize.query(sql);

  return (rows as Array<{ n: number }>)[0].n;
};

describePg('DatabaseStore — Postgres advisory-lock integration', () => {
  let admin: Sequelize;

  beforeEach(async () => {
    admin = makeSequelize();
    await admin.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
  });

  afterEach(async () => {
    await admin.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await admin.close();
  });

  it('lets N instances init() concurrently on an empty schema without crashing, migrating once', async () => {
    const stores = Array.from(
      { length: 5 },
      () => new DatabaseStore({ sequelize: makeSequelize() }),
    );

    try {
      const results = await Promise.allSettled(stores.map(store => store.init()));

      expect(results.filter(result => result.status === 'rejected')).toEqual([]);
      expect(
        await count(
          admin,
          `SELECT count(*)::int AS n FROM information_schema.tables
           WHERE table_schema = '${SCHEMA}' AND table_name = 'workflow_step_executions'`,
        ),
      ).toBe(1);
      expect(await count(admin, `SELECT count(*)::int AS n FROM "${SCHEMA}"."SequelizeMeta"`)).toBe(
        1,
      );
    } finally {
      await Promise.all(stores.map(store => store.close()));
    }
  });

  it('holds no advisory lock once init() returns (transaction-scoped lock auto-released at commit)', async () => {
    const store = new DatabaseStore({ sequelize: makeSequelize() });

    try {
      await store.init();
      expect(
        await count(
          admin,
          `SELECT count(*)::int AS n FROM pg_locks WHERE locktype = 'advisory' AND granted`,
        ),
      ).toBe(0);
    } finally {
      await store.close();
    }
  });

  it('blocks init() while the advisory lock is held by another session, then proceeds on release', async () => {
    const holder = makeSequelize();
    const holderConnection = (await holder.connectionManager.getConnection({
      type: 'write',
    })) as RawConnection;
    await holderConnection.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);

    const store = new DatabaseStore({ sequelize: makeSequelize() });
    let initDone = false;
    const initPromise = store.init().then(() => {
      initDone = true;
    });

    try {
      // While the lock is held, init() must be parked before any migration work — no schema yet.
      await new Promise(resolve => {
        setTimeout(resolve, 750);
      });
      expect(initDone).toBe(false);
      expect(
        await count(
          admin,
          `SELECT count(*)::int AS n FROM information_schema.schemata WHERE schema_name = '${SCHEMA}'`,
        ),
      ).toBe(0);

      await holderConnection.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]);
      holder.connectionManager.releaseConnection(holderConnection);

      await initPromise;
      expect(initDone).toBe(true);
      expect(
        await count(
          admin,
          `SELECT count(*)::int AS n FROM information_schema.schemata WHERE schema_name = '${SCHEMA}'`,
        ),
      ).toBe(1);
    } finally {
      await store.close();
      await holder.close();
    }
  });

  // Fix 1: the lock transaction sits idle while the migration runs on other connections. A tight
  // idle_in_transaction_session_timeout would kill it (dropping the lock mid-migration) — the
  // SET LOCAL guard must prevent that. Here the session sets a 200ms timeout, the guard disables
  // it, and the transaction stays idle for 500ms while still holding the lock.
  it('keeps the advisory lock through an idle window a tight idle-in-transaction timeout would kill', async () => {
    const sleep = (ms: number) =>
      new Promise<void>(resolve => {
        setTimeout(resolve, ms);
      });
    const guardDb = makeSequelize();
    const conn = (await guardDb.connectionManager.getConnection({
      type: 'write',
    })) as RawConnection;

    try {
      await conn.query('SET idle_in_transaction_session_timeout = 200');
      await conn.query('BEGIN');
      await conn.query('SET LOCAL idle_in_transaction_session_timeout = 0');
      await conn.query('SELECT pg_advisory_xact_lock($1)', [LOCK_KEY]);

      await sleep(500);

      // An observer still sees the lock held, and the guarded session is alive enough to commit.
      expect(
        await count(
          admin,
          `SELECT count(*)::int AS n FROM pg_locks WHERE locktype = 'advisory' AND granted`,
        ),
      ).toBe(1);
      const alive = (await conn.query('SELECT 1 AS ok')) as { rows: Array<{ ok: number }> };
      expect(alive.rows[0].ok).toBe(1);
      await conn.query('COMMIT');
    } finally {
      guardDb.connectionManager.releaseConnection(conn);
      await guardDb.close();
    }
  });
});
