import { Sequelize } from 'sequelize';

import { buildSequelizeInstance, createSqlDataSource, preprocessOptions } from '../src';
import { PlainConnectionOptionsOrUri } from '../src/types';

jest.mock('sequelize');

describe('index', () => {
  describe('createSqlDataSource', () => {
    describe('when the connection Uri is invalid', () => {
      test('should throw an error', async () => {
        const factory = createSqlDataSource('invalid');
        const logger = jest.fn();

        await expect(() => factory(logger, jest.fn())).rejects.toThrow(
          'Connection Uri "invalid" provided to SQL data source is not valid.' +
            ' Should be <dialect>://<connection>.',
        );
      });
    });

    describe('when the connection Uri is valid', () => {
      test('should return a data source factory', () => {
        const factory = createSqlDataSource('postgres://');

        expect(factory).toBeInstanceOf(Function);
      });
    });

    describe('when the introspection version is not handled', () => {
      test('should throw an error', async () => {
        const factory = createSqlDataSource('postgres://', {
          introspection: {
            tables: [],
            version: 2255345234 as 3,
            source: '@forestadmin/datasource-sql',
            views: [],
          },
        });
        const logger = jest.fn();

        await expect(() => factory(logger, jest.fn())).rejects.toThrow(
          `This version of introspection is newer than this package version. ` +
            'Please update @forestadmin/datasource-sql',
        );
      });
    });
  });

  describe('buildSequelizeInstance', () => {
    beforeEach(() => jest.resetAllMocks());

    describe('when a database schema is given from uri string', () => {
      it('should use the given schema', async () => {
        const uri = 'postgres://example:password@localhost:5442/example?schema=public&ssl=true';
        await buildSequelizeInstance(uri, jest.fn(), {
          tables: [],
          version: 3,
          views: [],
          source: '@forestadmin/datasource-sql',
        });

        expect(Sequelize).toHaveBeenCalledWith(uri, {
          logging: expect.any(Function),
          schema: 'public',
          dialect: 'postgres',
          dialectOptions: {},
        });
      });
    });

    describe('when a database schema is given from uri options', () => {
      it('should use the given schema', async () => {
        const uri = 'postgres://example:password@localhost:5442/example?schema=public&ssl=true';
        await buildSequelizeInstance({ uri } as PlainConnectionOptionsOrUri, jest.fn(), {
          views: [],
          tables: [],
          version: 3,
          source: '@forestadmin/datasource-sql',
        });

        expect(Sequelize).toHaveBeenCalledWith(uri, {
          logging: expect.any(Function),
          schema: 'public',
          dialect: 'postgres',
          dialectOptions: {},
        });
      });
    });

    describe('when a database schema is not given', () => {
      it('should not use a schema', async () => {
        const uri = 'postgres://example:password@localhost:5442/example';
        await buildSequelizeInstance(uri, jest.fn(), {
          views: [],
          tables: [],
          version: 3,
          source: '@forestadmin/datasource-sql',
        });

        expect(Sequelize).toHaveBeenCalledWith(uri, {
          logging: expect.any(Function),
          schema: null,
          dialect: 'postgres',
          dialectOptions: {},
        });
      });
    });
  });

  describe('preprocessOptions', () => {
    test('generate an object with dialect and sslmode from uri', async () => {
      const result = await preprocessOptions('postgres://example:password@localhost:5442/example');

      expect(result).toStrictEqual({
        dialect: 'postgres',
        sslMode: 'manual',
        uri: 'postgres://example:password@localhost:5442/example',
      });
    });

    test('generate an object with dialect and sslmode from object', async () => {
      const result = await preprocessOptions({
        database: 'example',
        dialect: 'postgres',
        host: 'localhost',
        password: 'password',
        port: 5442,
        sslMode: 'required',
        username: 'example',
      } as PlainConnectionOptionsOrUri);

      expect(result).toStrictEqual({
        database: 'example',
        dialect: 'postgres',
        host: 'localhost',
        password: 'password',
        port: 5442,
        sslMode: 'required',
        username: 'example',
      });
    });
  });
});
