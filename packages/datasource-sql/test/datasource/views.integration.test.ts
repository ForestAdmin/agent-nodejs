import type SqlDatasource from '../../src/decorators/sql-datasource';

import {
  ConditionTreeFactory,
  Filter,
  PaginatedFilter,
  Projection,
  UnprocessableError,
} from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import { Sequelize } from 'sequelize';

import { buildSequelizeInstance, createSqlDataSource, introspect } from '../../src';
import { CONNECTION_DETAILS } from '../_helpers/connection-details';
import setupSimpleTable from '../_helpers/setup-simple-table';

describe('datasource with views', () => {
  describe.each(CONNECTION_DETAILS)('on $name', connectionDetails => {
    const db = 'test_datasource_views';
    const caller = factories.caller.build();
    let datasource: SqlDatasource;
    let sequelize;

    beforeAll(async () => {
      await setupSimpleTable(connectionDetails, db);

      const setupSequelize = new Sequelize(connectionDetails.url(db), { logging: false });

      try {
        await setupSequelize.query(`
          CREATE VIEW view_thing AS SELECT * FROM thing
        `);
      } catch (e) {
        console.error('Error', e);
        throw e;
      } finally {
        await setupSequelize.close();
      }

      const introspection = await introspect(connectionDetails.url(db));
      const logger = jest.fn();

      sequelize = await buildSequelizeInstance(connectionDetails.url(db), jest.fn(), introspection);

      datasource = (await createSqlDataSource(connectionDetails.url(db))(
        logger,
        jest.fn(),
      )) as SqlDatasource;
    });

    afterAll(async () => {
      await sequelize?.close();
      await datasource.close();
    });

    describe('queries', () => {
      describe('on default schema', () => {
        it('should allow to list records', async () => {
          await sequelize.models.thing.bulkCreate([{ name: 'foo' }, { name: 'bar' }]);

          const groups = await datasource
            .getCollection('view_thing')
            .list(caller, new PaginatedFilter({}), new Projection('name'));

          expect(groups).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ name: 'foo' }),
              expect.objectContaining({ name: 'bar' }),
            ]),
          );
        });

        it('should not allow to create a record', async () => {
          await expect(
            datasource.getCollection('view_thing').create(caller, [{ name: 'foo' }]),
          ).rejects.toThrow(new UnprocessableError('View is read-only'));
        });

        it('should not allow to update a record', async () => {
          await expect(
            datasource.getCollection('view_thing').update(
              caller,
              new Filter({
                conditionTree: ConditionTreeFactory.MatchAll,
              }),
              { name: 'foo' },
            ),
          ).rejects.toThrow(new UnprocessableError('View is read-only'));
        });

        it('should not allow to delete a record', async () => {
          await expect(
            datasource.getCollection('view_thing').delete(
              caller,
              new Filter({
                conditionTree: ConditionTreeFactory.MatchAll,
              }),
            ),
          ).rejects.toThrow(new UnprocessableError('View is read-only'));
        });
      });
    });

    describe('schema', () => {
      it('should generate a collection for the view, with all fields being read only', () => {
        const { schema } = datasource.getCollection('view_thing');

        expect(schema).toEqual(
          expect.objectContaining({
            countable: true,
            fields: {
              id: expect.objectContaining({
                columnType: 'Number',
                isReadOnly: true,
              }),
              name: expect.objectContaining({
                columnType: 'String',
                isReadOnly: true,
              }),
            },
          }),
        );
      });

      it('should generate a collection for the table, with fields not being read only', () => {
        const { schema } = datasource.getCollection('thing');

        expect(schema).toEqual(
          expect.objectContaining({
            countable: true,
            fields: {
              id: expect.objectContaining({
                columnType: 'Number',
                isReadOnly: true, // Primary key is read only
              }),
              name: expect.objectContaining({
                columnType: 'String',
                isReadOnly: false,
              }),
            },
          }),
        );
      });
    });
  });
});
