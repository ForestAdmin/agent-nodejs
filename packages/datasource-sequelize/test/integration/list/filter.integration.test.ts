import type SequelizeCollection from '../../../src/collection';
import type { Caller } from '@forestadmin/datasource-toolkit';

import { ConditionTreeLeaf, PaginatedFilter, Projection } from '@forestadmin/datasource-toolkit';
import { DataTypes, Sequelize } from 'sequelize';

import { createSequelizeDataSource } from '../../../src/index';
import CONNECTIONS from '../../__tests/connections';

describe('Filter tests on collection', () => {
  describe.each(CONNECTIONS)('On $name', connection => {
    let sequelize: Sequelize;
    const DB = 'forest_test_search';
    const caller: Caller = {} as Caller;

    beforeAll(async () => {
      try {
        const dbSequelize = new Sequelize(connection.uri(), { logging: false });
        await dbSequelize.getQueryInterface().dropDatabase(DB);
        await connection.query.createDatabase(dbSequelize, DB);
        await dbSequelize.close();

        sequelize = new Sequelize(connection.uri(DB), { logging: false });
      } catch (e) {
        console.error(e);
        throw e;
      }
    });

    afterAll(async () => {
      await sequelize.close();
    });

    describe('On text fields', () => {
      let collection: SequelizeCollection;

      beforeAll(async () => {
        const user = sequelize.define('User', {
          name: {
            type: DataTypes.TEXT,
            allowNull: true,
          },
          amount: {
            type: DataTypes.INTEGER,
            allowNull: true,
          },
        });

        const company = sequelize.define('Company', {
          name: {
            type: DataTypes.TEXT,
            allowNull: true,
          },
        });

        user.belongsTo(company);

        await sequelize.sync({ force: true });

        await sequelize.models.Company.bulkCreate([
          { name: 'Forest', id: 1 },
          { name: 'Evil Corp', id: 2 },
        ]);

        await sequelize.models.User.bulkCreate([
          { name: 'John Doe', amount: 1, company_id: 1 },
          { name: 'Jane Doe', amount: 10, company_id: 1 },
          { name: 'john Smith', amount: 11, company_id: 2 },
          { name: null },
        ]);

        const datasource = await createSequelizeDataSource(sequelize)(jest.fn(), jest.fn());
        collection = datasource.getCollection('User') as SequelizeCollection;
      }, 30_000);

      describe('Like', () => {
        it('should return lines containing the searched text', async () => {
          const result = await collection.list(
            caller,
            new PaginatedFilter({
              conditionTree: new ConditionTreeLeaf('name', 'Like', 'John%'),
            }),
            new Projection('name', 'Company:id'),
          );

          expect(result).toEqual(
            expect.arrayContaining([expect.objectContaining({ name: 'John Doe' })]),
          );
        });
      });

      describe('ILike', () => {
        it('should return lines containing the searched text', async () => {
          const result = await collection.list(
            caller,
            new PaginatedFilter({
              conditionTree: new ConditionTreeLeaf('name', 'ILike', 'John%'),
            }),
            new Projection('name', 'Company:id'),
          );

          expect(result).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ name: 'John Doe' }),
              expect.objectContaining({ name: 'john Smith' }),
            ]),
          );
        });
      });

      describe('NotContains', () => {
        it('should return lines not containing the searched text', async () => {
          const result = await collection.list(
            caller,
            new PaginatedFilter({
              conditionTree: new ConditionTreeLeaf('name', 'NotContains', 'John'),
            }),
            new Projection('name', 'Company:id'),
          );

          expect(result).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ name: 'Jane Doe' }),
              expect.objectContaining({ name: 'john Smith' }),
              expect.objectContaining({ name: null }),
            ]),
          );
        });
      });

      describe('NotIContains', () => {
        it('should return lines not containing the searched text', async () => {
          const result = await collection.list(
            caller,
            new PaginatedFilter({
              conditionTree: new ConditionTreeLeaf('name', 'NotIContains', 'John'),
            }),
            new Projection('name', 'Company:id'),
          );

          expect(result).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ name: 'Jane Doe' }),
              expect.objectContaining({ name: null }),
            ]),
          );
        });
      });

      describe('Present', () => {
        it('should return lines with a value', async () => {
          const result = await collection.list(
            caller,
            new PaginatedFilter({
              conditionTree: new ConditionTreeLeaf('name', 'Present', null),
            }),
            new Projection('name', 'Company:id'),
          );

          expect(result).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ name: 'John Doe' }),
              expect.objectContaining({ name: 'Jane Doe' }),
              expect.objectContaining({ name: 'john Smith' }),
            ]),
          );
        });
      });

      describe('Missing', () => {
        it('should return lines without a value', async () => {
          const result = await collection.list(
            caller,
            new PaginatedFilter({
              conditionTree: new ConditionTreeLeaf('name', 'Missing', null),
            }),
            new Projection('name', 'Company:id'),
          );

          expect(result).toEqual(expect.arrayContaining([expect.objectContaining({ name: null })]));
        });
      });

      describe('Equal', () => {
        it('should return lines equal the searched value', async () => {
          const result = await collection.list(
            caller,
            new PaginatedFilter({
              conditionTree: new ConditionTreeLeaf('name', 'Equal', 'John Doe'),
            }),
            new Projection('name', 'Company:id'),
          );

          expect(result).toEqual(
            expect.arrayContaining([expect.objectContaining({ name: 'John Doe' })]),
          );
        });
      });

      describe('NotEqual', () => {
        it('should return lines not equal to the searched value', async () => {
          const result = await collection.list(
            caller,
            new PaginatedFilter({
              conditionTree: new ConditionTreeLeaf('name', 'NotEqual', 'John Doe'),
            }),
            new Projection('name', 'Company:id'),
          );

          expect(result).not.toEqual(
            expect.arrayContaining([expect.objectContaining({ name: 'John Doe' })]),
          );

          expect(result).toEqual(expect.arrayContaining([expect.objectContaining({ name: null })]));
        });

        it('should return lines without a null value', async () => {
          const result = await collection.list(
            caller,
            new PaginatedFilter({
              conditionTree: new ConditionTreeLeaf('name', 'NotEqual', null),
            }),
            new Projection('name', 'Company:id'),
          );

          expect(result).not.toEqual(
            expect.arrayContaining([expect.objectContaining({ name: null })]),
          );

          expect(result).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ name: 'John Doe' }),
              expect.objectContaining({ name: 'Jane Doe' }),
              expect.objectContaining({ name: 'john Smith' }),
            ]),
          );
        });
      });

      describe('In', () => {
        it('should return lines in the searched values', async () => {
          const result = await collection.list(
            caller,
            new PaginatedFilter({
              conditionTree: new ConditionTreeLeaf('name', 'In', ['John Doe', 'Jane Doe']),
            }),
            new Projection('name', 'Company:id'),
          );

          expect(result).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ name: 'John Doe' }),
              expect.objectContaining({ name: 'Jane Doe' }),
            ]),
          );
          expect(result).not.toEqual(
            expect.arrayContaining([expect.objectContaining({ name: 'john Smith' })]),
          );
          expect(result).not.toEqual(
            expect.arrayContaining([expect.objectContaining({ name: null })]),
          );
        });
      });

      describe('NotIn', () => {
        it('should return lines not in the searched values', async () => {
          const result = await collection.list(
            caller,
            new PaginatedFilter({
              conditionTree: new ConditionTreeLeaf('name', 'NotIn', ['John Doe', 'Jane Doe']),
            }),
            new Projection('name', 'Company:id'),
          );

          expect(result).not.toEqual(
            expect.arrayContaining([
              expect.objectContaining({ name: 'John Doe' }),
              expect.objectContaining({ name: 'Jane Doe' }),
            ]),
          );
          expect(result).toEqual(
            expect.arrayContaining([expect.objectContaining({ name: 'john Smith' })]),
          );
          expect(result).toEqual(expect.arrayContaining([expect.objectContaining({ name: null })]));
        });

        it('should return lines without a null value', async () => {
          const result = await collection.list(
            caller,
            new PaginatedFilter({
              conditionTree: new ConditionTreeLeaf('name', 'NotIn', [null]),
            }),
            new Projection('name', 'Company:id'),
          );

          expect(result).not.toEqual(
            expect.arrayContaining([expect.objectContaining({ name: null })]),
          );

          expect(result).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ name: 'John Doe' }),
              expect.objectContaining({ name: 'Jane Doe' }),
              expect.objectContaining({ name: 'john Smith' }),
            ]),
          );
        });

        it('should return lines without a null value and another', async () => {
          const result = await collection.list(
            caller,
            new PaginatedFilter({
              conditionTree: new ConditionTreeLeaf('name', 'NotIn', [null, 'John Doe']),
            }),
            new Projection('name', 'Company:id'),
          );

          expect(result).not.toEqual(
            expect.arrayContaining([expect.objectContaining({ name: null })]),
          );

          expect(result).not.toEqual(
            expect.arrayContaining([expect.objectContaining({ name: 'John Doe' })]),
          );

          expect(result).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ name: 'Jane Doe' }),
              expect.objectContaining({ name: 'john Smith' }),
            ]),
          );
        });

        it('should return all lines when empty array is passed', async () => {
          const result = await collection.list(
            caller,
            new PaginatedFilter({
              conditionTree: new ConditionTreeLeaf('name', 'NotIn', []),
            }),
            new Projection('name'),
          );

          expect(result.length).toBe(4);
        });
      });

      describe('GreaterThan', () => {
        it('should return lines equal the searched value', async () => {
          const result = await collection.list(
            caller,
            new PaginatedFilter({
              conditionTree: new ConditionTreeLeaf('amount', 'GreaterThan', 10),
            }),
            new Projection('name', 'Company:id'),
          );

          expect(result).toEqual(
            expect.arrayContaining([expect.objectContaining({ name: 'john Smith' })]),
          );
        });
      });

      describe('GreaterThanOrEqual', () => {
        it('should return lines equal the searched value', async () => {
          const result = await collection.list(
            caller,
            new PaginatedFilter({
              conditionTree: new ConditionTreeLeaf('amount', 'GreaterThanOrEqual', 10),
            }),
            new Projection('name', 'Company:id'),
          );

          expect(result).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ name: 'Jane Doe' }),
              expect.objectContaining({ name: 'john Smith' }),
            ]),
          );
        });
      });

      describe('LessThan', () => {
        it('should return lines equal the searched value', async () => {
          const result = await collection.list(
            caller,
            new PaginatedFilter({
              conditionTree: new ConditionTreeLeaf('amount', 'LessThan', 10),
            }),
            new Projection('name', 'Company:id'),
          );

          expect(result).toEqual(
            expect.arrayContaining([expect.objectContaining({ name: 'John Doe' })]),
          );
        });
      });

      describe('LessThanOrEqual', () => {
        it('should return lines equal the searched value', async () => {
          const result = await collection.list(
            caller,
            new PaginatedFilter({
              conditionTree: new ConditionTreeLeaf('amount', 'LessThanOrEqual', 10),
            }),
            new Projection('name', 'Company:id'),
          );

          expect(result).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ name: 'John Doe' }),
              expect.objectContaining({ name: 'Jane Doe' }),
            ]),
          );
        });
      });
    });

    if (connection.supports.arrays) {
      describe('On array fields of strings', () => {
        let collection: SequelizeCollection;

        beforeAll(async () => {
          sequelize.define('Objects', {
            tags: {
              type: DataTypes.ARRAY(DataTypes.TEXT),
              allowNull: true,
            },
          });

          await sequelize.sync({ force: true });

          await sequelize.models.Objects.bulkCreate([
            { tags: ['blue', 'red'] },
            { tags: ['yellow', 'red'] },
            { tags: ['orange', 'red'] },
            { tags: null },
          ]);

          const datasource = await createSequelizeDataSource(sequelize)(jest.fn(), jest.fn());
          collection = datasource.getCollection('Objects') as SequelizeCollection;
        });

        describe('IncludesAll', () => {
          it('should return lines containing all the searched values', async () => {
            const result = await collection.list(
              caller,
              new PaginatedFilter({
                conditionTree: new ConditionTreeLeaf('tags', 'IncludesAll', ['blue', 'red']),
              }),
              new Projection('tags'),
            );

            expect(result).toEqual(
              expect.arrayContaining([expect.objectContaining({ tags: ['blue', 'red'] })]),
            );
            expect(result).toHaveLength(1);
          });

          it('should return all lines containing the given value', async () => {
            const result = await collection.list(
              caller,
              new PaginatedFilter({
                conditionTree: new ConditionTreeLeaf('tags', 'IncludesAll', ['red']),
              }),
              new Projection('tags'),
            );

            expect(result).toEqual(
              expect.arrayContaining([
                expect.objectContaining({ tags: ['blue', 'red'] }),
                expect.objectContaining({ tags: ['yellow', 'red'] }),
                expect.objectContaining({ tags: ['orange', 'red'] }),
              ]),
            );
            expect(result).toHaveLength(3);
          });

          it('should work with a single value', async () => {
            const result = await collection.list(
              caller,
              new PaginatedFilter({
                conditionTree: new ConditionTreeLeaf('tags', 'IncludesAll', 'blue'),
              }),
              new Projection('tags'),
            );

            expect(result).toEqual(
              expect.arrayContaining([expect.objectContaining({ tags: ['blue', 'red'] })]),
            );
            expect(result).toHaveLength(1);
          });
        });

        describe('IncludesNone', () => {
          it('should return lines not containing any of the searched values', async () => {
            const result = await collection.list(
              caller,
              new PaginatedFilter({
                conditionTree: new ConditionTreeLeaf('tags', 'IncludesNone', ['blue', 'red']),
              }),
              new Projection('tags'),
            );

            expect(result).not.toEqual(
              expect.arrayContaining([expect.objectContaining({ tags: ['blue', 'red'] })]),
            );
            expect(result).not.toEqual(
              expect.arrayContaining([expect.objectContaining({ tags: ['yellow', 'red'] })]),
            );
            expect(result).not.toEqual(
              expect.arrayContaining([expect.objectContaining({ tags: ['orange', 'red'] })]),
            );
            expect(result).toEqual(
              expect.arrayContaining([expect.objectContaining({ tags: null })]),
            );
            expect(result).toHaveLength(1);
          });

          it('should work with one value', async () => {
            const result = await collection.list(
              caller,
              new PaginatedFilter({
                conditionTree: new ConditionTreeLeaf('tags', 'IncludesNone', 'blue'),
              }),
              new Projection('tags'),
            );

            expect(result).not.toEqual(
              expect.arrayContaining([expect.objectContaining({ tags: ['blue', 'red'] })]),
            );
            expect(result).toEqual(
              expect.arrayContaining([
                expect.objectContaining({ tags: ['yellow', 'red'] }),
                expect.objectContaining({ tags: ['orange', 'red'] }),
                expect.objectContaining({ tags: null }),
              ]),
            );
            expect(result).toHaveLength(3);
          });
        });

        describe('Equal', () => {
          it('should return lines equal the searched value', async () => {
            const result = await collection.list(
              caller,
              new PaginatedFilter({
                conditionTree: new ConditionTreeLeaf('tags', 'Equal', ['blue', 'red']),
              }),
              new Projection('tags'),
            );

            expect(result).toEqual(
              expect.arrayContaining([expect.objectContaining({ tags: ['blue', 'red'] })]),
            );
            expect(result).toHaveLength(1);
          });
        });

        describe('NotEqual', () => {
          it('should return matching lines', async () => {
            const result = await collection.list(
              caller,
              new PaginatedFilter({
                conditionTree: new ConditionTreeLeaf('tags', 'NotEqual', ['blue', 'red']),
              }),
              new Projection('tags'),
            );

            expect(result).not.toEqual(
              expect.arrayContaining([expect.objectContaining({ tags: ['blue', 'red'] })]),
            );
            expect(result).toEqual(
              expect.arrayContaining([
                expect.objectContaining({ tags: ['yellow', 'red'] }),
                expect.objectContaining({ tags: ['orange', 'red'] }),
                expect.objectContaining({ tags: null }),
              ]),
            );
            expect(result).toHaveLength(3);
          });
        });
      });
    }
  });
});
