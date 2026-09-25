import type { QueryInterface, Sequelize } from 'sequelize';

import { DataTypes } from 'sequelize';
import { Umzug } from 'umzug';

import DatabaseMcpOAuthCredentialsStore from '../../src/stores/database-mcp-oauth-credentials-store';

// Mock umzug to reach the migration definitions without a real Postgres connection.
jest.mock('umzug', () => ({
  Umzug: jest.fn().mockImplementation(() => ({ up: jest.fn().mockResolvedValue(undefined) })),
  SequelizeStorage: jest.fn(),
}));

const MockedUmzug = Umzug as unknown as jest.Mock;

type Migration = { name: string; up: (params: { context: QueryInterface }) => Promise<void> };

function makeSequelize(): Sequelize {
  return {
    getDialect: () => 'postgres',
    getQueryInterface: () => ({} as QueryInterface),
    query: jest.fn().mockResolvedValue([[], {}]),
    transaction: jest.fn((cb: (t: unknown) => Promise<unknown>) => cb({})),
    connectionManager: { pool: { maxSize: 5 } },
  } as unknown as Sequelize;
}

async function migration003(): Promise<Migration> {
  await new DatabaseMcpOAuthCredentialsStore({ sequelize: makeSequelize() }).init();
  const { migrations } = MockedUmzug.mock.calls[0][0] as { migrations: Migration[] };

  return migrations.find(({ name }) => name === '003_add_mcp_oauth_access_token') as Migration;
}

function makeContext(existingColumns: Record<string, unknown>) {
  const transaction = { id: 'txn' };

  return {
    transaction,
    context: {
      sequelize: {
        getDialect: () => 'postgres',
        transaction: jest.fn((cb: (t: unknown) => Promise<unknown>) => cb(transaction)),
      },
      describeTable: jest.fn().mockResolvedValue(existingColumns),
      changeColumn: jest.fn().mockResolvedValue(undefined),
      addColumn: jest.fn().mockResolvedValue(undefined),
    },
  };
}

describe('DatabaseMcpOAuthCredentialsStore — migration 003 on Postgres', () => {
  beforeEach(() => jest.clearAllMocks());

  it('makes refresh_token_enc nullable and adds a nullable access_token_enc, in one transaction', async () => {
    const { up } = await migration003();
    const { context, transaction } = makeContext({ refresh_token_enc: {} });
    const table = { tableName: 'ai_mcp_oauth_credentials', schema: 'forest' };

    await up({ context: context as unknown as QueryInterface });

    expect(context.changeColumn).toHaveBeenCalledWith(
      table,
      'refresh_token_enc',
      { type: DataTypes.BLOB, allowNull: true },
      { transaction },
    );
    expect(context.addColumn).toHaveBeenCalledWith(
      table,
      'access_token_enc',
      { type: DataTypes.BLOB, allowNull: true },
      { transaction },
    );
  });

  it('changes nothing when access_token_enc already exists', async () => {
    const { up } = await migration003();
    const { context } = makeContext({ refresh_token_enc: {}, access_token_enc: {} });

    await up({ context: context as unknown as QueryInterface });

    expect(context.changeColumn).not.toHaveBeenCalled();
    expect(context.addColumn).not.toHaveBeenCalled();
  });
});
