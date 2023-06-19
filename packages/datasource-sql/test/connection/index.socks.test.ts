import { DatabaseConnectError } from '../../src';
import connect from '../../src/connection';
import ConnectionOptions from '../../src/connection/connection-options';
import setupDatabaseWithTypes from '../_helpers/setup-using-all-types';

describe('when proxy socks configuration is provided', () => {
  describe('when the database password is wrong', () => {
    it('should not block the promise and throw an error', async () => {
      const baseUri = 'postgres://test:password@localhost:5443';
      await setupDatabaseWithTypes(baseUri, 'postgres', 'test_connection');

      const options = new ConnectionOptions({
        uri: `postgres://BADUSER:password@postgres:5432/test_connection`,
        proxySocks: { host: 'localhost', port: 1080, password: 'password', userId: 'username' },
      });

      await expect(() => connect(options)).rejects.toThrow(DatabaseConnectError);
    });
  });

  describe('when the proxy configuration is wrong', () => {
    it('should throw an error', async () => {
      const baseUri = 'postgres://test:password@localhost:5443';
      await setupDatabaseWithTypes(baseUri, 'postgres', 'test_connection');

      const options = new ConnectionOptions({
        uri: `postgres://test:password@postgres:5432/test_connection`,
        proxySocks: { host: 'BADHOST', port: 1080, password: 'password', userId: 'username' },
      });

      await expect(() => connect(options)).rejects.toThrow(
        // eslint-disable-next-line max-len
        'Your proxy has encountered an error. Unable to connect to the given uri: BADHOST:1080',
      );
    });
  });
});
