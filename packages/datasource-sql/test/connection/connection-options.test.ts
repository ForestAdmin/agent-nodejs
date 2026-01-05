import type { PlainConnectionOptionsOrUri } from '../../src/types';
import type { Dialect } from 'sequelize';

import ConnectionOptions from '../../src/connection/connection-options';
import { DatabaseConnectError } from '../../src/connection/errors';

describe('ConnectionOptionsWrapper', () => {
  describe('when using sqlite', () => {
    it.each([
      ['url (memory)', 'sqlite::memory:', 'sqlite::memory:'],
      ['object (memory)', { dialect: 'sqlite', storage: ':memory:' }, 'sqlite::memory:'],
      ['url (file)', 'sqlite:./db.sqlite', 'sqlite:./db.sqlite'],
      ['object (file)', { dialect: 'sqlite', storage: './db.sqlite' }, 'sqlite:./db.sqlite'],
    ])('should work using a %s', (_, plainOptions, debugUrl) => {
      const options = new ConnectionOptions(plainOptions as PlainConnectionOptionsOrUri);

      expect(options.dialect).toEqual('sqlite');
      expect(options.debugDatabaseUri).toEqual(debugUrl);
    });
  });

  describe('when url is not parsable', () => {
    it('should throw when not matching regexp in code', () => {
      expect(() => new ConnectionOptions('wrong url')).toThrow(DatabaseConnectError);
    });

    it('should also throw when matching regexp in code', () => {
      expect(() => new ConnectionOptions(':::://toto')).toThrow(DatabaseConnectError);
    });
  });

  describe('when dialect is missing', () => {
    it('should throw', () => {
      const fn = () =>
        new ConnectionOptions({
          host: 'localhost',
          port: 5432,
          username: 'user',
          password: 'password',
          database: 'db',
        });

      expect(fn).toThrow('Dialect is required');
    });
  });

  describe('when changing host and port', () => {
    describe.each([
      ['connection string', 'postgres://user:password@localhost:5432/db'],
      [
        'connection object',
        {
          dialect: 'postgres',
          host: 'localhost',
          port: 5432,
          username: 'user',
          password: 'password',
          database: 'db',
        },
      ],
    ] as [string, PlainConnectionOptionsOrUri][])('when using a %s', (_, plainOptions) => {
      it('should change the host and port', () => {
        const options = new ConnectionOptions(plainOptions);

        options.changeHostAndPort('new-host', 1234);

        expect(options.host).toEqual('new-host');
        expect(options.port).toEqual(1234);
      });
    });
  });

  describe('when the port is not defined', () => {
    describe.each([
      ['postgres' as Dialect, 5432],
      ['mssql' as Dialect, 1433],
      ['mysql' as Dialect, 3306],
      ['mariadb' as Dialect, 3306],
    ])('when the dialect is %s', (dialect, expectedPort) => {
      it('should return the default port', () => {
        const options = new ConnectionOptions({ dialect, port: undefined });

        expect(options.port).toEqual(expectedPort);
      });
    });

    describe('when the dialect has not default port', () => {
      it('should throw', () => {
        const fn = () => new ConnectionOptions({ dialect: 'db2', port: undefined });

        expect(fn).toThrow('Port is required');
      });
    });
  });
});
