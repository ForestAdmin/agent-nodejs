import connect from '../../src/connection';
import {
  AccessDeniedError,
  ConnectionAcquireTimeoutError,
  DatabaseError,
  HostNotFoundError,
  ProxyError,
  TooManyConnectionError,
} from '../../src/connection/errors';
import { handleErrorsWithProxy } from '../../src/connection/handle-errors';
import setupDatabaseWithTypes from '../_helpers/setup-using-all-types';

describe('connect errors', () => {
  const proxySocks = {
    host: 'localhost',
    port: 1080,
    password: 'password',
    userId: 'username',
  };

  beforeEach(async () => {
    const baseUri = 'postgres://test:password@localhost:5443';
    await setupDatabaseWithTypes(baseUri, 'postgres', 'test_connection');
  });

  describe('when the password is wrong', () => {
    describe('with the proxy socks configuration', () => {
      it('should throw an AccessDeniedError error', async () => {
        await expect(() =>
          connect({
            uri: 'postgres://test:BADPASSWORD@localhost:5443/test_connection',
            proxySocks,
          }),
        ).rejects.toThrow(AccessDeniedError);
      });
    });

    describe('without the proxy socks configuration', () => {
      it('should throw an AccessDeniedError error', async () => {
        await expect(() =>
          connect('postgres://test:BADPASSWORD@localhost:5443/test_connection'),
        ).rejects.toThrow(AccessDeniedError);
      });
    });
  });

  describe('when the user is wrong', () => {
    describe('with the proxy socks configuration', () => {
      it('should throw an AccessDeniedError error', async () => {
        await expect(() =>
          connect({ uri: 'postgres://BADUSER:password@postgres:5432/test_connection', proxySocks }),
        ).rejects.toThrow(AccessDeniedError);
      });
    });

    describe('without the proxy socks configuration', () => {
      it('should throw an AccessDeniedError error', async () => {
        await expect(() =>
          connect('postgres://BADUSER:password@localhost:5443/test_connection'),
        ).rejects.toThrow(AccessDeniedError);
      });
    });
  });

  describe('when the host is wrong', () => {
    describe('with the proxy socks configuration', () => {
      it('should throw a HostNotFoundError error', async () => {
        await expect(() =>
          connect({
            uri: 'postgres://test:password@BADHOST:5443/test_connection',
            proxySocks,
          }),
        ).rejects.toThrow(HostNotFoundError);
      });
    });

    describe('without the proxy socks configuration', () => {
      it('should throw a HostNotFoundError error', async () => {
        await expect(() =>
          connect('postgres://test:password@BADHOST:5443/test_connection'),
        ).rejects.toThrow(HostNotFoundError);
      });
    });
  });

  describe('when the port is wrong', () => {
    describe('with the proxy socks configuration', () => {
      it('should throw an AccessDeniedError error', async () => {
        await expect(() =>
          connect({
            uri: 'postgres://test:password@localhost:9999/test_connection',
            proxySocks,
          }),
        ).rejects.toThrow(AccessDeniedError);
      });
    });

    describe('without the proxy socks configuration', () => {
      it('should throw an AccessDeniedError error', async () => {
        await expect(() =>
          connect('postgres://test:password@localhost:9999/test_connection'),
        ).rejects.toThrow(AccessDeniedError);
      });
    });
  });

  describe('when there is to many connection', () => {
    describe('with the proxy socks configuration', () => {
      it('should throw a TooManyConnectionError error', async () => {
        expect.assertions(1);
        const maxConnections = 100;
        const connections = [];

        try {
          for (let i = 0; i < maxConnections + 1; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            const connection = await connect({
              uri: 'postgres://test:password@postgres:5432/test_connection',
              proxySocks,
            });
            connections.push(connection);
          }
        } catch (e) {
          // eslint-disable-next-line jest/no-conditional-expect
          expect(e).toBeInstanceOf(TooManyConnectionError);
        } finally {
          await Promise.all(connections.map(connection => connection.close()));
        }
      }, 10000);
    });

    describe('without the proxy socks configuration', () => {
      it('should throw a TooManyConnectionError error', async () => {
        expect.assertions(1);
        const maxConnections = 100;
        const connections = [];

        try {
          for (let i = 0; i < maxConnections + 1; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            const connection = await connect(
              'postgres://test:password@localhost:5443/test_connection',
            );
            connections.push(connection);
          }
        } catch (e) {
          // eslint-disable-next-line jest/no-conditional-expect
          expect(e).toBeInstanceOf(TooManyConnectionError);
        } finally {
          await Promise.all(connections.map(connection => connection.close()));
        }
      }, 10000);
    });
  });

  describe('when the database is wrong', () => {
    describe('with the proxy socks configuration', () => {
      it('should throw a DatabaseError error', async () => {
        await expect(() =>
          connect({
            uri: 'postgres://test:password@postgres:5432/BADDB',
            proxySocks,
          }),
        ).rejects.toThrow(DatabaseError);
      });
    });

    describe('without the proxy socks configuration', () => {
      it('should throw a DatabaseError error', async () => {
        await expect(() =>
          connect('postgres://test:password@localhost:5443/BADDB'),
        ).rejects.toThrow(DatabaseError);
      });
    });
  });

  describe('when the badly configuration creates a connection timeout', () => {
    describe('with the proxy socks configuration', () => {
      it('should throw a ConnectionAcquireTimeoutError error', async () => {
        await expect(() =>
          connect({
            uri: 'postgres://test:password@postgres:5432/test_connection',
            dialect: 'mysql',
            proxySocks,
          }),
        ).rejects.toThrow(ConnectionAcquireTimeoutError);
      }, 15000);
    });

    describe('without the proxy socks configuration', () => {
      it('should throw a ConnectionAcquireTimeoutError error', async () => {
        await expect(() =>
          connect({
            uri: 'postgres://test:password@localhost:5443/test_connection',
            dialect: 'mysql',
          }),
        ).rejects.toThrow(ConnectionAcquireTimeoutError);
      }, 15000);
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
              host: '127.1.2.3',
              port: 1080,
              password: 'password',
              userId: 'username',
            },
          }),
        ).rejects.toThrow(ProxyError);
      });
    });

    describe('when fixie proxy close the socket', () => {
      /* it('should throw a HostNotFoundError error', async () => {
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
        ).rejects.toThrow(HostNotFoundError);
      }); */

      it('Unit Test > should throw a HostNotFoundError error', async () => {
        expect(() => handleErrorsWithProxy(new Error('Socket closed'), uri, uri)).toThrow(
          HostNotFoundError,
        );
      });
    });
  });
});
