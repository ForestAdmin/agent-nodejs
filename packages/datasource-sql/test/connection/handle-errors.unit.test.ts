import { ConnectionError } from 'sequelize';

import { handleErrorsWithProxy } from '../../src/connection/handle-errors';

describe('handleErrorsWithProxy', () => {
  describe('when the error is thrown by Sequelize', () => {
    it('should throw a DatabaseError', () => {
      const error = new ConnectionError(new Error('Connection timed out'));
      const databaseUri = 'postgres://user:password@localhost:5432/db';
      const proxyConfig = {
        host: 'localhost',
        port: 1080,
      };
      expect(() => handleErrorsWithProxy(error, databaseUri, proxyConfig)).toThrow(
        // eslint-disable-next-line max-len
        'Unable to connect to the given uri: postgres://user:**sanitizedPassword**@localhost:5432/db\n' +
          'Connection error: Connection timed out',
      );
    });
  });

  describe('when the error is thrown by the proxy', () => {
    describe('when the proxy has an error with database uri', () => {
      it('should throw a DatabaseError', () => {
        const error = new Error('Socket closed');
        const databaseUri = 'postgres://user:password@localhost:5432/db';
        const proxyConfig = {
          host: 'localhost',
          port: 1080,
        };
        expect(() => handleErrorsWithProxy(error, databaseUri, proxyConfig)).toThrow(
          // eslint-disable-next-line max-len
          'Unable to connect to the given uri: postgres://user:**sanitizedPassword**@localhost:5432/db',
        );
      });
    });

    describe('when the proxy has an error', () => {
      it('should throw a ProxyError', () => {
        const error = new Error();
        error.stack = 'SocksClient.connect: Socks connection failed to proxy: Connection refused';
        const databaseUri = 'postgres://user:password@localhost:5432/db';
        const proxyConfig = {
          host: 'localhost',
          port: 1080,
        };
        expect(() => handleErrorsWithProxy(error, databaseUri, proxyConfig)).toThrow(
          // eslint-disable-next-line max-len
          'Your proxy has encountered an error. Unable to connect to the given uri: localhost:1080',
        );
      });
    });
  });
});
