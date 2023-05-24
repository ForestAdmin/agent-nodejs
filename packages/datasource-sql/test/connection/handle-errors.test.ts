import { Dialect } from 'sequelize';

import connect from '../../src/connection';
import { DatabaseError, ProxyError } from '../../src/connection/errors';
import { handleErrorsWithProxy } from '../../src/connection/handle-errors';
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
          it('should throw an DatabaseError error', async () => {
            await expect(() =>
              connect({
                uri: `${dialect}://${username}:BADPASSWORD@${dockerServiceName}:${port}/${db}`,
                proxySocks,
              }),
            ).rejects.toThrow(DatabaseError);
          });
        });
        describe('without the proxy socks configuration', () => {
          it('should throw an DatabaseError error', async () => {
            await expect(() =>
              connect(`${dialect}://${username}:BADPASSWORD@${host}:${containerPort}/${db}`),
            ).rejects.toThrow(DatabaseError);
          });
        });
      });

      describe('when the user is wrong', () => {
        describe('with the proxy socks configuration', () => {
          it('should throw an DatabaseError error', async () => {
            await expect(() =>
              connect({
                uri: `${dialect}://BADUSER:${password}@${dockerServiceName}:${port}/${db}`,
                proxySocks,
              }),
            ).rejects.toThrow(DatabaseError);
          });
        });

        describe('without the proxy socks configuration', () => {
          it('should throw an DatabaseError error', async () => {
            await expect(() =>
              connect(`${dialect}://BADUSER:${password}@${host}:${containerPort}/${db}`),
            ).rejects.toThrow(DatabaseError);
          });
        });
      });

      describe('when the host is wrong', () => {
        describe('with the proxy socks configuration', () => {
          it('should throw a DatabaseError error', async () => {
            await expect(() =>
              connect({
                uri: `${dialect}://${username}:${password}@BADHOST:${port}/${db}`,
                proxySocks,
              }),
            ).rejects.toThrow(DatabaseError);
          });
        });

        describe('without the proxy socks configuration', () => {
          it('should throw a DatabaseError error', async () => {
            await expect(() =>
              connect(`${dialect}://${username}:${password}@BADHOST:${containerPort}/${db}`),
            ).rejects.toThrow(DatabaseError);
          });
        });
      });

      describe('when the port is wrong', () => {
        describe('with the proxy socks configuration', () => {
          it('should throw an DatabaseError error', async () => {
            await expect(() =>
              connect({
                uri: `${dialect}://${username}:${password}@${dockerServiceName}:9999/${db}`,
                proxySocks,
              }),
            ).rejects.toThrow(DatabaseError);
          });
        });

        describe('without the proxy socks configuration', () => {
          it('should throw an DatabaseError error', async () => {
            await expect(() =>
              connect(`${dialect}://${username}:${password}@${host}:9999/${db}`),
            ).rejects.toThrow(DatabaseError);
          });
        });
      });

      describe('when the database is wrong', () => {
        describe('with the proxy socks configuration', () => {
          it('should throw a DatabaseError error', async () => {
            await expect(() =>
              connect({
                uri: `${dialect}://${username}:${password}@${dockerServiceName}:${port}/BADDB`,
                proxySocks,
              }),
            ).rejects.toThrow(DatabaseError);
          });
        });

        describe('without the proxy socks configuration', () => {
          it('should throw a DatabaseError error', async () => {
            await expect(() =>
              connect(`${dialect}://${username}:${password}@${host}:${containerPort}/BADDB`),
            ).rejects.toThrow(DatabaseError);
          });
        });
      });
    },
  );

  describe('when a wrong configuration raises a connection timeout', () => {
    describe('with the proxy socks configuration', () => {
      it('should throw a DatabaseError error', async () => {
        await expect(() =>
          connect({
            uri: `postgres://test:password@postgres:5432/test_connection`,
            dialect: 'mysql',
            proxySocks,
          }),
        ).rejects.toThrow(DatabaseError);
      }, 15000);
    });

    describe('without the proxy socks configuration', () => {
      it('should throw a DatabaseError error', async () => {
        await expect(() =>
          connect({
            uri: `postgres://test:password@localhost:5443/test_connection`,

            dialect: 'mysql',
          }),
        ).rejects.toThrow(DatabaseError);
      }, 15000);
    });
  });

  describe('when there is to many connection', () => {
    describe('with the proxy socks configuration', () => {
      it('should throw a DatabaseError error', async () => {
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
          expect(e).toBeInstanceOf(DatabaseError);
        } finally {
          await Promise.all(connections.map(connection => connection.close()));
        }
      }, 10000);
    });

    describe('without the proxy socks configuration', () => {
      it('should throw a DatabaseError error', async () => {
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
          expect(e).toBeInstanceOf(DatabaseError);
        } finally {
          await Promise.all(connections.map(connection => connection.close()));
        }
      }, 10000);
    });
  });

  describe('when the proxy is badly configured', () => {
    const uri = 'postgres://test:password@localhost:5443/test_connection';

    describe('with the wrong port', () => {
      it('should throw a ProxyError error', async () => {
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
        ).rejects.toThrow(ProxyError);
      });
    });

    describe('with the wrong host', () => {
      it('should throw a ProxyError error', async () => {
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
        ).rejects.toThrow(ProxyError);
      });
    });

    describe('with the wrong password', () => {
      it('should throw an ProxyError error', async () => {
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
        ).rejects.toThrow(ProxyError);
      });
    });

    describe('with the wrong userId', () => {
      it('should throw an ProxyError error', async () => {
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
        ).rejects.toThrow(ProxyError);
      });
    });

    describe('with a host that does not support the socks protocol', () => {
      it('should throw a ProxyError error', async () => {
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
        ).rejects.toThrow(ProxyError);
      });
    });

    describe('when fixie proxy close the socket', () => {
      it.skip('should throw a DatabaseError error', async () => {
        await expect(() =>
          connect({
            uri: 'postgres://example:password@5.tcp.eu.ngrok.io:14817/example',
            proxySocks: {
              host: 'bici.usefixie.com',
              port: 1080,
              password: 'TO CHANGE',
              userId: 'fixie',
            },
          }),
        ).rejects.toThrow(DatabaseError);
      });

      it('Unit Test > should throw a DatabaseError error', async () => {
        expect(() =>
          handleErrorsWithProxy(new Error('Socket closed'), uri, {
            host: 'bici.usefixie.com',
            port: 1080,
          }),
        ).toThrow(DatabaseError);
      });
    });
  });
});
