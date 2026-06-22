import type { QueryInterface, Sequelize } from 'sequelize';

import { SequelizeStorage, Umzug } from 'umzug';

import DatabaseStore from '../../src/stores/database-store';

// Mock umzug to assert the schema wiring without a real Postgres connection.
jest.mock('umzug', () => ({
  Umzug: jest.fn().mockImplementation(() => ({ up: jest.fn().mockResolvedValue(undefined) })),
  SequelizeStorage: jest.fn(),
}));

const MockedUmzug = Umzug as unknown as jest.Mock;
const MockedSequelizeStorage = SequelizeStorage as unknown as jest.Mock;

// Models the DB-global advisory lock so two stores contend in-process.
function createMutex() {
  let locked = false;
  const waiters: Array<() => void> = [];

  return {
    acquire(): Promise<void> {
      if (!locked) {
        locked = true;

        return Promise.resolve();
      }

      return new Promise<void>(resolve => {
        waiters.push(resolve);
      });
    },
    release(): void {
      const next = waiters.shift();
      if (next) next();
      else locked = false;
    },
  };
}

function makeSequelize(dialect: 'postgres' | 'sqlite'): Sequelize {
  const connection = { query: jest.fn().mockResolvedValue(undefined) };

  return {
    getDialect: () => dialect,
    getQueryInterface: () => ({} as QueryInterface),
    query: jest.fn().mockResolvedValue([[], {}]),
    connectionManager: {
      getConnection: jest.fn().mockResolvedValue(connection),
      releaseConnection: jest.fn(),
    },
  } as unknown as Sequelize;
}

