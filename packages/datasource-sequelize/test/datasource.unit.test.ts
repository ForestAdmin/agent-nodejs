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

  describe('schema.databases', () => {
    it('should report the postgres dialect and database name', () => {
      const sequelize = new Sequelize(
        'postgres://SENTINEL_USER:SENTINEL_SECRET@SENTINEL_HOST:5432/mydb',
      );

      expect(new SequelizeDataSource(sequelize).schema.databases).toStrictEqual([
        { type: 'postgres', name: 'mydb' },
      ]);
    });

    it('should report the mysql dialect and database name', () => {
      const sequelize = new Sequelize(
        'mysql://SENTINEL_USER:SENTINEL_SECRET@SENTINEL_HOST:3306/mydb',
      );

      expect(new SequelizeDataSource(sequelize).schema.databases).toStrictEqual([
        { type: 'mysql', name: 'mydb' },
      ]);
    });

    it('should leak no credential from the connection string', () => {
      const sequelize = new Sequelize(
        'postgres://SENTINEL_USER:SENTINEL_SECRET@SENTINEL_HOST:5432/mydb',
      );
      const serialized = JSON.stringify(new SequelizeDataSource(sequelize).schema.databases);

      expect(serialized).not.toContain('SENTINEL_USER');
      expect(serialized).not.toContain('SENTINEL_SECRET');
      expect(serialized).not.toContain('SENTINEL_HOST');
    });

    it('should report the file name for an absolute sqlite storage', () => {
      const sequelize = new Sequelize({ dialect: 'sqlite', storage: '/abs/dir/app.db' });

      expect(new SequelizeDataSource(sequelize).schema.databases).toStrictEqual([
        { type: 'sqlite', name: 'app.db' },
      ]);
    });

    it('should report the file name for a relative sqlite uri', () => {
      const sequelize = new Sequelize('sqlite:./rel/app.db');

      expect(new SequelizeDataSource(sequelize).schema.databases).toStrictEqual([
        { type: 'sqlite', name: 'app.db' },
      ]);
    });

    it('should report the file name for a windows sqlite storage', () => {
      const sequelize = new Sequelize({ dialect: 'sqlite', storage: 'C:\\data\\app.db' });

      expect(new SequelizeDataSource(sequelize).schema.databases).toStrictEqual([
        { type: 'sqlite', name: 'app.db' },
      ]);
    });

    it('should report the file name for a sqlite host instead of a storage', () => {
      const sequelize = new Sequelize({ dialect: 'sqlite', host: '/abs/dir/app.db' });

      expect(new SequelizeDataSource(sequelize).schema.databases).toStrictEqual([
        { type: 'sqlite', name: 'app.db' },
      ]);
    });

    it('should report no name for an in-memory sqlite database', () => {
      const sequelize = new Sequelize('sqlite::memory:');

      expect(new SequelizeDataSource(sequelize).schema.databases).toStrictEqual([
        { type: 'sqlite', name: null },
      ]);
    });

    it('should report no name for a sqlite database without storage', () => {
      const sequelize = new Sequelize({ dialect: 'sqlite' });

      expect(new SequelizeDataSource(sequelize).schema.databases).toStrictEqual([
        { type: 'sqlite', name: null },
      ]);
    });

    it('should report the write database over the global fallback when replication is set', () => {
      const sequelize = new Sequelize({
        dialect: 'postgres',
        database: 'fallback',
        replication: { write: { database: 'production' }, read: [{ database: 'replica' }] },
      });

      expect(new SequelizeDataSource(sequelize).schema.databases).toStrictEqual([
        { type: 'postgres', name: 'production' },
      ]);
    });

    it('should report the write database when no global database is set', () => {
      const sequelize = new Sequelize({
        dialect: 'postgres',
        replication: { write: { database: 'production' }, read: [{ database: 'replica' }] },
      });

      expect(new SequelizeDataSource(sequelize).schema.databases).toStrictEqual([
        { type: 'postgres', name: 'production' },
      ]);
    });

    it('should fall back to the global database when the write connection sets none', () => {
      const sequelize = new Sequelize({
        dialect: 'postgres',
        database: 'production',
        replication: { write: { host: 'primary' }, read: [{ host: 'replica' }] },
      });

      expect(new SequelizeDataSource(sequelize).schema.databases).toStrictEqual([
        { type: 'postgres', name: 'production' },
      ]);
    });

    it('should report no name for an explicit null write database', () => {
      const sequelize = {
        models: {},
        getDialect: () => 'postgres',
        config: { database: 'fallback', replication: { write: { database: null } } },
      } as unknown as Sequelize;

      expect(new SequelizeDataSource(sequelize).schema.databases).toStrictEqual([
        { type: 'postgres', name: null },
      ]);
    });

    it('should fall back to the global database when replication sets no write connection', () => {
      const sequelize = {
        models: {},
        getDialect: () => 'postgres',
        config: { database: 'fallback', replication: { read: [{ host: 'replica' }] } },
      } as unknown as Sequelize;

      expect(new SequelizeDataSource(sequelize).schema.databases).toStrictEqual([
        { type: 'postgres', name: 'fallback' },
      ]);
    });

    it('should report a name over 128 characters as null', () => {
      const sequelize = new Sequelize({ dialect: 'postgres', database: 'a'.repeat(129) });

      expect(new SequelizeDataSource(sequelize).schema.databases).toStrictEqual([
        { type: 'postgres', name: null },
      ]);
    });

    it('should report an unmapped dialect as other', () => {
      const sequelize = {
        models: {},
        getDialect: () => 'db2',
        config: { database: 'mydb', replication: false },
      } as unknown as Sequelize;

      expect(new SequelizeDataSource(sequelize).schema.databases).toStrictEqual([
        { type: 'other', name: 'mydb' },
      ]);
    });

    it('should report the database set through the uri query string on mysql', () => {
      const sequelize = new Sequelize(
        'mysql://SENTINEL_USER:SENTINEL_SECRET@SENTINEL_HOST:3306/fallback?database=production',
      );
      const { schema } = new SequelizeDataSource(sequelize);

      expect(schema.databases).toStrictEqual([{ type: 'mysql', name: 'production' }]);
      expect(JSON.stringify(schema.databases)).not.toContain('SENTINEL_');
    });

    it('should ignore a dialectOptions database on dialects that do not read it', () => {
      const sequelize = {
        models: {},
        getDialect: () => 'postgres',
        config: { database: 'pathdb', dialectOptions: { database: 'other' }, replication: false },
      } as unknown as Sequelize;

      expect(new SequelizeDataSource(sequelize).schema.databases).toStrictEqual([
        { type: 'postgres', name: 'pathdb' },
      ]);
    });

    it('should report the nested options database on mssql', () => {
      const sequelize = {
        models: {},
        getDialect: () => 'mssql',
        config: {
          database: 'fallback',
          dialectOptions: { options: { database: 'real' } },
          replication: false,
        },
      } as unknown as Sequelize;

      expect(new SequelizeDataSource(sequelize).schema.databases).toStrictEqual([
        { type: 'mssql', name: 'real' },
      ]);
    });

    it('should report the config database on mssql without a nested override', () => {
      const sequelize = {
        models: {},
        getDialect: () => 'mssql',
        config: { database: 'plain', replication: false },
      } as unknown as Sequelize;

      expect(new SequelizeDataSource(sequelize).schema.databases).toStrictEqual([
        { type: 'mssql', name: 'plain' },
      ]);
    });

    it('should leak no host from an oracle connect descriptor used as database name', () => {
      const sequelize = {
        models: {},
        getDialect: () => 'oracle',
        config: { database: 'SENTINEL_HOST:1521/SERVICE', host: '', replication: false },
      } as unknown as Sequelize;

      expect(new SequelizeDataSource(sequelize).schema.databases).toStrictEqual([
        { type: 'oracle', name: null },
      ]);
      expect(JSON.stringify(new SequelizeDataSource(sequelize).schema.databases)).not.toContain(
        'SENTINEL_HOST',
      );
    });

    it('should leak no host from an oracle description descriptor used as database name', () => {
      const sequelize = {
        models: {},
        getDialect: () => 'oracle',
        config: {
          database:
            '(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=SENTINEL_HOST)(PORT=1521))(CONNECT_DATA=(SERVICE_NAME=ORCL)))',
          host: '',
          replication: false,
        },
      } as unknown as Sequelize;

      expect(new SequelizeDataSource(sequelize).schema.databases).toStrictEqual([
        { type: 'oracle', name: null },
      ]);
      expect(JSON.stringify(new SequelizeDataSource(sequelize).schema.databases)).not.toContain(
        'SENTINEL_HOST',
      );
    });

    it('should leak no host from an oracle connect string overriding the database', () => {
      const sequelize = {
        models: {},
        getDialect: () => 'oracle',
        config: {
          database: 'ORCL',
          host: 'db-host',
          dialectOptions: { connectString: 'SENTINEL_HOST:1521/OTHER' },
          replication: false,
        },
      } as unknown as Sequelize;

      expect(new SequelizeDataSource(sequelize).schema.databases).toStrictEqual([
        { type: 'oracle', name: null },
      ]);
      expect(JSON.stringify(new SequelizeDataSource(sequelize).schema.databases)).not.toContain(
        'SENTINEL_HOST',
      );
    });

    it('should report a plain oracle service name', () => {
      const sequelize = {
        models: {},
        getDialect: () => 'oracle',
        config: { database: 'ORCL', host: 'db-host', replication: false },
      } as unknown as Sequelize;

      expect(new SequelizeDataSource(sequelize).schema.databases).toStrictEqual([
        { type: 'oracle', name: 'ORCL' },
      ]);
    });
  });

  describe('executeNativeQuery', () => {
    const setup = (dialect: 'postgres' | 'mssql' | 'sqlite', storage?: string) => {
      const sequelize = new Sequelize({ dialect, storage });
      sequelize.define('cars', {});
      const transaction = { rollback: jest.fn().mockResolvedValue(undefined) };
      const spyTransaction = jest
        .spyOn(sequelize, 'transaction')
        .mockResolvedValue(transaction as never);
      const spyQuery = jest.spyOn(sequelize, 'query').mockResolvedValue([{ id: 1 }] as never);
      const dataSource = new SequelizeDataSource(sequelize, jest.fn(), {
        liveQueryConnections: 'main',
      });

      return { dataSource, spyQuery, spyTransaction, transaction };
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

    it('should open a read-only transaction, so it may run on a read replica', async () => {
      const { dataSource, spyTransaction } = setup('mssql');

      await dataSource.executeNativeQuery('main', 'query');

      expect(spyTransaction).toHaveBeenCalledWith({ readOnly: true });
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

    it('should run the query outside a transaction on an in-memory sqlite database', async () => {
      const { dataSource, spyQuery, transaction } = setup('sqlite', ':memory:');

      const rows = await dataSource.executeNativeQuery('main', 'query', { something: 'value' });

      expect(rows).toEqual([{ id: 1 }]);
      expect(spyQuery).toHaveBeenCalledWith('query', {
        bind: { something: 'value' },
        type: QueryTypes.SELECT,
        raw: true,
      });
      expect(transaction.rollback).not.toHaveBeenCalled();
    });

    it('should run the query outside a transaction on a sqlite database with no storage', async () => {
      const { dataSource, spyQuery, spyTransaction } = setup('sqlite');

      await dataSource.executeNativeQuery('main', 'query');

      expect(spyQuery).toHaveBeenCalledWith('query', {
        bind: {},
        type: QueryTypes.SELECT,
        raw: true,
      });
      expect(spyTransaction).not.toHaveBeenCalled();
    });

    it('should run the query outside a transaction on a temporary sqlite database', async () => {
      const { dataSource, spyQuery, transaction } = setup('sqlite', '');

      await dataSource.executeNativeQuery('main', 'query');

      expect(spyQuery).toHaveBeenCalledWith('query', {
        bind: {},
        type: QueryTypes.SELECT,
        raw: true,
      });
      expect(transaction.rollback).not.toHaveBeenCalled();
    });

    it('should run the query in a rolled back transaction on a sqlite file', async () => {
      const { dataSource, spyQuery, transaction } = setup('sqlite', '/data/app.sqlite');

      await dataSource.executeNativeQuery('main', 'query');

      expect(spyQuery).toHaveBeenCalledWith('query', expect.objectContaining({ transaction }));
      expect(transaction.rollback).toHaveBeenCalledTimes(1);
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
