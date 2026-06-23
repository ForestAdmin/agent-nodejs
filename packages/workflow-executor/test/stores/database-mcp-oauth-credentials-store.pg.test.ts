import { Sequelize } from 'sequelize';

import DatabaseMcpOAuthCredentialsStore from '../../src/stores/database-mcp-oauth-credentials-store';

// Real-Postgres integration test. Skipped unless WORKFLOW_EXECUTOR_TEST_DATABASE_URL points at a
// reachable Postgres (CI has none), e.g.
//   WORKFLOW_EXECUTOR_TEST_DATABASE_URL=postgres://forest:secret@localhost:5435/forest
// Guards the shared-database safety the SQLite suite can't exercise: the table + its umzug registry
// live under the `forest` schema (never `public`), and the advisory lock serializes concurrent boots.
const PG_URL = process.env.WORKFLOW_EXECUTOR_TEST_DATABASE_URL;
const describePg = PG_URL ? describe : describe.skip;

const SCHEMA = 'forest';
const TABLE = 'ai_mcp_oauth_credentials';

const makeSequelize = () => new Sequelize(PG_URL as string, { logging: false });

const count = async (sequelize: Sequelize, sql: string): Promise<number> => {
  const [rows] = await sequelize.query(sql);

  return (rows as Array<{ n: number }>)[0].n;
};

describePg('DatabaseMcpOAuthCredentialsStore — Postgres shared-schema integration', () => {
  let admin: Sequelize;

  beforeEach(async () => {
    admin = makeSequelize();
    await admin.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
  });

  afterEach(async () => {
    await admin.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await admin.close();
  });

  it('creates the table and its migration registry under the forest schema, never public', async () => {
    const store = new DatabaseMcpOAuthCredentialsStore({ sequelize: makeSequelize() });

    try {
      await store.init();

      expect(
        await count(
          admin,
          `SELECT count(*)::int AS n FROM information_schema.tables
           WHERE table_schema = '${SCHEMA}' AND table_name = '${TABLE}'`,
        ),
      ).toBe(1);
      // Never leaks into public — that is the shared-database safety guarantee.
      expect(
        await count(
          admin,
          `SELECT count(*)::int AS n FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name = '${TABLE}'`,
        ),
      ).toBe(0);
      // The umzug registry lives in forest too, with 002 recorded.
      expect(await count(admin, `SELECT count(*)::int AS n FROM "${SCHEMA}"."SequelizeMeta"`)).toBe(
        1,
      );
    } finally {
      await store.close();
    }
  });

  it('round-trips an encrypted credential with the BYTEA blob preserved byte-for-byte', async () => {
    const store = new DatabaseMcpOAuthCredentialsStore({ sequelize: makeSequelize() });

    try {
      await store.init();
      const refreshTokenEnc = Buffer.from([0x00, 0x01, 0xfe, 0xff, 0x10]);

      await store.upsert({
        userId: 7,
        mcpServerId: 'mcp-server-1',
        refreshTokenEnc,
        clientId: null,
        clientSecretEnc: null,
        clientSecretExpiresAt: null,
        tokenEndpoint: 'https://auth.example.com/token',
        tokenEndpointAuthMethod: null,
        scopes: null,
      });

      const row = await store.get(7, 'mcp-server-1');
      expect(row?.refreshTokenEnc.toString('hex')).toBe(refreshTokenEnc.toString('hex'));
    } finally {
      await store.close();
    }
  });

  it('lets N instances init() concurrently on an empty schema without crashing, migrating once', async () => {
    const stores = Array.from(
      { length: 5 },
      () => new DatabaseMcpOAuthCredentialsStore({ sequelize: makeSequelize() }),
    );

    try {
      const results = await Promise.allSettled(stores.map(store => store.init()));

      expect(results.filter(result => result.status === 'rejected')).toEqual([]);
      expect(
        await count(
          admin,
          `SELECT count(*)::int AS n FROM information_schema.tables
           WHERE table_schema = '${SCHEMA}' AND table_name = '${TABLE}'`,
        ),
      ).toBe(1);
    } finally {
      await Promise.all(stores.map(store => store.close()));
    }
  });
});