describe('DatabaseStore — schema namespacing', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('on Postgres', () => {
    it('creates the "forest" schema before running migrations', async () => {
      const sequelize = makeSequelize('postgres');

      await new DatabaseStore({ sequelize }).init();

      expect(sequelize.query).toHaveBeenCalledWith('CREATE SCHEMA IF NOT EXISTS "forest"');
    });

    it('uses the configured schema over the default', async () => {
      const sequelize = makeSequelize('postgres');

      await new DatabaseStore({ sequelize, schema: 'custom' }).init();

      expect(sequelize.query).toHaveBeenCalledWith('CREATE SCHEMA IF NOT EXISTS "custom"');
      expect(MockedSequelizeStorage).toHaveBeenCalledWith(
        expect.objectContaining({ schema: 'custom' }),
      );
    });

    it('points the umzug migration registry (SequelizeMeta) at the "forest" schema', async () => {
      const sequelize = makeSequelize('postgres');

      await new DatabaseStore({ sequelize }).init();

      expect(MockedSequelizeStorage).toHaveBeenCalledWith(
        expect.objectContaining({ sequelize, schema: 'forest' }),
      );
    });

    it('creates the table and indexes inside the "forest" schema', async () => {
      const sequelize = makeSequelize('postgres');

      await new DatabaseStore({ sequelize }).init();

      const { migrations } = MockedUmzug.mock.calls[0][0];
      const createTable = jest.fn().mockResolvedValue(undefined);
      const addIndex = jest.fn().mockResolvedValue(undefined);
      await migrations[0].up({ context: { createTable, addIndex } });

      expect(createTable).toHaveBeenCalledWith(
        { tableName: 'workflow_step_executions', schema: 'forest' },
        expect.any(Object),
      );
      expect(addIndex).toHaveBeenCalledWith(
        { tableName: 'workflow_step_executions', schema: 'forest' },
        ['run_id'],
        { name: 'idx_run_id' },
      );
    });

    it('drops the table from the "forest" schema on rollback', async () => {
      const sequelize = makeSequelize('postgres');

      await new DatabaseStore({ sequelize }).init();

      const { migrations } = MockedUmzug.mock.calls[0][0];
      const dropTable = jest.fn().mockResolvedValue(undefined);
      await migrations[0].down({ context: { dropTable } });

      expect(dropTable).toHaveBeenCalledWith({
        tableName: 'workflow_step_executions',
        schema: 'forest',
      });
    });

    it('schema-qualifies raw reads', async () => {
      const sequelize = makeSequelize('postgres');

      await new DatabaseStore({ sequelize }).getStepExecutions('run-1');

      expect(sequelize.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM "forest"."workflow_step_executions"'),
        expect.anything(),
      );
    });
  });

  describe('on SQLite (no schema support)', () => {
    it('neither creates a schema nor namespaces the registry', async () => {
      const sequelize = makeSequelize('sqlite');

      await new DatabaseStore({ sequelize }).init();

      expect(sequelize.query).not.toHaveBeenCalledWith(expect.stringContaining('CREATE SCHEMA'));
      expect(MockedSequelizeStorage).toHaveBeenCalledWith(
        expect.not.objectContaining({ schema: expect.anything() }),
      );
    });
  });

  describe('migration advisory lock', () => {
    function setup(dialect: 'postgres' | 'sqlite', migrate?: () => Promise<void>) {
      const calls: string[] = [];
      const connection = {
        query: jest.fn((sql: string) => {
          calls.push(sql.includes('unlock') ? 'unlock' : 'lock');

          return Promise.resolve(undefined);
        }),
      };
      const getConnection = jest.fn().mockResolvedValue(connection);
      const releaseConnection = jest.fn(() => calls.push('release'));

      MockedUmzug.mockImplementationOnce(() => ({
        up: jest.fn(
          migrate ??
            (() => {
              calls.push('migrate');

              return Promise.resolve(undefined);
            }),
        ),
      }));

      const sequelize = {
        getDialect: () => dialect,
        getQueryInterface: () => ({} as QueryInterface),
        query: jest.fn().mockResolvedValue([[], {}]),
        connectionManager: { getConnection, releaseConnection },
      } as unknown as Sequelize;

      return { sequelize, calls, connection, getConnection, releaseConnection };
    }

    it('locks, then migrates, then unlocks and releases — in that order — on Postgres', async () => {
      const { sequelize, calls } = setup('postgres');

      await new DatabaseStore({ sequelize }).init();

      expect(calls).toEqual(['lock', 'migrate', 'unlock', 'release']);
    });

    it('acquires the advisory lock on a dedicated write connection', async () => {
      const { sequelize, connection, getConnection } = setup('postgres');

      await new DatabaseStore({ sequelize }).init();

      expect(getConnection).toHaveBeenCalledWith({ type: 'write' });
      expect(connection.query).toHaveBeenCalledWith('SELECT pg_advisory_lock($1)', [
        6_438_071_259_157,
      ]);
      expect(connection.query).toHaveBeenCalledWith('SELECT pg_advisory_unlock($1)', [
        6_438_071_259_157,
      ]);
    });

    it('releases the lock and the connection even when migration fails', async () => {
      const { sequelize, calls, releaseConnection } = setup('postgres', () =>
        Promise.reject(new Error('migration boom')),
      );

      await expect(new DatabaseStore({ sequelize }).init()).rejects.toThrow('migration boom');

      expect(calls).toEqual(['lock', 'unlock', 'release']);
      expect(releaseConnection).toHaveBeenCalledTimes(1);
    });

    it('does not acquire a connection or lock on SQLite', async () => {
      const { sequelize, getConnection } = setup('sqlite');

      await new DatabaseStore({ sequelize }).init();

      expect(getConnection).not.toHaveBeenCalled();
    });

    // up() yields before recording itself — the window an unprotected second runner would
    // exploit to apply the migration twice.
    it('serializes concurrent init() so a non-idempotent migration applies exactly once', async () => {
      const mutex = createMutex();
      let concurrentMigrations = 0;
      let maxConcurrentMigrations = 0;
      let applied = false;
      let appliedCount = 0;

      const up = async () => {
        concurrentMigrations += 1;
        maxConcurrentMigrations = Math.max(maxConcurrentMigrations, concurrentMigrations);
        await Promise.resolve();

        if (!applied) {
          applied = true;
          appliedCount += 1;
        }

        concurrentMigrations -= 1;
      };

      MockedUmzug.mockImplementation(() => ({ up: jest.fn(up) }));

      const makePostgres = () =>
        ({
          getDialect: () => 'postgres',
          getQueryInterface: () => ({} as QueryInterface),
          query: jest.fn().mockResolvedValue([[], {}]),
          connectionManager: {
            getConnection: jest.fn().mockResolvedValue({
              query: (sql: string) => {
                if (sql.includes('pg_advisory_unlock')) mutex.release();
                else if (sql.includes('pg_advisory_lock')) return mutex.acquire();

                return Promise.resolve(undefined);
              },
            }),
            releaseConnection: jest.fn(),
          },
        } as unknown as Sequelize);

      await Promise.all([
        new DatabaseStore({ sequelize: makePostgres() }).init(),
        new DatabaseStore({ sequelize: makePostgres() }).init(),
      ]);

      expect(maxConcurrentMigrations).toBe(1);
      expect(appliedCount).toBe(1);
    });
  });
});
