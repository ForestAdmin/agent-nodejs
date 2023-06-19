import { ConnectionError } from 'sequelize';

import ConnectionOptions from '../../src/connection/connection-options';
import handleErrors from '../../src/connection/handle-errors';
import { SocksProxyServiceError } from '../../src/connection/services/errors';

const optionsWithoutProxy = new ConnectionOptions({
  uri: 'postgres://user:password@localhost:5432/db',
});

const optionsWithProxy = new ConnectionOptions({
  uri: 'postgres://user:password@localhost:5432/db',
  proxySocks: { host: 'localhost', port: 1080 },
});

describe('handleErrors', () => {
  describe('when the error is thrown by Sequelize', () => {
    it('should throw an error', () => {
      const error = new ConnectionError(new Error('Connection timed out'));

      expect(() => handleErrors(error, optionsWithoutProxy)).toThrow(
        // eslint-disable-next-line max-len
        'Unable to connect to the given uri: postgres://localhost:5432/db.\n' +
          'Connection error: Connection timed out',
      );
    });
  });

  describe('when the error has an empty stack trace', () => {
    it('should throw an error', () => {
      const error = new Error('An error');
      error.stack = undefined;
      expect(() => handleErrors(error, optionsWithoutProxy)).toThrow(error);
    });
  });

  describe('when the error is thrown by the proxy', () => {
    describe('when the proxy has an error with database uri', () => {
      it('should throw an error', () => {
        const error = new SocksProxyServiceError(new Error('Socket closed'));
        error.stack = 'SocksClient.connect: Socks connection failed to proxy: Socket closed';

        expect(() => handleErrors(error, optionsWithProxy)).toThrow(
          // eslint-disable-next-line max-len
          'Unable to connect to the given uri: postgres://localhost:5432/db.',
        );
      });
    });

    describe('when the proxy config is null', () => {
      it('should throw an error', () => {
        const error = new SocksProxyServiceError(new Error('An error'));
        error.stack = 'SocksClient.connect: Socks connection failed to proxy: Socket closed';

        expect(() => handleErrors(error, optionsWithProxy)).toThrow(
          'Your proxy has encountered an error. ' +
            'Unable to connect to the given uri: localhost:1080.\nAn error',
        );
      });
    });

    describe('when the proxy has an error', () => {
      it('should throw an error', () => {
        const error = new SocksProxyServiceError(new Error());
        error.stack = 'SocksClient.connect: Socks connection failed to proxy: Connection refused';

        expect(() => handleErrors(error, optionsWithProxy)).toThrow(
          // eslint-disable-next-line max-len
          'Your proxy has encountered an error. Unable to connect to the given uri: localhost:1080',
        );
      });
    });
  });
});
