import type { Dialect } from 'sequelize';

import os from 'os';
import path from 'path';
import { DataTypes, Sequelize } from 'sequelize';

import { SequelizeDataSource } from '../../../src';
import CONNECTIONS from '../../__tests/connections';

const ROWS_DELETING_QUERY: Record<string, (table: string) => string> = {
  mysql: table => `DELETE FROM ${table}`,
  mssql: table => `DELETE FROM ${table} OUTPUT deleted.id`,
};

function deleteAllRows(dialect: Dialect, table: string): string {
  return (ROWS_DELETING_QUERY[dialect] ?? (t => `DELETE FROM ${t} RETURNING id`))(table);
}

const DELETE_OUTCOME: Partial<Record<Dialect, object>> = {
  postgres: { error: expect.stringContaining('read-only transaction') },
  // MySQL has no RETURNING: Sequelize fails to map the DELETE's result header as rows, after the
  // statement ran.
  mysql: { error: expect.stringContaining('TypeError') },
};

describe('Native queries', () => {
  const sqliteInMemory = {
    name: 'SQLite in memory',
    rollsBackWrites: false,
    open: async () => new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false }),
  };
  const sqliteTemporary = {
    name: 'SQLite temporary',
    rollsBackWrites: false,
    open: async () => new Sequelize({ dialect: 'sqlite', storage: '', logging: false }),
  };
  const sqliteFile = {
    name: 'SQLite file',
    rollsBackWrites: true,
    open: async () =>
      new Sequelize({
        dialect: 'sqlite',
        storage: path.join(os.tmpdir(), 'forest_test_native_query.sqlite'),
        logging: false,
      }),
  };
  const servers = CONNECTIONS.map(connection => ({
    name: connection.name,
    rollsBackWrites: true,
    open: async () => {
      const db = 'forest_test_native_query';
      const server = new Sequelize(connection.uri(), { logging: false });
      await server.getQueryInterface().dropDatabase(db);
      await connection.query.createDatabase(server, db);
      await server.close();

      return new Sequelize(connection.uri(db), { logging: false });
    },
  }));

  const databases = [sqliteInMemory, sqliteTemporary, sqliteFile, ...servers];

  describe.each(databases)('On $name', ({ open, rollsBackWrites }) => {
    let sequelize: Sequelize;
    let dataSource: SequelizeDataSource;
    let table: string;

    beforeAll(async () => {
      sequelize = await open();
      sequelize.define('Label', { title: DataTypes.STRING });
      await sequelize.sync({ force: true });
      table = sequelize.getQueryInterface().quoteIdentifier('Labels');
      dataSource = new SequelizeDataSource(sequelize, jest.fn(), { liveQueryConnections: 'main' });
    }, 60_000);

    beforeEach(async () => {
      await sequelize.models.Label.destroy({ truncate: true });
      await sequelize.models.Label.bulkCreate([{ title: 'a' }, { title: 'b' }]);
    });

    afterAll(async () => {
      await sequelize?.close();
    });

    it('should return the rows a query selects', async () => {
      const rows = await dataSource.executeNativeQuery<{ title: string }>(
        'main',
        `SELECT title FROM ${table} ORDER BY title`,
      );

      expect(rows).toEqual([{ title: 'a' }, { title: 'b' }]);
    });

    it('should roll back what a query writes unless its connection is shared', async () => {
      const dialect = sequelize.getDialect() as Dialect;
      const outcome = await dataSource
        .executeNativeQuery('main', deleteAllRows(dialect, table))
        .then(
          rows => ({ deletedRows: rows.length }),
          (error: Error) => ({ error: `${error.name}: ${error.message}` }),
        );

      expect(outcome).toEqual(DELETE_OUTCOME[dialect] ?? { deletedRows: 2 });
      expect(await sequelize.models.Label.count()).toBe(rollsBackWrites ? 2 : 0);
    });

    it('should keep a write made while a query runs', async () => {
      await Promise.all([
        dataSource.executeNativeQuery('main', `SELECT title FROM ${table}`),
        sequelize.models.Label.create({ title: 'c' }),
      ]);

      expect(await sequelize.models.Label.count()).toBe(3);
    });
  });
});
