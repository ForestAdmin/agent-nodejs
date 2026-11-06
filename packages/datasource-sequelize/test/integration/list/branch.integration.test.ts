import type { Caller, Collection, ConditionTree } from '@forestadmin/datasource-toolkit';

import {
  ConditionTreeBranch,
  ConditionTreeFactory,
  ConditionTreeLeaf,
  PaginatedFilter,
  Projection,
} from '@forestadmin/datasource-toolkit';
import { DataTypes, Sequelize } from 'sequelize';

import { createSequelizeDataSource } from '../../../src/index';
import CONNECTIONS from '../../__tests/connections';

describe('Condition tree branches', () => {
  const caller = {} as Caller;
  const sqlite = {
    name: 'SQLite',
    open: async () => new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false }),
  };
  const servers = CONNECTIONS.map(connection => ({
    name: connection.name,
    open: async () => {
      const db = 'forest_test_branches';
      const server = new Sequelize(connection.uri(), { logging: false });
      await server.getQueryInterface().dropDatabase(db);
      await connection.query.createDatabase(server, db);
      await server.close();

      return new Sequelize(connection.uri(db), { logging: false });
    },
  }));

  describe.each([sqlite, ...servers])('On $name', ({ open }) => {
    let sequelize: Sequelize;
    let collection: Collection;

    const listNames = async (conditionTree: ConditionTree) => {
      const records = await collection.list(
        caller,
        new PaginatedFilter({ conditionTree }),
        new Projection('name'),
      );

      return records.map(record => record.name).sort();
    };

    beforeAll(async () => {
      sequelize = await open();
      const user = sequelize.define('User', {
        name: { type: DataTypes.STRING, allowNull: true },
        amount: { type: DataTypes.INTEGER, allowNull: true },
      });
      const company = sequelize.define('Company', {
        name: { type: DataTypes.STRING, allowNull: true },
      });
      user.belongsTo(company);
      await sequelize.sync({ force: true });

      await company.bulkCreate([
        { id: 1, name: 'Forest' },
        { id: 2, name: 'Evil Corp' },
      ]);
      await user.bulkCreate([
        { name: 'John', amount: 1, CompanyId: 1 },
        { name: 'Jane', amount: 10, CompanyId: 1 },
        { name: 'Smith', amount: 11, CompanyId: 2 },
        { name: 'Orphan', amount: 42, CompanyId: null },
      ]);

      collection = (await createSequelizeDataSource(sequelize)(jest.fn(), jest.fn())).getCollection(
        'User',
      );
    }, 60_000);

    afterAll(async () => {
      await sequelize?.close();
    });

    it('keeps a record without relation when the relation is filtered in another Or branch', async () => {
      const names = await listNames(
        new ConditionTreeBranch('Or', [
          new ConditionTreeBranch('And', [
            new ConditionTreeLeaf('Company:name', 'Equal', 'Forest'),
            new ConditionTreeLeaf('amount', 'GreaterThan', 5),
          ]),
          new ConditionTreeLeaf('amount', 'Equal', 42),
        ]),
      );

      expect(names).toEqual(['Jane', 'Orphan']);
    });

    it('applies an Or group nested in an And', async () => {
      const names = await listNames(
        new ConditionTreeBranch('And', [
          new ConditionTreeLeaf('amount', 'GreaterThan', 5),
          new ConditionTreeBranch('Or', [
            new ConditionTreeLeaf('Company:name', 'Equal', 'Evil Corp'),
            new ConditionTreeLeaf('name', 'Equal', 'Orphan'),
          ]),
        ]),
      );

      expect(names).toEqual(['Orphan', 'Smith']);
    });

    it('returns nothing for MatchNone', async () => {
      expect(await listNames(ConditionTreeFactory.MatchNone)).toEqual([]);
    });

    it('returns nothing for MatchNone intersected with another condition', async () => {
      const names = await listNames(
        new ConditionTreeBranch('And', [
          new ConditionTreeLeaf('amount', 'GreaterThan', 0),
          ConditionTreeFactory.MatchNone,
        ]),
      );

      expect(names).toEqual([]);
    });

    it('returns every record for an empty And', async () => {
      expect(await listNames(new ConditionTreeBranch('And', []))).toEqual([
        'Jane',
        'John',
        'Orphan',
        'Smith',
      ]);
    });
  });
});
