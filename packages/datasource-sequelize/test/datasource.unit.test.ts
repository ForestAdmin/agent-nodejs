import { QueryTypes, Sequelize } from 'sequelize';

import { SequelizeCollection, SequelizeDataSource } from '../src';

describe('SequelizeDataSource', () => {
  it('should fail to instantiate without a Sequelize instance', () => {
    expect(() => new SequelizeDataSource(null as unknown as Sequelize)).toThrow(
      'Invalid (null) Sequelize instance.',
    );
  });

  it('should fail to instantiate without a Sequelize models defined', () => {
    expect(() => new SequelizeDataSource({} as Sequelize)).toThrow(
      'Invalid (null) Sequelize models.',
    );
  });

  it('should have no predefined collection', () => {
    expect(
      new SequelizeDataSource({ models: {} } as unknown as Sequelize).collections,
    ).toBeArrayOfSize(0);
  });

  it('should have no predefined nativeQueryConnection', () => {
    expect(
      new SequelizeDataSource({ models: {} } as unknown as Sequelize).nativeQueryConnections,
    ).toEqual({});
  });

  it('should create collection based on models', () => {
    const sequelize = new Sequelize({ dialect: 'postgres' });
    sequelize.define('cars', {});

    const datasource = new SequelizeDataSource(sequelize);

    expect(datasource.getCollection('cars')).toBeInstanceOf(SequelizeCollection);
  });

  it('should keep the same collections order', () => {
    const firstSequelize = new Sequelize({ dialect: 'postgres' });
    firstSequelize.define('cars', {});
    firstSequelize.define('owner', {});
    const firstDataSource = new SequelizeDataSource(firstSequelize);

    const secondSequelize = new Sequelize({ dialect: 'postgres' });
    secondSequelize.define('owner', {});
    secondSequelize.define('cars', {});
    const secondDataSource = new SequelizeDataSource(secondSequelize);

    const firstCollectionNames = firstDataSource.collections.map(({ name }) => name);
    const secondCollectionNames = secondDataSource.collections.map(({ name }) => name);

    expect(firstCollectionNames).toStrictEqual(secondCollectionNames);
  });

  it('should register nativeQueryConnection', () => {
    const sequelize = new Sequelize({ dialect: 'postgres' });
    sequelize.define('cars', {});
    const logger = jest.fn();
    const dataSource = new SequelizeDataSource(sequelize, logger, {
      liveQueryConnections: 'main',
    });

    expect(dataSource.nativeQueryConnections).toEqual({ main: { instance: sequelize } });
  });

  describe('executeNativeQuery', () => {
    it('should execute the given query on the correct connection', async () => {
      const sequelize = new Sequelize({ dialect: 'postgres' });
      sequelize.define('cars', {});
      const logger = jest.fn();
      const spyQuery = jest.spyOn(sequelize, 'query').mockImplementation();
      const dataSource = new SequelizeDataSource(sequelize, logger, {
        liveQueryConnections: 'main',
      });

      await dataSource.executeNativeQuery('main', 'query', { something: 'value' });

      expect(spyQuery).toHaveBeenCalled();
      expect(spyQuery).toHaveBeenCalledWith('query', {
        bind: { something: 'value' },
        type: QueryTypes.SELECT,
        raw: true,
      });
    });

    describe('when giving an unknown connection name', () => {
      it('should throw an error', async () => {
        const sequelize = new Sequelize({ dialect: 'postgres' });
        sequelize.define('cars', {});
        const logger = jest.fn();
        const spyQuery = jest.spyOn(sequelize, 'query').mockImplementation();
        const dataSource = new SequelizeDataSource(sequelize, logger, {
          liveQueryConnections: 'main',
        });

        await expect(
          dataSource.executeNativeQuery('production', 'query', { something: 'value' }),
        ).rejects.toThrow(new Error(`Unknown connection name 'production'`));
        expect(spyQuery).not.toHaveBeenCalled();
      });
    });
  });
});
