import type { Dialect } from 'sequelize';

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

describe('Native queries', () => {
  const sqlite = {
    name: 'SQLite',
    open: async () => new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false }),
  };
  const servers = CONNECTIONS.map(connection => ({
    name: connection.name,
    open: async () => {
      const db = 'forest_test_native_query';
      const server = new Sequelize(connection.uri(), { logging: false });
      await server.getQueryInterface().dropDatabase(db);
      await connection.query.createDatabase(server, db);
      await server.close();

      return new Sequelize(connection.uri(db), { logging: false });
    },
  }));

  describe.each([sqlite, ...servers])('On $name', ({ open }) => {
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

    it('should leave the data untouched when a query writes', async () => {
      await dataSource
        .executeNativeQuery('main', deleteAllRows(sequelize.getDialect() as Dialect, table))
        .catch(() => undefined);

      expect(await sequelize.models.Label.count()).toBe(2);
    });
  });
});
