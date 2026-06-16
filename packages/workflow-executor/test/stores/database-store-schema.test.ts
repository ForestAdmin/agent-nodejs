import type { QueryInterface, Sequelize } from 'sequelize';

import { SequelizeStorage, Umzug } from 'umzug';

import DatabaseStore from '../../src/stores/database-store';

// Mock umzug so we can assert how the store wires the migration registry and the
// migration itself, without a real Postgres connection (CI has none for this pkg).
jest.mock('umzug', () => ({
  Umzug: jest.fn().mockImplementation(() => ({ up: jest.fn().mockResolvedValue(undefined) })),
  SequelizeStorage: jest.fn(),
}));

const MockedUmzug = Umzug as unknown as jest.Mock;
const MockedSequelizeStorage = SequelizeStorage as unknown as jest.Mock;

function makeSequelize(dialect: 'postgres' | 'sqlite'): Sequelize {
  return {
    getDialect: () => dialect,
    getQueryInterface: () => ({} as QueryInterface),
    query: jest.fn().mockResolvedValue([[], {}]),
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
});
