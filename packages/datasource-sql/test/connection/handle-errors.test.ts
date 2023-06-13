import { Dialect, Sequelize } from 'sequelize';

import connect from '../../src/connection';
import ConnectionOptions from '../../src/connection/connection-options';
import { DatabaseConnectError, ProxyConnectError } from '../../src/connection/errors';
import setupDatabaseWithTypes from '../_helpers/setup-using-all-types';

const proxySocks = { host: 'localhost', port: 1080, password: 'password', userId: 'username' };

describe('connect errors', () => {
  describe.each([
    ['postgres' as Dialect, 'test', 'password', 'localhost', 5443, 5432, 'postgres'],
    ['mysql' as Dialect, 'root', 'password', 'localhost', 3307, 3306, 'mysql'],
    ['mssql' as Dialect, 'sa', 'yourStrong(!)Password', 'localhost', 1434, 1433, 'mssql'],
    ['mariadb' as Dialect, 'root', 'password', 'localhost', 3809, 3306, 'mariadb'],
  ])(
    'on %s database',
    (dialect, username, password, host, containerPort, port, dockerServiceName) => {
      const db = `test_connection`;

      beforeEach(async () => {
        await setupDatabaseWithTypes(
          `${dialect}://${username}:${password}@${host}:${containerPort}`,
          dialect,
          db,
        );
      });

      describe.each([
        ['password', `${dialect}://${username}:BADPASSWORD@${dockerServiceName}:${port}/${db}`],
        ['user', `${dialect}://BADUSER:${password}@${dockerServiceName}:${port}/${db}`],
        ['host', `${dialect}://${username}:${password}@BADHOST:${port}/${db}`],
        ['port', `${dialect}://${username}:${password}@${dockerServiceName}:9999/${db}`],
        ['database', `${dialect}://${username}:${password}@${dockerServiceName}:${port}/BADDB`],
      ])('when the %s is wrong', (errorText, uri) => {
        describe.each([
          ['with the proxy socks configuration', proxySocks],
          ['without the proxy socks configuration', undefined],
        ])('%s', (proxyText, proxySockValue) => {
          it('should throw an DatabaseConnectError error', async () => {
            const options = new ConnectionOptions({ uri, proxySocks: proxySockValue });

            await expect(() => connect(options)).rejects.toThrow(DatabaseConnectError);
          });
        });
      });
    },
  );

  describe('when a wrong configuration raises a connection timeout', () => {
    describe.each([
      ['with the proxy socks configuration', proxySocks],
      ['without the proxy socks configuration', undefined],
    ])('%s', (proxyText, proxySockValue) => {
      it('should throw a DatabaseConnectError error', async () => {
        const options = new ConnectionOptions({
          uri: `mysql://test:password@postgres:5432/test_connection`,
          proxySocks: proxySockValue,
        });

        await expect(() => connect(options)).rejects.toThrow(DatabaseConnectError);
      }, 15000);
    });
  });

  describe('when there are too many connection', () => {
    describe.each([
      ['with the proxy socks configuration', proxySocks],
      ['without the proxy socks configuration', undefined],
    ])('%s', (_, proxySockValue) => {
      it('should throw a DatabaseConnectError error', async () => {
        expect.assertions(1);
        const maxConnections = 100;
        const connections: Sequelize[] = [];
        const options = new ConnectionOptions({
          uri: `postgres://test:password@postgres:5432/test_connection`,
          proxySocks: proxySockValue,
        });

        try {
          for (let i = 0; i < maxConnections + 1; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            connections.push(await connect(options));
          }
        } catch (e) {
          // eslint-disable-next-line jest/no-conditional-expect
          expect(e).toBeInstanceOf(DatabaseConnectError);
        } finally {
          await Promise.all(connections.map(connection => connection.close()));
        }
      }, 10000);
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
          proxySocks: { host: 'google.com', port: 1080, password: 'password', userId: 'username' },
        });

        await expect(() => connect(options)).rejects.toThrow(ProxyConnectError);
      });
    });

    // eslint-disable-next-line jest/no-disabled-tests
    describe.skip('when fixie proxy close the socket', () => {
      // This test is disabled because it requires a fixie proxy to be configured
      // and we can't reproduce the use case with the local proxy that is in the docker-compose
      it('should throw a DatabaseConnectError error', async () => {
        const options = new ConnectionOptions({
          uri: 'postgres://example:password@5.tcp.eu.ngrok.io:14817/example',
          proxySocks: {
            host: 'bici.usefixie.com',
            port: 1080,
            password: 'TO CHANGE, go to heroku to get a value',
            userId: 'fixie',
          },
        });

        await expect(() => connect(options)).rejects.toThrow(DatabaseConnectError);
      });
    });
  });
});
