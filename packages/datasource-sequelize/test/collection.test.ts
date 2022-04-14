import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import {
  Aggregation,
  ConditionTreeLeaf,
  DataSource,
  Filter,
  PaginatedFilter,
  Projection,
  RecordData,
  Sort,
} from '@forestadmin/datasource-toolkit';
import { DataTypes, Dialect, ModelDefined, Op, Sequelize } from 'sequelize';

import { SequelizeCollection } from '../src';
import QueryConverter from '../src/utils/query-converter';

describe('SequelizeDataSource > Collection', () => {
  const makeConstructorParams = (dialect = 'postgres') => {
    const dataSource = Symbol('datasource') as unknown as DataSource;
    const name = '__collection__';
    const sequelize = new Sequelize({ dialect: dialect as Dialect });
    sequelize.define('__collection__', {});

    return {
      dataSource,
      name,
      sequelize,
    };
  };

  it('should instantiate properly', () => {
    const { dataSource, name, sequelize } = makeConstructorParams();
    const sequelizeCollection = new SequelizeCollection(name, dataSource, sequelize.models[name]);

    expect(sequelizeCollection).toBeDefined();
    expect(sequelizeCollection.name).toBe(name);
    expect(sequelizeCollection.dataSource).toBe(dataSource);
    // eslint-disable-next-line @typescript-eslint/dot-notation
    expect(sequelizeCollection['model']).toBe(sequelize.models[name]);
  });

  it('should fail to instantiate without a Sequelize model instance', () => {
    const { dataSource, name } = makeConstructorParams();
    expect(() => new SequelizeCollection(name, dataSource, null)).toThrow(
      'Invalid (null) model instance.',
    );
  });

  describe('create', () => {
    const setup = () => {
      const { dataSource, name, sequelize } = makeConstructorParams();
      const sequelizeCollection = new SequelizeCollection(name, dataSource, sequelize.models[name]);
      const recordData = Symbol('recordData');
      const record = {
        get: jest.fn(() => recordData),
      };
      const bulkCreate = jest.fn().mockResolvedValue([record]);
      // eslint-disable-next-line @typescript-eslint/dot-notation
      sequelizeCollection['model'] = {
        ...sequelize.models[name],
        bulkCreate,
      } as unknown as ModelDefined<unknown, unknown>;

      return {
        bulkCreate,
        recordData,
        sequelizeCollection,
      };
    };

    it('should delegate work to `sequelize.model.bulkCreate`', async () => {
      const { bulkCreate, recordData, sequelizeCollection } = setup();
      const data = Symbol('data') as unknown as RecordData[];

      await expect(sequelizeCollection.create(factories.caller.build(), data)).resolves.toEqual([
        recordData,
      ]);
      expect(bulkCreate).toHaveBeenCalledWith(data);
    });
  });

  describe('list', () => {
    const setup = () => {
      const { dataSource, name, sequelize } = makeConstructorParams();

      const relation = sequelize.define('relation', {
        aField: { field: 'a_field', type: DataTypes.STRING },
      });

      const model = sequelize.model(name);
      model.belongsTo(relation);

      const recordData = Symbol('recordData');
      const record = {
        get: jest.fn(() => recordData),
      };
      const findAll = jest.fn().mockResolvedValue([record]);

      model.findAll = findAll;

      const sequelizeCollection = new SequelizeCollection(name, dataSource, model);

      return {
        findAll,
        record,
        recordData,
        sequelizeCollection,
      };
    };

    it('should delegate work to `sequelize.model.findAll`', async () => {
      const { findAll, recordData, sequelizeCollection } = setup();
      const filter = new Filter({});
      const projection = new Projection();

      const result = await sequelizeCollection.list(factories.caller.build(), filter, projection);

      expect(result).toBeArrayOfSize(1);
      expect(result[0]).toBe(recordData);
      expect(findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: projection,
        }),
      );
    });

    it('should resolve with plain records', async () => {
      const { record, recordData, sequelizeCollection } = setup();
      const filter = new Filter({});
      const projection = new Projection();

      const result = await sequelizeCollection.list(factories.caller.build(), filter, projection);

      expect(result).toBeArrayOfSize(1);
      expect(result[0]).toBe(recordData);
      expect(record.get).toHaveBeenCalledWith({ plain: true });
    });

    it('should add include from condition tree, sort and projection', async () => {
      const { findAll, sequelizeCollection } = setup();
      const filter = new PaginatedFilter({
        sort: new Sort({ field: 'relation1:field1', ascending: true }),
        conditionTree: new ConditionTreeLeaf('relation:aField', 'Equal', 42),
      });
      const projection = new Projection('relation3:field3');

      await sequelizeCollection.list(factories.caller.build(), filter, projection);

      expect(findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            '$relation.a_field$': { [Op.eq]: 42 },
          },
          include: [
            {
              association: 'relation3',
              attributes: ['field3'],
              include: [],
            },
            {
              association: 'relation',
              attributes: [],
              include: [],
            },
            {
              association: 'relation1',
              attributes: [],
              include: [],
            },
          ],
        }),
      );
    });
  });

  describe('update', () => {
    const setup = () => {
      const { dataSource, name, sequelize } = makeConstructorParams();

      const update = jest.fn().mockResolvedValue([]);

      const model = sequelize.model(name);
      model.update = update;

      const sequelizeCollection = new SequelizeCollection(name, dataSource, model);

      return {
        model,
        update,
        sequelizeCollection,
      };
    };

    describe('when there is no condition tree', () => {
      it('should delegate work to `sequelize.model.update`', async () => {
        const { update, sequelizeCollection } = setup();
        const patch = { field: '__value__' };
        const filter = new Filter({});
        const where = {};
        jest
          .spyOn(QueryConverter, 'getWhereFromConditionTreeWithoutInclude')
          .mockResolvedValue(where);

        await sequelizeCollection.update(factories.caller.build(), filter, patch);

        expect(update).toHaveBeenCalledWith(patch, { where, fields: Object.keys(patch) });
      });
    });
  });

  describe('delete', () => {
    const setup = () => {
      const { dataSource, name, sequelize } = makeConstructorParams();

      const destroy = jest.fn().mockResolvedValue(0);

      const model = sequelize.model(name);
      model.destroy = destroy;

      const sequelizeCollection = new SequelizeCollection(name, dataSource, model);

      return {
        model,
        destroy,
        sequelizeCollection,
      };
    };

    it('builds a new condition tree before to call `sequelize.model.delete`', async () => {
      const { destroy, sequelizeCollection, model } = setup();
      const filter = new Filter({});

      const where = {};
      jest
        .spyOn(QueryConverter, 'getWhereFromConditionTreeWithoutInclude')
        .mockResolvedValue(where);

      await sequelizeCollection.delete(factories.caller.build(), filter);

      expect(destroy).toHaveBeenCalledWith({ where });
    });
  });

  describe('aggregate', () => {
    const setup = (dialect?: string) => {
      const { dataSource, name, sequelize } = makeConstructorParams(dialect);

      const model = sequelize.define('model', {
        __field__: {
          type: DataTypes.STRING,
          field: '__field__',
        },
        __group_field__: {
          type: DataTypes.STRING,
          field: '__group_field__',
        },
        renamed__field__: {
          type: DataTypes.STRING,
          field: 'another__field__',
        },
        date__field__: {
          type: DataTypes.DATE,
          field: 'date__field__',
        },
      });

      const relation = sequelize.define('relation', {
        as__field__: {
          type: DataTypes.STRING,
          field: 'as__field__',
        },
        renamed__as__field__: {
          type: DataTypes.STRING,
          field: 'another__as__field__',
        },
      });

      const findAll = jest.fn().mockResolvedValue([
        {
          __aggregate__: '__aggregate__:value',
          __group_field____grouped__: '__group_field__:value',
          renamed__field____grouped__: 'renamed__field__:value',
          'relations:as__field____grouped__': 'relations:as__field__:value',
          'relations:renamed__as__field____grouped__': 'relations:renamed__as__field__:value',
          date__field____grouped__: 'date__field__:value',
        },
      ]);

      model.hasMany(relation);

      model.findAll = findAll;

      const sequelizeCollection = new SequelizeCollection(name, dataSource, model);

      return {
        findAll,
        sequelize,
        sequelizeCollection,
        model,
      };
    };

    describe('whitout aggregate field', () => {
      it('should aggregate on *', async () => {
        const { findAll, sequelizeCollection } = setup();
        const aggregation = new Aggregation({
          operation: 'Sum',
        });
        const filter = new Filter({});

        await expect(
          sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
        ).resolves.toEqual([{ group: {}, value: '__aggregate__:value' }]);

        expect(findAll).toHaveBeenCalledTimes(1);
        expect(findAll).toHaveBeenCalledWith(
          expect.objectContaining({
            attributes: [[{ args: [{ col: '*' }], fn: 'SUM' }, '__aggregate__']],
          }),
        );
      });
    });

    describe('with aggregate field', () => {
      it('should aggregate on field', async () => {
        const { findAll, sequelizeCollection } = setup();
        const aggregation = new Aggregation({
          field: '__field__',
          operation: 'Sum',
        });
        const filter = new Filter({});

        await expect(
          sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
        ).resolves.toEqual([{ group: {}, value: '__aggregate__:value' }]);

        expect(findAll).toHaveBeenCalledTimes(1);
        expect(findAll).toHaveBeenCalledWith(
          expect.objectContaining({
            attributes: [[{ args: [{ col: '"model"."__field__"' }], fn: 'SUM' }, '__aggregate__']],
          }),
        );
      });

      describe('with Count operation', () => {
        it('should aggregate on *', async () => {
          const { findAll, sequelizeCollection } = setup();
          const aggregation = new Aggregation({
            field: '__field__',
            operation: 'Count',
          });
          const filter = new Filter({});

          await expect(
            sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
          ).resolves.toEqual([{ group: {}, value: '__aggregate__:value' }]);

          expect(findAll).toHaveBeenCalledTimes(1);
          expect(findAll).toHaveBeenCalledWith(
            expect.objectContaining({
              attributes: [[{ args: [{ col: '*' }], fn: 'COUNT' }, '__aggregate__']],
            }),
          );
        });
      });

      describe('when field name is deferent as column', () => {
        it('should aggregate properly', async () => {
          const { findAll, sequelizeCollection } = setup();
          const aggregation = new Aggregation({
            field: 'renamed__field__',
            operation: 'Sum',
          });
          const filter = new Filter({});

          await expect(
            sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
          ).resolves.toEqual([{ group: {}, value: '__aggregate__:value' }]);

          expect(findAll).toHaveBeenCalledTimes(1);
          expect(findAll).toHaveBeenCalledWith(
            expect.objectContaining({
              attributes: [
                [{ args: [{ col: '"model"."another__field__"' }], fn: 'SUM' }, '__aggregate__'],
              ],
            }),
          );
        });
      });

      describe('when aggregate field is on relation', () => {
        it('should aggregate properly', async () => {
          const { findAll, sequelizeCollection } = setup();
          const aggregation = new Aggregation({
            field: 'relations:as__field__',
            operation: 'Sum',
          });
          const filter = new Filter({});

          await expect(
            sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
          ).resolves.toEqual([{ group: {}, value: '__aggregate__:value' }]);

          expect(findAll).toHaveBeenCalledTimes(1);
          expect(findAll).toHaveBeenCalledWith(
            expect.objectContaining({
              attributes: [
                [{ args: [{ col: '"relations"."as__field__"' }], fn: 'SUM' }, '__aggregate__'],
              ],
            }),
          );
        });

        it('should add relation to include clause', async () => {
          const { findAll, sequelizeCollection } = setup();
          const aggregation = new Aggregation({
            field: 'relations:as__field__',
            operation: 'Sum',
          });
          const filter = new Filter({});

          await expect(
            sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
          ).resolves.toEqual([{ group: {}, value: '__aggregate__:value' }]);

          expect(findAll).toHaveBeenCalledTimes(1);
          expect(findAll).toHaveBeenCalledWith(
            expect.objectContaining({
              include: [
                {
                  association: 'relations',
                  include: [],
                  attributes: [],
                },
              ],
            }),
          );
        });

        describe('on count', () => {
          it('should count on *', async () => {
            const { findAll, sequelizeCollection } = setup();
            const aggregation = new Aggregation({
              field: 'relations:undefined',
              operation: 'Count',
            });
            const filter = new Filter({});

            await expect(
              sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
            ).resolves.toEqual([{ group: {}, value: '__aggregate__:value' }]);

            expect(findAll).toHaveBeenCalledTimes(1);
            expect(findAll).toHaveBeenCalledWith(
              expect.objectContaining({
                attributes: [[{ args: [{ col: '*' }], fn: 'COUNT' }, '__aggregate__']],
              }),
            );
          });
        });

        describe('when field name is deferent as column', () => {
          it('should aggregate properly', async () => {
            const { findAll, sequelizeCollection } = setup();
            const aggregation = new Aggregation({
              field: 'relations:renamed__as__field__',
              operation: 'Sum',
            });
            const filter = new Filter({});

            await expect(
              sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
            ).resolves.toEqual([{ group: {}, value: '__aggregate__:value' }]);

            expect(findAll).toHaveBeenCalledTimes(1);
            expect(findAll).toHaveBeenCalledWith(
              expect.objectContaining({
                attributes: [
                  [
                    { args: [{ col: '"relations"."another__as__field__"' }], fn: 'SUM' },
                    '__aggregate__',
                  ],
                ],
              }),
            );
          });
        });
      });
    });

    describe('with filter', () => {
      it('should add filter to where clause', async () => {
        const { findAll, sequelizeCollection } = setup();
        const aggregation = new Aggregation({
          operation: 'Count',
        });
        const filter = new Filter({
          conditionTree: new ConditionTreeLeaf('id', 'Equal', 42),
        });

        await expect(
          sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
        ).resolves.toEqual([{ group: {}, value: '__aggregate__:value' }]);

        expect(findAll).toHaveBeenCalledTimes(1);
        expect(findAll).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              id: { [Op.eq]: 42 },
            },
          }),
        );
      });
    });

    describe('with groups', () => {
      it('should compute group properly', async () => {
        const { findAll, sequelizeCollection } = setup();
        const aggregation = new Aggregation({
          operation: 'Count',
          groups: [{ field: '__group_field__' }],
        });
        const filter = new Filter({});

        await expect(
          sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
        ).resolves.toEqual([
          { group: { __group_field__: '__group_field__:value' }, value: '__aggregate__:value' },
        ]);

        expect(findAll).toHaveBeenCalledTimes(1);
        expect(findAll).toHaveBeenCalledWith(
          expect.objectContaining({
            attributes: expect.arrayContaining([
              [{ col: '"model"."__group_field__"' }, '__group_field____grouped__'],
            ]),
            group: ['__group_field____grouped__'],
          }),
        );
      });

      describe('when field name is deferent as column', () => {
        it('should compute group properly', async () => {
          const { findAll, sequelizeCollection } = setup();
          const aggregation = new Aggregation({
            operation: 'Count',
            groups: [{ field: 'renamed__field__' }],
          });
          const filter = new Filter({});

          await expect(
            sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
          ).resolves.toEqual([
            { group: { renamed__field__: 'renamed__field__:value' }, value: '__aggregate__:value' },
          ]);

          expect(findAll).toHaveBeenCalledTimes(1);
          expect(findAll).toHaveBeenCalledWith(
            expect.objectContaining({
              attributes: expect.arrayContaining([
                [{ col: '"model"."another__field__"' }, 'renamed__field____grouped__'],
              ]),
              group: ['renamed__field____grouped__'],
            }),
          );
        });
      });

      describe('when group have relation', () => {
        it('should aggregate properly', async () => {
          const { findAll, sequelizeCollection } = setup();
          const aggregation = new Aggregation({
            operation: 'Count',
            groups: [{ field: 'relations:as__field__' }],
          });
          const filter = new Filter({});

          await expect(
            sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
          ).resolves.toEqual([
            {
              group: {
                'relations:as__field__': 'relations:as__field__:value',
              },
              value: '__aggregate__:value',
            },
          ]);

          expect(findAll).toHaveBeenCalledTimes(1);
          expect(findAll).toHaveBeenCalledWith(
            expect.objectContaining({
              attributes: expect.arrayContaining([
                [{ col: '"relations"."as__field__"' }, 'relations:as__field____grouped__'],
              ]),
              group: ['relations:as__field____grouped__'],
            }),
          );
        });

        it('should add relation to include clause', async () => {
          const { findAll, sequelizeCollection } = setup();
          const aggregation = new Aggregation({
            operation: 'Count',
            groups: [{ field: 'relations:as__field__' }],
          });
          const filter = new Filter({});

          await expect(
            sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
          ).resolves.toEqual([
            {
              group: {
                'relations:as__field__': 'relations:as__field__:value',
              },
              value: '__aggregate__:value',
            },
          ]);

          expect(findAll).toHaveBeenCalledTimes(1);
          expect(findAll).toHaveBeenCalledWith(
            expect.objectContaining({
              include: [
                {
                  association: 'relations',
                  include: [],
                  attributes: [],
                },
              ],
            }),
          );
        });

        describe('when field name is deferent as column', () => {
          it('should aggregate properly', async () => {
            const { findAll, sequelizeCollection } = setup();
            const aggregation = new Aggregation({
              operation: 'Count',
              groups: [{ field: 'relations:renamed__as__field__' }],
            });
            const filter = new Filter({});

            await expect(
              sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
            ).resolves.toEqual([
              {
                group: {
                  'relations:renamed__as__field__': 'relations:renamed__as__field__:value',
                },
                value: '__aggregate__:value',
              },
            ]);

            expect(findAll).toHaveBeenCalledTimes(1);
            expect(findAll).toHaveBeenCalledWith(
              expect.objectContaining({
                attributes: expect.arrayContaining([
                  [
                    { col: '"relations"."another__as__field__"' },
                    'relations:renamed__as__field____grouped__',
                  ],
                ]),
                group: ['relations:renamed__as__field____grouped__'],
              }),
            );
          });
        });

        describe('when dialect is mssql', () => {
          it('should add field to group', async () => {
            const { findAll, sequelizeCollection } = setup('mssql');

            const aggregation = new Aggregation({
              operation: 'Count',
              groups: [{ field: '__group_field__' }],
            });
            const filter = new Filter({});

            await expect(
              sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
            ).resolves.toEqual([
              { group: { __group_field__: '__group_field__:value' }, value: '__aggregate__:value' },
            ]);

            expect(findAll).toHaveBeenCalledTimes(1);
            expect(findAll).toHaveBeenCalledWith(
              expect.objectContaining({
                attributes: expect.arrayContaining([
                  [{ col: '[model].[__group_field__]' }, '__group_field____grouped__'],
                ]),
                group: ['[model].[__group_field__]'],
              }),
            );
          });
        });
      });

      describe('when group have date operations', () => {
        it('should group properly', async () => {
          const { findAll, sequelizeCollection } = setup();
          const aggregation = new Aggregation({
            operation: 'Count',
            groups: [{ field: 'date__field__', operation: 'Day' }],
          });
          const filter = new Filter({});

          await expect(
            sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
          ).resolves.toEqual([
            { group: { date__field__: 'date__field__:value' }, value: '__aggregate__:value' },
          ]);

          expect(findAll).toHaveBeenCalledTimes(1);
          expect(findAll).toHaveBeenCalledWith(
            expect.objectContaining({
              attributes: expect.arrayContaining([
                [
                  {
                    args: [
                      { args: ['day', { col: '"model"."date__field__"' }], fn: 'DATE_TRUNC' },
                      'YYYY-MM-DD',
                    ],
                    fn: 'TO_CHAR',
                  },
                  'date__field____grouped__',
                ],
              ]),
              group: ['date__field____grouped__'],
            }),
          );
        });

        describe('when dialect is mssql', () => {
          it('should add date agregation to group', async () => {
            const { findAll, sequelizeCollection } = setup('mssql');

            const aggregation = new Aggregation({
              operation: 'Count',
              groups: [{ field: 'date__field__', operation: 'Day' }],
            });
            const filter = new Filter({});

            await expect(
              sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
            ).resolves.toEqual([
              { group: { date__field__: 'date__field__:value' }, value: '__aggregate__:value' },
            ]);

            const aggregateFunction = {
              fn: 'CONVERT',
              args: [{ val: 'varchar(10)' }, { col: '[model].[date__field__]' }, 23],
            };

            expect(findAll).toHaveBeenCalledTimes(1);
            expect(findAll).toHaveBeenCalledWith(
              expect.objectContaining({
                attributes: expect.arrayContaining([
                  [aggregateFunction, 'date__field____grouped__'],
                ]),
                group: [aggregateFunction],
              }),
            );
          });
        });
      });
    });

    describe('on sort', () => {
      describe('when dialect is postgres', () => {
        it('should sort on aggragate by default', async () => {
          const { findAll, sequelizeCollection } = setup();
          const aggregation = new Aggregation({
            operation: 'Count',
          });
          const filter = new Filter({});

          await expect(
            sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
          ).resolves.toEqual([{ group: {}, value: '__aggregate__:value' }]);

          expect(findAll).toHaveBeenCalledTimes(1);
          expect(findAll).toHaveBeenCalledWith(
            expect.objectContaining({
              order: [[{ col: '__aggregate__' }, 'DESC NULLS LAST']],
            }),
          );
        });
      });

      describe('when dialect is mssql', () => {
        it('should sort on aggragate by default', async () => {
          const { findAll, sequelizeCollection } = setup('mssql');
          const aggregation = new Aggregation({
            operation: 'Count',
          });
          const filter = new Filter({});

          await expect(
            sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
          ).resolves.toEqual([{ group: {}, value: '__aggregate__:value' }]);

          expect(findAll).toHaveBeenCalledTimes(1);
          expect(findAll).toHaveBeenCalledWith(
            expect.objectContaining({
              order: [[{ fn: 'COUNT', args: [{ col: '*' }] }, 'DESC']],
            }),
          );
        });
      });

      it('should sort on aggragate by default', async () => {
        const { findAll, sequelizeCollection } = setup('mysql');
        const aggregation = new Aggregation({
          operation: 'Count',
        });
        const filter = new Filter({});

        await expect(
          sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
        ).resolves.toEqual([{ group: {}, value: '__aggregate__:value' }]);

        expect(findAll).toHaveBeenCalledTimes(1);
        expect(findAll).toHaveBeenCalledWith(
          expect.objectContaining({
            order: [[{ col: '__aggregate__' }, 'DESC']],
          }),
        );
      });
    });

    describe('with limit', () => {
      it('should add limit to query', async () => {
        const { findAll, sequelizeCollection } = setup();
        const aggregation = new Aggregation({
          operation: 'Count',
        });
        const filter = new Filter({});
        const limit = 1;

        await expect(
          sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation, limit),
        ).resolves.not.toThrow();

        expect(findAll).toHaveBeenCalledTimes(1);
        expect(findAll).toHaveBeenCalledWith(expect.objectContaining({ limit }));
      });
    });
  });
});
