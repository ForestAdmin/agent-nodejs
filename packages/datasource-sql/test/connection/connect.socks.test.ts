import { DatabaseConnectError, ProxyConnectError } from '../../src';
import connect from '../../src/connection';
import ConnectionOptions from '../../src/connection/connection-options';
import createDatabaseIfNotExist from '../_helpers/create-database-if-not-exist';

const proxySocks = { host: 'localhost', port: 1083, password: 'password', userId: 'username' };

describe('when proxy socks configuration is provided', () => {
  beforeAll(async () => {
    await createDatabaseIfNotExist('postgres://test:password@localhost:5443', 'test_connection');
  });

  describe('when the database password is wrong', () => {
    it('should not block the promise and throw an error', async () => {
      const options = new ConnectionOptions({
        uri: `postgres://BADUSER:password@postgres:5432/test_connection`,
        proxySocks: { host: 'localhost', port: 1083, password: 'password', userId: 'username' },
      });

      await expect(() => connect(options)).rejects.toThrow(DatabaseConnectError);
    });
  });

  describe('when the proxy configuration is wrong', () => {
    it('should throw an error', async () => {
      const options = new ConnectionOptions({
        uri: `postgres://test:password@postgres:5432/test_connection`,
        proxySocks: { host: 'BADHOST', port: 1083, password: 'password', userId: 'username' },
      });

      await expect(() => connect(options)).rejects.toThrow(
        // eslint-disable-next-line max-len
        'Your proxy has encountered an error. Unable to connect to the given uri: BADHOST:1083',
      );
    });
  });

  describe('when the proxy is badly configured', () => {
    const uri = 'postgres://test:password@localhost:5443/test_connection';

    describe.each([
      ['port', { port: 10 }],
      ['host', { host: 'BADHOST' }],
      ['password', { password: 'BADPASSWORD' }],
      ['userId', { userId: 'BADUSER' }],
    ])('with the wrong %s', (errorText, proxySocksOverride) => {
      it('should throw a ProxyConnectError error', async () => {
        const options = new ConnectionOptions({
          uri,
          proxySocks: { ...proxySocks, ...proxySocksOverride },
        });

        await expect(() => connect(options)).rejects.toThrow(ProxyConnectError);
      });
    });

    describe('with a host that does not support the socks protocol', () => {
      it('should throw a ProxyConnectError error', async () => {
        const options = new ConnectionOptions({
          uri,
          proxySocks: { host: 'google.com', port: 1083, password: 'password', userId: 'username' },
        });

        await expect(() => connect(options)).rejects.toThrow(ProxyConnectError);
      });
    });

    // eslint-disable-next-line jest/no-disabled-tests
    describe.skip('when fixie proxy close the socket', () => {
      // This test is disabled because it requires a fixie proxy to be configured
      // and we can't reproduce the use case: 'Socket closed' error
      // with the local proxy that is in the docker-compose
      it('should throw a DatabaseConnectError error', async () => {
        const options = new ConnectionOptions({
          uri: 'postgres://example:password@badhost:14817/example',
          proxySocks: {
            host: 'bici.usefixie.com',
            port: 1083,
            password: 'TO CHANGE, go to heroku to get a value',
            userId: 'fixie',
          },
        });

        await expect(() => connect(options)).rejects.toThrow(DatabaseConnectError);
      });
    });
  });
});
