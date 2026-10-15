import type { Caller, Collection, Operator } from '@forestadmin/datasource-toolkit';

import {
  ConditionTreeLeaf,
  Filter,
  PaginatedFilter,
  Projection,
} from '@forestadmin/datasource-toolkit';
import { DataTypes, Sequelize } from 'sequelize';

import { createSequelizeDataSource } from '../../../src/index';
import CONNECTIONS from '../../__tests/connections';

const TITLES = [
  'a_b',
  'axb',
  '50%',
  '500',
  'a(b',
  'a.b',
  'acb',
  'a!b',
  'a[b]',
  'a*b',
  'a?b',
  'A_B',
];

const CASES: [Operator, string, string[]][] = [
  ['Contains', 'a_b', ['a_b']],
  ['IContains', 'a_b', ['a_b', 'A_B']],
  ['Contains', '50%', ['50%']],
  ['Contains', 'a!b', ['a!b']],
  ['Contains', 'a[b]', ['a[b]']],
  ['Contains', 'a*b', ['a*b']],
  ['Contains', 'a?b', ['a?b']],
  ['StartsWith', 'a_', ['a_b']],
  ['IStartsWith', 'a_', ['a_b', 'A_B']],
  ['EndsWith', '%', ['50%']],
  ['IEndsWith', '_B', ['a_b', 'A_B']],
  ['NotContains', 'a_b', TITLES.filter(title => title !== 'a_b')],
  ['NotIContains', 'a_b', TITLES.filter(title => !['a_b', 'A_B'].includes(title))],
  ['NotContains', '%', TITLES.filter(title => title !== '50%')],
];

describe('Literal search values', () => {
  const caller = {} as Caller;
  const sqlite = {
    name: 'SQLite',
    open: async () => new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false }),
  };
  const servers = CONNECTIONS.map(connection => ({
    name: connection.name,
    open: async () => {
      const db = 'forest_test_literal_search';
      const server = new Sequelize(connection.uri(), { logging: false });
      await server.getQueryInterface().dropDatabase(db);
      await connection.query.createDatabase(server, db);
      await server.close();

      return new Sequelize(connection.uri(db), { logging: false });
    },
  }));

  describe.each([sqlite, ...servers])('On $name', ({ open }) => {
    let sequelize: Sequelize;
    let list: (operator: Operator, value: string) => Promise<string[]>;
    let collection: Collection;

    beforeAll(async () => {
      sequelize = await open();
      sequelize.define('Label', { title: { type: DataTypes.STRING, allowNull: true } });
      await sequelize.sync({ force: true });
      await sequelize.models.Label.bulkCreate(TITLES.map(title => ({ title })));

      collection = (await createSequelizeDataSource(sequelize)(jest.fn(), jest.fn())).getCollection(
        'Label',
      );

      list = async (operator, value) => {
        const records = await collection.list(
          caller,
          new PaginatedFilter({ conditionTree: new ConditionTreeLeaf('title', operator, value) }),
          new Projection('title'),
        );

        return records.map(record => record.title as string).sort();
      };
    }, 60_000);

    afterAll(async () => {
      await sequelize?.close();
    });

    it.each(CASES)('should match %s %j literally', async (operator, value, expected) => {
      expect(await list(operator, value)).toEqual([...expected].sort());
    });

    it('should keep the wildcards of a Like pattern', async () => {
      expect(await list('Like', 'a_b')).toEqual([
        'a!b',
        'a(b',
        'a*b',
        'a.b',
        'a?b',
        'a_b',
        'acb',
        'axb',
      ]);
    });

    it.each([
      ['Contains', 'a_b', ['a_b']],
      ['IContains', 'a_b', ['a_b', 'A_B']],
    ] as const)(
      'should update the records matching %s %j literally',
      async (operator, value, titles) => {
        const filter = new Filter({
          conditionTree: new ConditionTreeLeaf('title', operator, value),
        });

        await collection.update(caller, filter, { title: `${operator} updated` });

        expect(await list('Equal', `${operator} updated`)).toHaveLength(titles.length);
        await collection.update(
          caller,
          new Filter({
            conditionTree: new ConditionTreeLeaf('title', 'Equal', `${operator} updated`),
          }),
          { title: titles[0] },
        );
      },
    );

    it('should delete the records not matching a value literally', async () => {
      await collection.delete(
        caller,
        new Filter({ conditionTree: new ConditionTreeLeaf('title', 'NotIContains', 'a_b') }),
      );

      expect(await list('Present', '')).toEqual(['a_b', 'a_b']);
    });
  });
});
