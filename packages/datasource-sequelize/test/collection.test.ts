/* eslint-disable max-classes-per-file */
import {
  Action,
  ActionForm,
  ActionResponse,
  ActionResponseType,
  ActionSchemaScope,
  Aggregation,
  AggregationOperation,
  ConditionTreeLeaf,
  DataSource,
  Filter,
  Operator,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';
import { DataTypes, ModelDefined, Op, Sequelize } from 'sequelize';

import { SequelizeCollection } from '../src';

describe('SequelizeDataSource > Collection', () => {
  const makeConstructorParams = () => {
    const dataSource = Symbol('datasource') as unknown as DataSource;
    const name = '__collection__';
    const sequelize = {
      define: jest.fn(() => ({})),
      models: {
        [name]: {
          getAttributes: jest.fn(() => ({})),
          name: 'model',
        },
      },
    } as unknown as Sequelize;

    return {
      dataSource,
      name,
      sequelize,
    };
  };

  it('should instanciate properly', () => {
    const { dataSource, name, sequelize } = makeConstructorParams();
    const sequelizeCollection = new SequelizeCollection(name, dataSource, sequelize.models[name]);

    expect(sequelizeCollection).toBeDefined();
    expect(sequelizeCollection.name).toBe(name);
    expect(sequelizeCollection.dataSource).toBe(dataSource);
    // eslint-disable-next-line @typescript-eslint/dot-notation
    expect(sequelizeCollection['model']).toBe(sequelize.models[name]);
  });

  it('should fail to instanciate without a Sequelize model instance', () => {
    const { dataSource, name } = makeConstructorParams();
    expect(() => new SequelizeCollection(name, dataSource, null)).toThrow(
      'Invalid (null) model instance.',
    );
  });

  describe('getAction', () => {
    class TestAction implements Action {
      async execute(): Promise<ActionResponse> {
        return {
          type: ActionResponseType.Redirect,
          path: 'https://test.com',
        };
      }

      async getForm(): Promise<ActionForm> {
        return { fields: [] };
      }
    }

    class CollectionWithAction extends SequelizeCollection {
      constructor(name, datasource: DataSource, sequelize) {
        super(name, datasource, sequelize);

        this.addAction('__action__', { scope: ActionSchemaScope.Single }, new TestAction());
      }
    }

    it('should return a known action', () => {
      const { dataSource, name, sequelize } = makeConstructorParams();
      const collectionWithAction = new CollectionWithAction(
        name,
        dataSource,
        sequelize.models[name],
      );

      expect(collectionWithAction.getAction('__action__')).toBeInstanceOf(TestAction);
    });

    it('should throw with an unknown action name', () => {
      const { dataSource, name, sequelize } = makeConstructorParams();
      const collectionWithAction = new CollectionWithAction(
        name,
        dataSource,
        sequelize.models[name],
      );

      expect(() => collectionWithAction.getAction('__no_such_action__')).toThrow(
        'Action "__no_such_action__" not found.',
      );
    });
  });

  describe('getById', () => {
    const setup = () => {
      const { dataSource, name, sequelize } = makeConstructorParams();

      const model = sequelize.models[name];

      model.getAttributes = () => ({
        id: {
          primaryKey: true,
          type: DataTypes.INTEGER,
        },
      });

      const sequelizeCollection = new SequelizeCollection(name, dataSource, model);
      const recordData = Symbol('recordData');
      const record = {
        get: jest.fn(() => recordData),
      };
      const findOne = jest.fn().mockResolvedValue(record);
      model.findOne = findOne;

      return {
        findOne,
        record,
        recordData,
        sequelize,
        sequelizeCollection,
      };
    };

    it('should delegate work to `sequelize.model.findOne`', async () => {
      const { findOne, recordData, sequelizeCollection } = setup();
      const compositeId = [42];
      const projection = new Projection();

      await expect(sequelizeCollection.getById(compositeId, projection)).resolves.toBe(recordData);
      expect(findOne).toHaveBeenCalledWith({
        where: { id: compositeId[0] },
        attributes: projection,
        include: [],
      });
    });

    it('should resolve with a plain record', async () => {
      const { record, recordData, sequelizeCollection } = setup();
      const compositeId = [42];

      const result = await sequelizeCollection.getById(compositeId, new Projection());

      expect(record.get).toHaveBeenCalledWith({ plain: true });
      expect(result).toBe(recordData);
    });
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

      await expect(sequelizeCollection.create(data)).resolves.toEqual([recordData]);
      expect(bulkCreate).toHaveBeenCalledWith(data);
    });
  });

  describe('list', () => {
    const setup = () => {
      const { dataSource, name, sequelize } = makeConstructorParams();
      const sequelizeCollection = new SequelizeCollection(name, dataSource, sequelize.models[name]);
      const recordData = Symbol('recordData');
      const record = {
        get: jest.fn(() => recordData),
      };
      const findAll = jest.fn().mockResolvedValue([record]);
      // eslint-disable-next-line @typescript-eslint/dot-notation
      sequelizeCollection['model'] = {
        ...sequelize.models[name],
        findAll,
      } as unknown as ModelDefined<unknown, unknown>;

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

      const result = await sequelizeCollection.list(filter, projection);

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

      const result = await sequelizeCollection.list(filter, projection);

      expect(result).toBeArrayOfSize(1);
      expect(result[0]).toBe(recordData);
      expect(record.get).toHaveBeenCalledWith({ plain: true });
    });
  });

  describe('update', () => {
    const setup = () => {
      const { dataSource, name, sequelize } = makeConstructorParams();
      const sequelizeCollection = new SequelizeCollection(name, dataSource, sequelize.models[name]);
      const update = jest.fn().mockResolvedValue([]);
      // eslint-disable-next-line @typescript-eslint/dot-notation
      sequelizeCollection['model'] = {
        ...sequelize.models[name],
        update,
      } as unknown as ModelDefined<unknown, unknown>;

      return {
        update,
        sequelizeCollection,
      };
    };

    it('should delegate work to `sequelize.model.update`', async () => {
      const { update, sequelizeCollection } = setup();
      const patch = { field: '__value__' };
      const filter = new Filter({});

      await expect(sequelizeCollection.update(filter, patch)).resolves.not.toThrow();

      expect(update).toHaveBeenCalledWith(
        patch,
        expect.objectContaining({ fields: Object.keys(patch) }),
      );
    });
  });

  describe('delete', () => {
    const setup = () => {
      const { dataSource, name, sequelize } = makeConstructorParams();
      const sequelizeCollection = new SequelizeCollection(name, dataSource, sequelize.models[name]);
      const destroy = jest.fn().mockResolvedValue(0);
      // eslint-disable-next-line @typescript-eslint/dot-notation
      sequelizeCollection['model'] = {
        ...sequelize.models[name],
        destroy,
      } as unknown as ModelDefined<unknown, unknown>;

      return {
        destroy,
        sequelizeCollection,
      };
    };

    it('should delegate work to `sequelize.model.update`', async () => {
      const { destroy, sequelizeCollection } = setup();
      const filter = new Filter({});

      await expect(sequelizeCollection.delete(filter)).resolves.not.toThrow();

      expect(destroy).toHaveBeenCalledTimes(1);
    });
  });

  describe('aggregate', () => {
    const setup = () => {
      const { dataSource, name, sequelize } = makeConstructorParams();
      const sequelizeCollection = new SequelizeCollection(name, dataSource, sequelize.models[name]);
      const findAll = jest.fn().mockResolvedValue([
        {
          __aggregate__: '__aggregate__:value',
          __group_field____grouped__: '__group_field__:value',
          renamed__field____grouped__: 'renamed__field__:value',
          'modelAssociations:as__field____grouped__':
            'modelAssociations:as__field____grouped__:value',
          'modelAssociations:renamed__as__field____grouped__':
            'modelAssociations:renamed__as__field____grouped__:value',
        },
      ]);
      const getAttributes = () => ({
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
      });

      const modelAssociations = {
        target: {
          getAttributes: () => ({
            as__field__: {
              type: DataTypes.STRING,
              field: 'as__field__',
            },
            renamed__as__field__: {
              type: DataTypes.STRING,
              field: 'another__as__field__',
            },
          }),
        },
      };

      // eslint-disable-next-line @typescript-eslint/dot-notation
      sequelizeCollection['model'] = {
        ...sequelize.models[name],
        getAttributes,
        findAll,
        associations: { modelAssociations },
      } as unknown as ModelDefined<unknown, unknown>;

      return {
        findAll,
        sequelize,
        sequelizeCollection,
      };
    };

    describe('whitout aggregate field', () => {
      it('should aggregate on *', async () => {
        const { findAll, sequelizeCollection } = setup();
        const aggregation = new Aggregation({
          operation: AggregationOperation.Sum,
        });
        const filter = new Filter({});

        await expect(sequelizeCollection.aggregate(filter, aggregation)).resolves.toEqual([
          { group: {}, value: '__aggregate__:value' },
        ]);

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
          operation: AggregationOperation.Sum,
        });
        const filter = new Filter({});

        await expect(sequelizeCollection.aggregate(filter, aggregation)).resolves.toEqual([
          { group: {}, value: '__aggregate__:value' },
        ]);

        expect(findAll).toHaveBeenCalledTimes(1);
        expect(findAll).toHaveBeenCalledWith(
          expect.objectContaining({
            attributes: [[{ args: [{ col: 'model.__field__' }], fn: 'SUM' }, '__aggregate__']],
          }),
        );
      });

      describe('with Count operation', () => {
        it('should aggregate on *', async () => {
          const { findAll, sequelizeCollection } = setup();
          const aggregation = new Aggregation({
            field: '__field__',
            operation: AggregationOperation.Count,
          });
          const filter = new Filter({});

          await expect(sequelizeCollection.aggregate(filter, aggregation)).resolves.toEqual([
            { group: {}, value: '__aggregate__:value' },
          ]);

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
            operation: AggregationOperation.Sum,
          });
          const filter = new Filter({});

          await expect(sequelizeCollection.aggregate(filter, aggregation)).resolves.toEqual([
            { group: {}, value: '__aggregate__:value' },
          ]);

          expect(findAll).toHaveBeenCalledTimes(1);
          expect(findAll).toHaveBeenCalledWith(
            expect.objectContaining({
              attributes: [
                [{ args: [{ col: 'model.another__field__' }], fn: 'SUM' }, '__aggregate__'],
              ],
            }),
          );
        });
      });

      describe('when aggregate field is on relation', () => {
        it('should aggregate properly', async () => {
          const { findAll, sequelizeCollection } = setup();
          const aggregation = new Aggregation({
            field: 'modelAssociations:as__field__',
            operation: AggregationOperation.Sum,
          });
          const filter = new Filter({});

          await expect(sequelizeCollection.aggregate(filter, aggregation)).resolves.toEqual([
            { group: {}, value: '__aggregate__:value' },
          ]);

          expect(findAll).toHaveBeenCalledTimes(1);
          expect(findAll).toHaveBeenCalledWith(
            expect.objectContaining({
              attributes: [
                [{ args: [{ col: 'modelAssociations.as__field__' }], fn: 'SUM' }, '__aggregate__'],
              ],
            }),
          );
        });

        it('should add relation to include clause', async () => {
          const { findAll, sequelizeCollection } = setup();
          const aggregation = new Aggregation({
            field: 'modelAssociations:as__field__',
            operation: AggregationOperation.Sum,
          });
          const filter = new Filter({});

          await expect(sequelizeCollection.aggregate(filter, aggregation)).resolves.toEqual([
            { group: {}, value: '__aggregate__:value' },
          ]);

          expect(findAll).toHaveBeenCalledTimes(1);
          expect(findAll).toHaveBeenCalledWith(
            expect.objectContaining({
              include: [
                {
                  association: 'modelAssociations',
                  include: [],
                },
              ],
            }),
          );
        });

        describe('when field name is deferent as column', () => {
          it('should aggregate properly', async () => {
            const { findAll, sequelizeCollection } = setup();
            const aggregation = new Aggregation({
              field: 'modelAssociations:renamed__as__field__',
              operation: AggregationOperation.Sum,
            });
            const filter = new Filter({});

            await expect(sequelizeCollection.aggregate(filter, aggregation)).resolves.toEqual([
              { group: {}, value: '__aggregate__:value' },
            ]);

            expect(findAll).toHaveBeenCalledTimes(1);
            expect(findAll).toHaveBeenCalledWith(
              expect.objectContaining({
                attributes: [
                  [
                    { args: [{ col: 'modelAssociations.another__as__field__' }], fn: 'SUM' },
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
          operation: AggregationOperation.Count,
        });
        const filter = new Filter({
          conditionTree: new ConditionTreeLeaf('id', Operator.Equal, 42),
        });

        await expect(sequelizeCollection.aggregate(filter, aggregation)).resolves.toEqual([
          { group: {}, value: '__aggregate__:value' },
        ]);

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
          operation: AggregationOperation.Count,
          groups: [{ field: '__group_field__' }],
        });
        const filter = new Filter({});

        await expect(sequelizeCollection.aggregate(filter, aggregation)).resolves.toEqual([
          { group: { __group_field__: '__group_field__:value' }, value: '__aggregate__:value' },
        ]);

        expect(findAll).toHaveBeenCalledTimes(1);
        expect(findAll).toHaveBeenCalledWith(
          expect.objectContaining({
            attributes: expect.arrayContaining([
              [{ col: 'model.__group_field__' }, '__group_field____grouped__'],
            ]),
            group: ['__group_field____grouped__'],
          }),
        );
      });

      describe('when field name is deferent as column', () => {
        it('should compute group properly', async () => {
          const { findAll, sequelizeCollection } = setup();
          const aggregation = new Aggregation({
            operation: AggregationOperation.Count,
            groups: [{ field: 'renamed__field__' }],
          });
          const filter = new Filter({});

          await expect(sequelizeCollection.aggregate(filter, aggregation)).resolves.toEqual([
            { group: { renamed__field__: 'renamed__field__:value' }, value: '__aggregate__:value' },
          ]);

          expect(findAll).toHaveBeenCalledTimes(1);
          expect(findAll).toHaveBeenCalledWith(
            expect.objectContaining({
              attributes: expect.arrayContaining([
                [{ col: 'model.another__field__' }, 'renamed__field____grouped__'],
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
            operation: AggregationOperation.Count,
            groups: [{ field: 'modelAssociations:as__field__' }],
          });
          const filter = new Filter({});

          await expect(sequelizeCollection.aggregate(filter, aggregation)).resolves.toEqual([
            {
              group: {
                'modelAssociations:as__field__': 'modelAssociations:as__field____grouped__:value',
              },
              value: '__aggregate__:value',
            },
          ]);

          expect(findAll).toHaveBeenCalledTimes(1);
          expect(findAll).toHaveBeenCalledWith(
            expect.objectContaining({
              attributes: expect.arrayContaining([
                [
                  { col: 'modelAssociations.as__field__' },
                  'modelAssociations:as__field____grouped__',
                ],
              ]),
              group: ['modelAssociations:as__field____grouped__'],
            }),
          );
        });

        it('should add relation to include clause', async () => {
          const { findAll, sequelizeCollection } = setup();
          const aggregation = new Aggregation({
            operation: AggregationOperation.Count,
            groups: [{ field: 'modelAssociations:as__field__' }],
          });
          const filter = new Filter({});

          await expect(sequelizeCollection.aggregate(filter, aggregation)).resolves.toEqual([
            {
              group: {
                'modelAssociations:as__field__': 'modelAssociations:as__field____grouped__:value',
              },
              value: '__aggregate__:value',
            },
          ]);

          expect(findAll).toHaveBeenCalledTimes(1);
          expect(findAll).toHaveBeenCalledWith(
            expect.objectContaining({
              include: [
                {
                  association: 'modelAssociations',
                  include: [],
                },
              ],
            }),
          );
        });

        describe('when field name is deferent as column', () => {
          it('should aggregate properly', async () => {
            const { findAll, sequelizeCollection } = setup();
            const aggregation = new Aggregation({
              operation: AggregationOperation.Count,
              groups: [{ field: 'modelAssociations:renamed__as__field__' }],
            });
            const filter = new Filter({});

            await expect(sequelizeCollection.aggregate(filter, aggregation)).resolves.toEqual([
              {
                group: {
                  'modelAssociations:renamed__as__field__':
                    'modelAssociations:renamed__as__field____grouped__:value',
                },
                value: '__aggregate__:value',
              },
            ]);

            expect(findAll).toHaveBeenCalledTimes(1);
            expect(findAll).toHaveBeenCalledWith(
              expect.objectContaining({
                attributes: expect.arrayContaining([
                  [
                    { col: 'modelAssociations.another__as__field__' },
                    'modelAssociations:renamed__as__field____grouped__',
                  ],
                ]),
                group: ['modelAssociations:renamed__as__field____grouped__'],
              }),
            );
          });
        });
      });

      describe('when group have operations', () => {
        // TODO
        it.todo('should group properly');
      });
    });

    it('should sort on aggragate by default', async () => {
      const { findAll, sequelizeCollection } = setup();
      const aggregation = new Aggregation({
        operation: AggregationOperation.Count,
      });
      const filter = new Filter({});

      await expect(sequelizeCollection.aggregate(filter, aggregation)).resolves.toEqual([
        { group: {}, value: '__aggregate__:value' },
      ]);

      expect(findAll).toHaveBeenCalledTimes(1);
      expect(findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          order: [[{ col: '__aggregate__' }, 'DESC']],
        }),
      );
    });

    describe('with limit option', () => {
      it('should add limit to query', async () => {
        const { findAll, sequelizeCollection } = setup();
        const aggregation = new Aggregation({
          operation: AggregationOperation.Count,
        });
        const filter = new Filter({});
        const limit = 1;

        await expect(
          sequelizeCollection.aggregate(filter, aggregation, limit),
        ).resolves.not.toThrow();

        expect(findAll).toHaveBeenCalledTimes(1);
        expect(findAll).toHaveBeenCalledWith(expect.objectContaining({ limit }));
      });
    });
  });
});
