import { ConnectionError } from 'sequelize';

import { ProxyConnectError, SshConnectError } from '../../dist';
import { ProxyForwardError, SshForwardError } from '../../src';
import ConnectionOptions from '../../src/connection/connection-options';
import handleErrors from '../../src/connection/handle-errors';

const optionsWithOnlyDatabase = new ConnectionOptions({
  uri: 'postgres://localhost:5432/db',
});

const optionsWithDatabaseAndProxy = new ConnectionOptions({
  uri: 'postgres://user:password@localhost:5432/db',
  proxySocks: { host: 'localhost', port: 1083 },
});

const optionsWithDatabaseAndProxyAndSsh = new ConnectionOptions({
  uri: 'postgres://user:password@localhost:5432/db',
  proxySocks: { host: 'localhost', port: 1083 },
  ssh: { host: 'ssh-server', port: 2222, username: 'forest' },
});

describe('handleErrors', () => {
  describe('when the error is thrown by Sequelize', () => {
    it('should throw an error', () => {
      const error = new ConnectionError(new Error('Connection timed out'));

      expect(() => handleErrors(error, optionsWithOnlyDatabase)).toThrow(
        // eslint-disable-next-line max-len
        'Unable to connect to the given uri: postgres://localhost:5432/db.\n' +
          'Connection error: Connection timed out',
      );
    });
  });

  describe('when the error is thrown by the proxy', () => {
    describe('when the proxy has an error when forwarded', () => {
      describe('when it forwards to a database', () => {
        it('should throw an error', () => {
          const error = new ProxyForwardError('Socket closed', 'localhost:5432');

          expect(() => handleErrors(error, optionsWithDatabaseAndProxy)).toThrow(
            'Unable to connect to the given uri: localhost:5432.',
          );
        });
      });

      describe('when it forwards to a ssh', () => {
        it('should throw an error', () => {
          const error = new ProxyForwardError('Socket closed', 'localhost:5432');

          expect(() => handleErrors(error, optionsWithDatabaseAndProxyAndSsh)).toThrow(
            // eslint-disable-next-line max-len
            'Your ssh connection has encountered an error. Unable to connect to the given ssh uri: localhost:5432',
          );
        });
      });
    });

    describe('when the proxy has an error when connected', () => {
      it('should throw an error', () => {
        const error = new ProxyConnectError('Socket closed', 'localhost:1083');

        expect(() => handleErrors(error, optionsWithDatabaseAndProxy)).toThrow(
          'Unable to connect to the given uri: localhost:1083.',
        );
      });
    });
  });

  describe('when the error is thrown by the ssh', () => {
    it('should throw an error', () => {
      const error = new SshConnectError('Socket closed', 'localhost:1083');

      expect(() => handleErrors(error, optionsWithDatabaseAndProxyAndSsh)).toThrow(
        // eslint-disable-next-line max-len
        'Your ssh connection has encountered an error. Unable to connect to the given ssh uri: localhost:1083',
      );
    });

    describe('when the ssh has an error when forwarded', () => {
      it('should throw an error', () => {
        const error = new SshForwardError('Socket closed', 'localhost:1083');

        expect(() => handleErrors(error, optionsWithDatabaseAndProxyAndSsh)).toThrow(
          // eslint-disable-next-line max-len
          'Unable to connect to the given uri: localhost:1083',
        );
      });
    });
  });

  describe('when the error is thrown by the database', () => {
    it('should throw an error', () => {
      const error = new ConnectionError(new Error('Connection timed out'));

      expect(() => handleErrors(error, optionsWithOnlyDatabase)).toThrow(
        // eslint-disable-next-line max-len
        'Unable to connect to the given uri: postgres://localhost:5432/db.\nConnection error: Connection timed out',
      );
    });
  });
});
