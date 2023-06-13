import { Dialect } from 'sequelize';

import ConnectionOptions from '../../src/connection/connection-options';
import { DatabaseConnectError } from '../../src/connection/errors';

describe('ConnectionOptionsWrapper', () => {
  describe('when url is not parsable', () => {
    it('should throw', () => {
      expect(() => new ConnectionOptions('wrong url')).toThrow(DatabaseConnectError);
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
