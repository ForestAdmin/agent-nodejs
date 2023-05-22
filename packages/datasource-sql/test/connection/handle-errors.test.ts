import connect from '../../src/connection';
import {
  AccessDeniedError,
  ConnectionAcquireTimeoutError,
  HostNotFoundError,
  UnexpectedProxyError,
} from '../../src/connection/errors';
import { handleErrorsWithProxy } from '../../src/connection/handle-errors';
import setupDatabaseWithTypes from '../_helpers/setup-using-all-types';

describe('connect errors', () => {
  const baseUri = 'postgres://test:password@localhost:5443';
  const proxySocks = {
    host: 'localhost',
    port: 1080,
    password: 'password',
    userId: 'username',
  };

  beforeEach(async () => {
    await setupDatabaseWithTypes(baseUri, 'postgres', 'test_connection');
  });

  describe('when the password is wrong', () => {
    describe('with proxy socks configuration', () => {
      it('should throw an AccessDeniedError error', async () => {
        await expect(() =>
          connect({
            uri: 'postgres://test:BADPASSWORD@localhost:5443/test_connection',
            proxySocks,
          }),
        ).rejects.toThrow(AccessDeniedError);
      });
    });

    describe('without proxy socks configuration', () => {
      it('should throw an AccessDeniedError error', async () => {
        await expect(() =>
          connect('postgres://test:BADPASSWORD@localhost:5443/test_connection'),
        ).rejects.toThrow(AccessDeniedError);
      });
    });
  });

  describe('when the user is wrong', () => {
    describe('with proxy socks configuration', () => {
      it('should throw an AccessDeniedError error', async () => {
        await expect(() =>
          connect({ uri: 'postgres://BADUSER:password@postgres:5432/test_connection', proxySocks }),
        ).rejects.toThrow(AccessDeniedError);
      });
    });

    describe('without proxy socks configuration', () => {
      it('should throw an AccessDeniedError error', async () => {
        await expect(() =>
          connect('postgres://BADUSER:password@localhost:5443/test_connection'),
        ).rejects.toThrow(AccessDeniedError);
      });
    });
  });

  describe('when the host is wrong', () => {
    describe('with proxy socks configuration', () => {
      it('should throw an HostNotFoundError error', async () => {
        await expect(() =>
          connect({
            uri: 'postgres://test:password@BADHOST:5443/test_connection',
            proxySocks,
          }),
        ).rejects.toThrow(HostNotFoundError);
      });
    });

    describe('without proxy socks configuration', () => {
      it('should throw an HostNotFoundError error', async () => {
        await expect(() =>
          connect('postgres://test:password@BADHOST:5443/test_connection'),
        ).rejects.toThrow(HostNotFoundError);
      });
    });
  });

  describe('when the port is wrong', () => {
    describe('with proxy socks configuration', () => {
      it('should throw an AccessDeniedError error', async () => {
        await expect(() =>
          connect({
            uri: 'postgres://test:password@localhost:9999/test_connection',
            proxySocks,
          }),
        ).rejects.toThrow(AccessDeniedError);
      });
    });

    describe('without proxy socks configuration', () => {
      it('should throw an AccessDeniedError error', async () => {
        await expect(() =>
          connect('postgres://test:password@localhost:9999/test_connection'),
        ).rejects.toThrow(AccessDeniedError);
      });
    });
  });

  describe('when the database is wrong', () => {
    describe('with proxy socks configuration', () => {
      it('should throw an AccessDeniedError error', async () => {
        await expect(() =>
          connect({
            uri: 'postgres://test:password@postgres:5432/BADDB',
            proxySocks,
          }),
        ).rejects.toThrow(AccessDeniedError);
      });
    });

    describe('without proxy socks configuration', () => {
      it('should throw an AccessDeniedError error', async () => {
        await expect(() =>
          connect('postgres://test:password@localhost:9999/BADDB'),
        ).rejects.toThrow(AccessDeniedError);
      });
    });
  });

  describe('when there is an error with the proxy', () => {
    describe('with the wrong port', () => {
      it('should throw an UnexpectedProxyError error', async () => {
        await expect(() =>
          connect({
            uri: 'postgres://test:password@localhost:5443/test_connection',
            proxySocks: {
              host: 'localhost',
              port: 10,
              password: 'password',
              userId: 'username',
            },
          }),
        ).rejects.toThrow(UnexpectedProxyError);
      });
    });

    describe('with the wrong host', () => {
      it('should throw an UnexpectedProxyError error', async () => {
        await expect(() =>
          connect({
            uri: 'postgres://test:password@localhost:5443/test_connection',
            proxySocks: {
              host: 'BADHOST',
              port: 10,
              password: 'password',
              userId: 'username',
            },
          }),
        ).rejects.toThrow(UnexpectedProxyError);
      });
    });

    describe('with the wrong password', () => {
      it('should throw an UnexpectedProxyError error', async () => {
        await expect(() =>
          connect({
            uri: 'postgres://test:password@localhost:5443/test_connection',
            proxySocks: {
              host: 'localhost',
              port: 10,
              password: 'BADPASSWORD',
              userId: 'username',
            },
          }),
        ).rejects.toThrow(UnexpectedProxyError);
      });
    });

    describe('with the wrong userId', () => {
      it('should throw an UnexpectedProxyError error', async () => {
        await expect(() =>
          connect({
            uri: 'postgres://test:password@localhost:5443/test_connection',
            proxySocks: {
              host: 'localhost',
              port: 10,
              password: 'password',
              userId: 'BADUSER',
            },
          }),
        ).rejects.toThrow(UnexpectedProxyError);
      });
    });
  });

  describe('handleErrorsWithProxy', () => {
    it('should throw an AccessDeniedError error', () => {
      expect(() =>
        handleErrorsWithProxy(
          new Error('Proxy connection timed out'),
          'postgres://test:password@localhost:5443/test_connection',
        ),
      ).toThrow(ConnectionAcquireTimeoutError);
    });
  });
});
