import { Aggregation, Caller, Filter } from '@forestadmin/datasource-toolkit';
import { DataTypes, Sequelize } from 'sequelize';

import SequelizeCollection from '../../../src/collection';
import { createSequelizeDataSource } from '../../../src/index';
import CONNECTIONS from '../../__tests/connections';

describe('Count', () => {
  describe.each([false, true])('Count with minifyAliases = %p', minifyAliases => {
    describe.each(CONNECTIONS)('On $name', connection => {
      let sequelize: Sequelize;
      const DB = 'forest_test_count';
      const caller: Caller = {} as Caller;

      beforeAll(async () => {
        try {
          const dbSequelize = new Sequelize(connection.uri(), {
            logging: false,
          });
          await dbSequelize.getQueryInterface().dropDatabase(DB);
          await connection.query.createDatabase(dbSequelize, DB);
          await dbSequelize.close();

          sequelize = new Sequelize(connection.uri(DB), { logging: false, minifyAliases });
        } catch (e) {
          console.error(e);
          throw e;
        }
      });

      afterAll(async () => {
        await sequelize.close();
      });

      describe('Standard case', () => {
        let collection: SequelizeCollection;

        beforeAll(async () => {
          sequelize.define('User', {
            name: {
              type: DataTypes.TEXT,
              allowNull: true,
            },
          });

          await sequelize.sync({ force: true });

          await sequelize.models.User.bulkCreate([
            { name: 'John Doe', company_id: 1 },
            { name: 'Jane Doe', company_id: 1 },
            { name: 'john Smith', company_id: 2 },
            { name: null },
          ]);

          const datasource = await createSequelizeDataSource(sequelize)(undefined as any);
          collection = datasource.getCollection('User') as SequelizeCollection;
        }, 30_000);

        it('should return the correct count of lines', async () => {
          const result = await collection.aggregate(
            caller,
            new Filter({}),
            new Aggregation({ operation: 'Count' }),
          );

          expect(result[0].value).toEqual(4);
        });
      });
    });
  });
});
