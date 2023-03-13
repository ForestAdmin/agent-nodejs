import { Sequelize } from 'sequelize';

import { buildSequelizeInstance, createSqlDataSource } from '../src';
import Introspector from '../src/introspection/introspector';

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
    describe('when it is a valid connection Uri', () => {
      describe('when a database schema is given', () => {
        it('should use the given schema', async () => {
          Introspector.introspect = jest.fn().mockResolvedValue([]);

          const uri = 'postgres://example:password@localhost:5442/example?schema=public&ssl=true';
          await buildSequelizeInstance(uri, jest.fn(), null);

          // sequelize must be called with the schema
          expect(Sequelize).toHaveBeenCalledWith(uri, {
            logging: expect.any(Function),
            schema: 'public',
          });
        });
      });

      describe('when a database schema is not given', () => {
        it('should not use a schema', async () => {
          Introspector.introspect = jest.fn().mockResolvedValue([]);

          const uri = 'postgres://example:password@localhost:5442/example';
          await buildSequelizeInstance(uri, jest.fn(), null);

          // sequelize must be called without a schema
          expect(Sequelize).toHaveBeenCalledWith(uri, {
            logging: expect.any(Function),
            schema: undefined,
          });
        });
      });
    });
  });
});
