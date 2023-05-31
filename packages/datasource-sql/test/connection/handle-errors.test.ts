import { Dialect } from 'sequelize';

import connect from '../../src/connection';
import { DatabaseConnectError, ProxyConnectError } from '../../src/connection/errors';
import setupDatabaseWithTypes from '../_helpers/setup-using-all-types';

describe('connect errors', () => {
  const proxySocks = {
    host: 'localhost',
    port: 1080,
    password: 'password',
    userId: 'username',
  };

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
          'test_connection',
        );
      });

      describe('when the password is wrong', () => {
        describe('with the proxy socks configuration', () => {
          it('should throw an DatabaseConnectError error', async () => {
            await expect(() =>
              connect({
                uri: `${dialect}://${username}:BADPASSWORD@${dockerServiceName}:${port}/${db}`,
                proxySocks,
              }),
            ).rejects.toThrow(DatabaseConnectError);
          });
        });
        describe('without the proxy socks configuration', () => {
          it('should throw an DatabaseConnectError error', async () => {
            await expect(() =>
              connect(`${dialect}://${username}:BADPASSWORD@${host}:${containerPort}/${db}`),
            ).rejects.toThrow(DatabaseConnectError);
          });
        });
      });

      describe('when the user is wrong', () => {
        describe('with the proxy socks configuration', () => {
          it('should throw an DatabaseConnectError error', async () => {
            await expect(() =>
              connect({
                uri: `${dialect}://BADUSER:${password}@${dockerServiceName}:${port}/${db}`,
                proxySocks,
              }),
            ).rejects.toThrow(DatabaseConnectError);
          });
        });

        describe('without the proxy socks configuration', () => {
          it('should throw an DatabaseConnectError error', async () => {
            await expect(() =>
              connect(`${dialect}://BADUSER:${password}@${host}:${containerPort}/${db}`),
            ).rejects.toThrow(DatabaseConnectError);
          });
        });
      });

      describe('when the host is wrong', () => {
        describe('with the proxy socks configuration', () => {
          it('should throw a DatabaseConnectError error', async () => {
            await expect(() =>
              connect({
                uri: `${dialect}://${username}:${password}@BADHOST:${port}/${db}`,
                proxySocks,
              }),
            ).rejects.toThrow(DatabaseConnectError);
          });
        });

        describe('without the proxy socks configuration', () => {
          it('should throw a DatabaseConnectError error', async () => {
            await expect(() =>
              connect(`${dialect}://${username}:${password}@BADHOST:${containerPort}/${db}`),
            ).rejects.toThrow(DatabaseConnectError);
          });
        });
      });

      describe('when the port is wrong', () => {
        describe('with the proxy socks configuration', () => {
          it('should throw an DatabaseConnectError error', async () => {
            await expect(() =>
              connect({
                uri: `${dialect}://${username}:${password}@${dockerServiceName}:9999/${db}`,
                proxySocks,
              }),
            ).rejects.toThrow(DatabaseConnectError);
          });
        });

        describe('without the proxy socks configuration', () => {
          it('should throw an DatabaseConnectError error', async () => {
            await expect(() =>
              connect(`${dialect}://${username}:${password}@${host}:9999/${db}`),
            ).rejects.toThrow(DatabaseConnectError);
          });
        });
      });

      describe('when the database is wrong', () => {
        describe('with the proxy socks configuration', () => {
          it('should throw a DatabaseConnectError error', async () => {
            await expect(() =>
              connect({
                uri: `${dialect}://${username}:${password}@${dockerServiceName}:${port}/BADDB`,
                proxySocks,
              }),
            ).rejects.toThrow(DatabaseConnectError);
          });
        });

        describe('without the proxy socks configuration', () => {
          it('should throw a DatabaseConnectError error', async () => {
            await expect(() =>
              connect(`${dialect}://${username}:${password}@${host}:${containerPort}/BADDB`),
            ).rejects.toThrow(DatabaseConnectError);
          });
        });
      });
    },
  );

  describe('when a wrong configuration raises a connection timeout', () => {
    describe('with the proxy socks configuration', () => {
      it('should throw a DatabaseConnectError error', async () => {
        await expect(() =>
          connect({
            uri: `postgres://test:password@postgres:5432/test_connection`,
            dialect: 'mysql',
            proxySocks,
          }),
        ).rejects.toThrow(DatabaseConnectError);
      }, 15000);
    });

    describe('without the proxy socks configuration', () => {
      it('should throw a DatabaseConnectError error', async () => {
        await expect(() =>
          connect({
            uri: `postgres://test:password@localhost:5443/test_connection`,

            dialect: 'mysql',
          }),
        ).rejects.toThrow(DatabaseConnectError);
      }, 15000);
    });
  });

  describe('when there is to many connection', () => {
    describe('with the proxy socks configuration', () => {
      it('should throw a DatabaseConnectError error', async () => {
        expect.assertions(1);
        const maxConnections = 100;
        const connections = [];

        try {
          for (let i = 0; i < maxConnections + 1; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            const connection = await connect({
              uri: `postgres://test:password@postgres:5432/test_connection`,
              proxySocks,
            });
            connections.push(connection);
          }
        } catch (e) {
          // eslint-disable-next-line jest/no-conditional-expect
          expect(e).toBeInstanceOf(DatabaseConnectError);
        } finally {
          await Promise.all(connections.map(connection => connection.close()));
        }
      }, 10000);
    });

    describe('without the proxy socks configuration', () => {
      it('should throw a DatabaseConnectError error', async () => {
        expect.assertions(1);
        const maxConnections = 100;
        const connections = [];

        try {
          for (let i = 0; i < maxConnections + 1; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            const connection = await connect(
              `postgres://test:password@localhost:5443/test_connection`,
            );
            connections.push(connection);
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

    describe('with the wrong port', () => {
      it('should throw a ProxyConnectError error', async () => {
        await expect(() =>
          connect({
            uri,
            proxySocks: {
              host: 'localhost',
              port: 10,
              password: 'password',
              userId: 'username',
            },
          }),
        ).rejects.toThrow(ProxyConnectError);
      });
    });

    describe('with the wrong host', () => {
      it('should throw a ProxyConnectError error', async () => {
        await expect(() =>
          connect({
            uri,
            proxySocks: {
              host: 'BADHOST',
              port: 1080,
              password: 'password',
              userId: 'username',
            },
          }),
        ).rejects.toThrow(ProxyConnectError);
      });
    });

    describe('with the wrong password', () => {
      it('should throw an ProxyConnectError error', async () => {
        await expect(() =>
          connect({
            uri,
            proxySocks: {
              host: 'localhost',
              port: 1080,
              password: 'BADPASSWORD',
              userId: 'username',
            },
          }),
        ).rejects.toThrow(ProxyConnectError);
      });
    });

    describe('with the wrong userId', () => {
      it('should throw an ProxyConnectError error', async () => {
        await expect(() =>
          connect({
            uri,
            proxySocks: {
              host: 'localhost',
              port: 1080,
              password: 'password',
              userId: 'BADUSER',
            },
          }),
        ).rejects.toThrow(ProxyConnectError);
      });
    });

    describe('with a host that does not support the socks protocol', () => {
      it('should throw a ProxyConnectError error', async () => {
        await expect(() =>
          connect({
            uri,
            proxySocks: {
              host: 'google.com',
              port: 1080,
              password: 'password',
              userId: 'username',
            },
          }),
        ).rejects.toThrow(ProxyConnectError);
      });
    });

    describe('when fixie proxy close the socket', () => {
      it.skip('should throw a DatabaseConnectError error', async () => {
        await expect(() =>
          connect({
            uri: 'postgres://example:password@5.tcp.eu.ngrok.io:14817/example',
            proxySocks: {
              host: 'bici.usefixie.com',
              port: 1080,
              password: 'TO CHANGE, go to heroku to get a value',
              userId: 'fixie',
            },
          }),
        ).rejects.toThrow(DatabaseConnectError);
      });
    });
  });

  describe('when the uri is wrong', () => {
    it('should throw a DatabaseConnectError error', async () => {
      await expect(() =>
        connect({
          uri: 'wrong uri',
        }),
      ).rejects.toThrow(DatabaseConnectError);
    });
  });
});
