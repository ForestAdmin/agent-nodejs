import { ConnectionError } from 'sequelize';

import { handleErrorsWithProxy } from '../../src/connection/handle-errors';

describe('handleErrorsWithProxy', () => {
  describe('when the databaseUri is null', () => {
    it('should throw an error', () => {
      const error = new ConnectionError(new Error('Connection timed out'));
      const databaseUri = null;
      const proxyConfig = {
        host: 'localhost',
        port: 1080,
      };
      expect(() => handleErrorsWithProxy(error, databaseUri, proxyConfig)).toThrow(
        'Connection error: Connection timed out',
      );
    });
  });

  describe('when the error is thrown by Sequelize', () => {
    it('should throw an error', () => {
      const error = new ConnectionError(new Error('Connection timed out'));
      const databaseUri = 'postgres://user:password@localhost:5432/db';
      const proxyConfig = {
        host: 'localhost',
        port: 1080,
      };
      expect(() => handleErrorsWithProxy(error, databaseUri, proxyConfig)).toThrow(
        // eslint-disable-next-line max-len
        'Unable to connect to the given uri: postgres://user:**sanitizedPassword**@localhost:5432/db.\n' +
          'Connection error: Connection timed out',
      );
    });
  });

  describe('when the error is thrown by the proxy', () => {
    describe('when the proxy has an error with database uri', () => {
      it('should throw an error', () => {
        const error = new Error('Socket closed');
        error.stack = 'SocksClient.connect: Socks connection failed to proxy: Socket closed';
        const databaseUri = 'postgres://user:password@localhost:5432/db';
        const proxyConfig = {
          host: 'localhost',
          port: 1080,
        };
        expect(() => handleErrorsWithProxy(error, databaseUri, proxyConfig)).toThrow(
          // eslint-disable-next-line max-len
          'Unable to connect to the given uri: postgres://user:**sanitizedPassword**@localhost:5432/db.',
        );
      });
    });

    describe('when the proxy config is null', () => {
      it('should throw an error', () => {
        const error = new Error('An error');
        error.stack = 'SocksClient.connect: Socks connection failed to proxy: Socket closed';
        const databaseUri = 'postgres://user:password@localhost:5432/db';
        const proxyConfig = null;
        expect(() => handleErrorsWithProxy(error, databaseUri, proxyConfig)).toThrow(
          'Your proxy has encountered an error.\nAn error',
        );
      });
    });

    describe('when the proxy has an error', () => {
      it('should throw an error', () => {
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
