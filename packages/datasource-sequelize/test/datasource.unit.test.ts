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
    const setup = (dialect: 'postgres' | 'mssql') => {
      const sequelize = new Sequelize({ dialect });
      sequelize.define('cars', {});
      const transaction = { rollback: jest.fn().mockResolvedValue(undefined) };
      jest.spyOn(sequelize, 'transaction').mockResolvedValue(transaction as never);
      const spyQuery = jest.spyOn(sequelize, 'query').mockResolvedValue([{ id: 1 }] as never);
      const dataSource = new SequelizeDataSource(sequelize, jest.fn(), {
        liveQueryConnections: 'main',
      });

      return { dataSource, spyQuery, transaction };
    };

    it('should execute the given query on the correct connection, in a transaction', async () => {
      const { dataSource, spyQuery, transaction } = setup('mssql');

      await dataSource.executeNativeQuery('main', 'query', { something: 'value' });

      expect(spyQuery).toHaveBeenCalledWith('query', {
        bind: { something: 'value' },
        type: QueryTypes.SELECT,
        raw: true,
        transaction,
      });
    });

    it('should return the rows and roll the transaction back', async () => {
      const { dataSource, transaction } = setup('mssql');

      const rows = await dataSource.executeNativeQuery('main', 'query');

      expect(rows).toEqual([{ id: 1 }]);
      expect(transaction.rollback).toHaveBeenCalledTimes(1);
    });

    it('should make the transaction read-only on postgres before running the query', async () => {
      const { dataSource, spyQuery, transaction } = setup('postgres');

      await dataSource.executeNativeQuery('main', 'query');

      expect(spyQuery).toHaveBeenNthCalledWith(1, 'SET TRANSACTION READ ONLY', { transaction });
      expect(spyQuery).toHaveBeenNthCalledWith(
        2,
        'query',
        expect.objectContaining({ transaction }),
      );
    });

    it('should not set a read-only transaction outside postgres', async () => {
      const { dataSource, spyQuery } = setup('mssql');

      await dataSource.executeNativeQuery('main', 'query');

      expect(spyQuery).toHaveBeenCalledTimes(1);
      expect(spyQuery).toHaveBeenCalledWith('query', expect.anything());
    });

    it('should roll back and rethrow the query error when the query fails', async () => {
      const { dataSource, spyQuery, transaction } = setup('mssql');
      spyQuery.mockRejectedValue(new Error('syntax error'));

      await expect(dataSource.executeNativeQuery('main', 'query')).rejects.toThrow('syntax error');
      expect(transaction.rollback).toHaveBeenCalledTimes(1);
    });

    it('should report the query error when the rollback fails after it', async () => {
      const { dataSource, spyQuery, transaction } = setup('mssql');
      spyQuery.mockRejectedValue(new Error('syntax error'));
      transaction.rollback.mockRejectedValue(new Error('no transaction'));

      await expect(dataSource.executeNativeQuery('main', 'query')).rejects.toThrow('syntax error');
    });

    it('should fail when the rollback fails after a successful query', async () => {
      const { dataSource, transaction } = setup('mssql');
      transaction.rollback.mockRejectedValue(new Error('no transaction'));

      await expect(dataSource.executeNativeQuery('main', 'query')).rejects.toThrow(
        'no transaction',
      );
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
