import {
  Aggregation,
  ConditionTreeLeaf,
  DataSource,
  Filter,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import { DataTypes, Dialect, ModelDefined, Op, Sequelize } from 'sequelize';

import { SequelizeCollection } from '../src';

describe('SequelizeDataSource > Collection', () => {
  const makeConstructorParams = (dialect = 'postgres') => {
    const dataSource = Symbol('datasource') as unknown as DataSource;
    const name = '__collection__';
    const sequelize = new Sequelize({ dialect: dialect as Dialect });
    sequelize.define('__collection__', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      virtualField: {
        type: DataTypes.VIRTUAL,
        get() {
          return 'virtualValue';
        },
      },
    });

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
    expect(() => new SequelizeCollection(name, dataSource, null as any)).toThrow(
      'Invalid (null) model instance.',
    );
  });

  describe('rawQuery', () => {
    it('should forward rawQuery calls to sequelize', async () => {
      type NativeDriver = { rawQuery: (...args: unknown[]) => Promise<RecordData[]> };
      const { dataSource, name, sequelize } = makeConstructorParams();
      const sequelizeCollection = new SequelizeCollection(name, dataSource, sequelize.models[name]);

      const spy = jest.spyOn(sequelize, 'query').mockResolvedValueOnce([[{ id: 1 }], 1]);

      const result = await (sequelizeCollection.nativeDriver as NativeDriver).rawQuery(
        'SELECT * FROM __collection__ where id = :id',
        { id: 1 },
      );

      expect(result).toEqual([{ id: 1 }]);
      expect(spy).toHaveBeenCalledWith('SELECT * FROM __collection__ where id = :id', {
        plain: false,
        raw: true,
        replacements: { id: 1 },
        type: 'RAW',
      });
    });

    describe('when using bind', () => {
      it('should forward parameters through bind', async () => {
        type NativeDriver = { rawQuery: (...args: unknown[]) => Promise<RecordData[]> };

        const { dataSource, name, sequelize } = makeConstructorParams();
        const sequelizeCollection = new SequelizeCollection(
          name,
          dataSource,
          sequelize.models[name],
        );

        const spy = jest.spyOn(sequelize, 'query').mockResolvedValueOnce([[{ id: 1 }], 1]);

        const result = await (sequelizeCollection.nativeDriver as NativeDriver).rawQuery(
          'SELECT * FROM __collection__ where id = $1',
          [1],
          { syntax: 'bind' },
        );

        expect(result).toEqual([{ id: 1 }]);
        expect(spy).toHaveBeenCalledWith('SELECT * FROM __collection__ where id = $1', {
          plain: false,
          raw: true,
          bind: [1],
          type: 'RAW',
        });
      });
    });
  });

  describe('create', () => {
    const setup = (recordData: RecordData[]) => {
      const { dataSource, name, sequelize } = makeConstructorParams();
      const sequelizeCollection = new SequelizeCollection(name, dataSource, sequelize.models[name]);
      const records = recordData.map(r => ({ get: jest.fn().mockReturnValueOnce(r) }));
      const bulkCreate = jest.fn().mockResolvedValue(records);
      // eslint-disable-next-line @typescript-eslint/dot-notation
      sequelizeCollection['model'] = {
        ...sequelize.models[name],
        bulkCreate,
      } as unknown as ModelDefined<any, any>;

      return {
        bulkCreate,
        sequelizeCollection,
      };
    };

    it('should delegate work to `sequelize.model.bulkCreate`', async () => {
      const data = [{ id: 'data' }, { createdAt: 10 }, { updatedAt: ['Enum'] }];
      const { bulkCreate, sequelizeCollection } = setup(data);

      await expect(sequelizeCollection.create(factories.caller.build(), data)).resolves.toEqual(
        data,
      );
      expect(bulkCreate).toHaveBeenCalledWith(data);
    });

    it('should remove the VIRTUAL field from the returned record', async () => {
      const data = [{ id: 'data', virtualField: 'virtualValue' }];
      const { bulkCreate, sequelizeCollection } = setup(data);

      await expect(sequelizeCollection.create(factories.caller.build(), data)).resolves.toEqual([
        { id: 'data' },
      ]);
      expect(bulkCreate).toHaveBeenCalledWith(data);
    });

    it('should serialize date as iso string', async () => {
      const data = [{ createdAt: new Date('2000-01-02') }];
      const { bulkCreate, sequelizeCollection } = setup(data);

      await expect(sequelizeCollection.create(factories.caller.build(), data)).resolves.toEqual([
        { createdAt: '2000-01-02T00:00:00.000Z' },
      ]);
      expect(bulkCreate).toHaveBeenCalledWith(data);
    });

    it('should serialize date as iso string with many to one relation', async () => {
      const data = [{ createdAt: { date: new Date('2000-01-02') } }];
      const { bulkCreate, sequelizeCollection } = setup(data);

      await expect(sequelizeCollection.create(factories.caller.build(), data)).resolves.toEqual([
        { createdAt: { date: '2000-01-02T00:00:00.000Z' } },
      ]);
      expect(bulkCreate).toHaveBeenCalledWith(data);
    });

    it('should serialize array of date as iso string', async () => {
      const data = [{ createdAt: [new Date('2000-01-02')] }];
      const { bulkCreate, sequelizeCollection } = setup(data);

      await expect(sequelizeCollection.create(factories.caller.build(), data)).resolves.toEqual([
        { createdAt: ['2000-01-02T00:00:00.000Z'] },
      ]);
      expect(bulkCreate).toHaveBeenCalledWith(data);
    });
  });

  describe('list', () => {
    const setup = (recordData: RecordData[]) => {
      const { dataSource, name, sequelize } = makeConstructorParams();

      const relation = sequelize.define('relation', {
        aField: { field: 'a_field', type: DataTypes.STRING },
      });

      const model = sequelize.model(name);
      model.belongsTo(relation);

      const records = recordData.map(r => ({ get: jest.fn().mockReturnValueOnce(r) }));
      const findAll = jest.fn().mockResolvedValue(records);

      model.findAll = findAll;

      const sequelizeCollection = new SequelizeCollection(name, dataSource, model);

      return {
        findAll,
        recordData,
        sequelizeCollection,
        records,
      };
    };

    it('should delegate work to `sequelize.model.findAll`', async () => {
      const recordData = [{ data: 'data' }];
      const { findAll, sequelizeCollection } = setup(recordData);
      const filter = new Filter({});
      const projection = new Projection('data');

      const result = await sequelizeCollection.list(factories.caller.build(), filter, projection);

      expect(result).toHaveLength(1);
      expect(result[0]).toStrictEqual(recordData[0]);
      expect(findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: projection,
        }),
      );
    });

    it('should resolve with plain records', async () => {
      const recordData = [{ data: 'data' }];
      const { sequelizeCollection, records } = setup(recordData);
      const filter = new Filter({});
      const projection = new Projection('data');

      const result = await sequelizeCollection.list(factories.caller.build(), filter, projection);

      expect(result).toHaveLength(1);
      expect(result[0]).toStrictEqual(recordData[0]);
      expect(records[0].get).toHaveBeenCalledWith({ plain: true });
    });

    it('should serialize date as iso string', async () => {
      const recordData = [{ data: new Date('2000-10-01') }, { data: new Date('2000-10-02') }];
      const { sequelizeCollection } = setup(recordData);
      const filter = new Filter({});
      const projection = new Projection('data');

      const result = await sequelizeCollection.list(factories.caller.build(), filter, projection);

      expect(result).toEqual([
        { data: '2000-10-01T00:00:00.000Z' },
        { data: '2000-10-02T00:00:00.000Z' },
      ]);
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

    it('should delegate work to `sequelize.model.delete``', async () => {
      const { destroy, sequelizeCollection } = setup();
      const filter = new Filter({});
      const where = {};

      await sequelizeCollection.delete(factories.caller.build(), filter);

      expect(destroy).toHaveBeenCalledWith({ where });
    });
  });

  describe('aggregate', () => {
    const setup = (dialect?: string) => {
      const { dataSource, name, sequelize } = makeConstructorParams(dialect);

      const model = sequelize.define('model', {
        __field__: {
          type: DataTypes.NUMBER,
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
          __aggregate__: '123',
          __group_field____grouped__: '__group_field__:value',
          renamed__field____grouped__: 'renamed__field__:value',
          'relations:as__field____grouped__': 'relations:as__field__:value',
          'relations:renamed__as__field____grouped__': 'relations:renamed__as__field__:value',
          date__field____grouped__: new Date('2000-10-01'),
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

    describe('without aggregate field', () => {
      it('should aggregate on *', async () => {
        const { findAll, sequelizeCollection } = setup();
        const aggregation = new Aggregation({
          operation: 'Sum',
        });
        const filter = new Filter({});

        await expect(
          sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
        ).resolves.toEqual([{ group: {}, value: 123 }]);

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
        ).resolves.toEqual([{ group: {}, value: 123 }]);

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
          ).resolves.toEqual([{ group: {}, value: 123 }]);

          expect(findAll).toHaveBeenCalledTimes(1);
          expect(findAll).toHaveBeenCalledWith(
            expect.objectContaining({
              attributes: [[{ args: [{ col: '*' }], fn: 'COUNT' }, '__aggregate__']],
            }),
          );
        });
      });

      describe('when field name is different as column', () => {
        it('should aggregate properly', async () => {
          const { findAll, sequelizeCollection } = setup();
          const aggregation = new Aggregation({
            field: 'renamed__field__',
            operation: 'Sum',
          });
          const filter = new Filter({});

          await expect(
            sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
          ).resolves.toEqual([{ group: {}, value: '123' }]);

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
            ).resolves.toEqual([{ group: {}, value: 123 }]);

            expect(findAll).toHaveBeenCalledTimes(1);
            expect(findAll).toHaveBeenCalledWith(
              expect.objectContaining({
                attributes: [[{ args: [{ col: '*' }], fn: 'COUNT' }, '__aggregate__']],
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
        ).resolves.toEqual([{ group: {}, value: 123 }]);

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
        ).resolves.toEqual([{ group: { __group_field__: '__group_field__:value' }, value: 123 }]);

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

      describe('when field name is different as column', () => {
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
            { group: { renamed__field__: 'renamed__field__:value' }, value: 123 },
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
              value: 123,
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
              value: 123,
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

        describe('when field name is different as column', () => {
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
                value: 123,
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
              { group: { __group_field__: '__group_field__:value' }, value: 123 },
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
            // date should be serialize in iso string
            { group: { date__field__: '2000-10-01T00:00:00.000Z' }, value: 123 },
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
          it('should add date aggregation to group', async () => {
            const { findAll, sequelizeCollection } = setup('mssql');

            const aggregation = new Aggregation({
              operation: 'Count',
              groups: [{ field: 'date__field__', operation: 'Day' }],
            });
            const filter = new Filter({});

            await expect(
              sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
            ).resolves.toEqual([
              {
                // date should be serialize in iso string
                group: { date__field__: '2000-10-01T00:00:00.000Z' },
                value: 123,
              },
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
        it('should sort on aggregate by default', async () => {
          const { findAll, sequelizeCollection } = setup();
          const aggregation = new Aggregation({
            operation: 'Count',
          });
          const filter = new Filter({});

          await expect(
            sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
          ).resolves.toEqual([{ group: {}, value: 123 }]);

          expect(findAll).toHaveBeenCalledTimes(1);
          expect(findAll).toHaveBeenCalledWith(
            expect.objectContaining({
              order: [[{ col: '__aggregate__' }, 'DESC NULLS LAST']],
            }),
          );
        });
      });

      describe('when dialect is mssql', () => {
        it('should sort on aggregate by default', async () => {
          const { findAll, sequelizeCollection } = setup('mssql');
          const aggregation = new Aggregation({
            operation: 'Count',
          });
          const filter = new Filter({});

          await expect(
            sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
          ).resolves.toEqual([{ group: {}, value: 123 }]);

          expect(findAll).toHaveBeenCalledTimes(1);
          expect(findAll).toHaveBeenCalledWith(
            expect.objectContaining({
              order: [[{ fn: 'COUNT', args: [{ col: '*' }] }, 'DESC']],
            }),
          );
        });
      });

      it('should sort on aggregate by default', async () => {
        const { findAll, sequelizeCollection } = setup('mysql');
        const aggregation = new Aggregation({
          operation: 'Count',
        });
        const filter = new Filter({});

        await expect(
          sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
        ).resolves.toEqual([{ group: {}, value: 123 }]);

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
