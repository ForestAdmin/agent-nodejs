import { DatabaseConnectError, ProxyConnectError } from '../../src';
import connect from '../../src/connection';
import ConnectionOptions from '../../src/connection/connection-options';
import { POSTGRESQL_DETAILS } from '../_helpers/connection-details';
import createDatabaseIfNotExist from '../_helpers/create-database-if-not-exist';

const proxySocks = { host: 'localhost', port: 1083, password: 'password', userId: 'username' };

describe('when proxy socks configuration is provided', () => {
  beforeAll(async () => {
    await createDatabaseIfNotExist(POSTGRESQL_DETAILS[0].url(), 'test_connection_socks');
  });

  it('should be able to connect at the db', async () => {
    const options = new ConnectionOptions({
      uri: POSTGRESQL_DETAILS[0].urlDocker('test_connection_socks'),
      proxySocks,
    });
    const seq = await connect(options);
    await seq.close();
    // It should not throw
    // In case of an error, using expect().toResolve() do not log the error
    // which is not really helpful
    expect.assertions(0);
  });

  describe('when the database password is wrong', () => {
    it('should not block the promise and throw an error', async () => {
      const parsedUrl = new URL(POSTGRESQL_DETAILS[0].urlDocker('test_connection_socks'));
      parsedUrl.password = 'BADPASSWORD';
      const options = new ConnectionOptions({
        uri: parsedUrl.toString(),
        proxySocks: { host: 'localhost', port: 1083, password: 'password', userId: 'username' },
      });

      await expect(() => connect(options)).rejects.toThrow(DatabaseConnectError);
    });
  });

  describe('when the proxy configuration is wrong', () => {
    it('should throw an error', async () => {
      const options = new ConnectionOptions({
        uri: POSTGRESQL_DETAILS[0].urlDocker(`test_connection_socks`),
        proxySocks: { host: 'BADHOST', port: 1083, password: 'password', userId: 'username' },
      });

      await expect(() => connect(options)).rejects.toThrow(
        // eslint-disable-next-line max-len
        'Your proxy has encountered an error. Unable to connect to the given uri: BADHOST:1083',
      );
    });
  });

  describe('when the proxy is badly configured', () => {
    const uri = POSTGRESQL_DETAILS[0].url('test_connection_socks');

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
