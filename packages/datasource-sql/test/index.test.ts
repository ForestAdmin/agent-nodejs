import { Sequelize } from 'sequelize';

import {
  Table,
  buildSequelizeInstance,
  createSqlDataSource,
  parseIntrospectionFromJson,
  transformIntrospectionAsJson,
} from '../src';

jest.mock('sequelize');

describe('index', () => {
  describe('createSqlDataSource', () => {
    describe('when the connection Uri is invalid', () => {
      test('should throw an error', async () => {
        const factory = createSqlDataSource('invalid');
        const logger = jest.fn();

        await expect(() => factory(logger)).rejects.toThrow(
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
  });

  describe('buildSequelizeInstance', () => {
    beforeEach(() => jest.resetAllMocks());

    describe('when a database schema is given from uri string', () => {
      it('should use the given schema', async () => {
        const uri = 'postgres://example:password@localhost:5442/example?schema=public&ssl=true';
        await buildSequelizeInstance(uri, jest.fn(), []);

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
        await buildSequelizeInstance({ uri }, jest.fn(), []);

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
        await buildSequelizeInstance(uri, jest.fn(), []);

        expect(Sequelize).toHaveBeenCalledWith(uri, {
          logging: expect.any(Function),
          schema: null,
          dialect: 'postgres',
          dialectOptions: {},
        });
      });
    });
  });

  describe('transformIntrospectionAsJson', () => {
    it('should return the introspection as string', () => {
      const introspection = [{ columns: [], name: 'AModel', unique: [] }] as Table[];
      expect(transformIntrospectionAsJson(introspection)).toEqual(expect.any(String));
    });
  });

  describe('parseIntrospectionFromJson', () => {
    it('should return the original introspection', () => {
      const introspection = [{ columns: [], name: 'AModel', unique: [] }] as Table[];
      const introspectionInString = transformIntrospectionAsJson(introspection);

      expect(parseIntrospectionFromJson(introspectionInString)).toEqual(introspection);
    });
  });
});
