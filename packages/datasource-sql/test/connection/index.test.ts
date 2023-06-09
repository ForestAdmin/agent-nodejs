import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Dialect, Sequelize } from 'sequelize';

import connect from '../../src/connection';
import { DatabaseConnectError } from '../../src/connection/errors';
import { SslMode } from '../../src/types';
import setupDatabaseWithTypes from '../_helpers/setup-using-all-types';

describe('Connect', () => {
  describe('on database which do not support automatic ssl (sqlite)', () => {
    it('should work in manual mode with nothing specified', async () => {
      const seq = await connect('sqlite::memory:');
      await seq.close();

      expect(seq).toBeInstanceOf(Sequelize);
    });

    it('should work but print a warning when setting ssl options', async () => {
      const logger = jest.fn();
      const seq = await connect({ uri: 'sqlite::memory:', sslMode: 'verify' }, logger);
      await seq.close();

      expect(seq).toBeInstanceOf(Sequelize);
      expect(logger).toHaveBeenCalledWith(
        'Warn',
        'ignoring sslMode=verify (not supported for sqlite)',
      );
    });
  });

  describe('when proxy socks configuration is provided', () => {
    describe('when the password the uri is wrong', () => {
      it('should not block the promise', async () => {
        const baseUri = 'postgres://test:password@localhost:5443';
        await setupDatabaseWithTypes(baseUri, 'postgres', 'test_connection');

        const badUri = `postgres://BADUSER:password@postgres:5432/test_connection`;
        await expect(() =>
          connect({
            uri: badUri,
            proxySocks: {
              host: 'localhost',
              port: 1080,
              password: 'password',
              userId: 'username',
            },
          }),
        ).rejects.toThrow(DatabaseConnectError);
      });
    });

    describe('when the proxy configuration is wrong', () => {
      it('should throw an error', async () => {
        const baseUri = 'postgres://test:password@localhost:5443';
        await setupDatabaseWithTypes(baseUri, 'postgres', 'test_connection');

        const uri = `postgres://test:password@postgres:5432/test_connection`;
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
        ).rejects.toThrow(
          // eslint-disable-next-line max-len
          'Your proxy has encountered an error. Unable to connect to the given uri: username:**sanitizedPassword**@BADHOST:1080',
        );
      });
    });

    describe('when there is also a provided ssh configuration', () => {
      it('should be able to connect at the db', async () => {
        const baseUri = 'postgres://test:password@localhost:5443';
        await setupDatabaseWithTypes(baseUri, 'postgres', 'test_connection');

        const uri = `postgres://test:password@postgres:5432/test_connection`;
        const seq = await connect({
          uri,
          proxySocks: {
            host: 'localhost',
            port: 1080,
            password: 'password',
            userId: 'username',
          },
          ssh: {
            host: 'localhost',
            dockerHost: 'ssh-server',
            port: 2222,
            username: 'forest',
            privateKey: readFileSync(resolve(__dirname, '../../ssh-config/id_rsa'), 'utf8'),
          },
        });
        await seq.close();
        expect(seq).toBeInstanceOf(Sequelize);
      });
    });
  });

  describe.each([
    ['postgres' as Dialect, 'test', 'password', 'localhost', 5443, 5432, 'postgres'],
    ['mysql' as Dialect, 'root', 'password', 'localhost', 3307, 3306, 'mysql'],
    ['mssql' as Dialect, 'sa', 'yourStrong(!)Password', 'localhost', 1434, 1433, 'mssql'],
    ['mariadb' as Dialect, 'root', 'password', 'localhost', 3809, 3306, 'mariadb'],
  ])(
    'on %s database (supports unencrypted)',
    (dialect, username, password, host, containerPort, port, dockerServiceName) => {
      const baseUri = `${dialect}://${username}:${password}@${host}:${containerPort}`;
      const uri = `${baseUri}/test_connection`;

      beforeAll(async () => {
        await setupDatabaseWithTypes(baseUri, dialect, 'test_connection');
      });

      describe('when proxy socks configuration is provided', () => {
        it('should be authenticated and close sequelize without error', async () => {
          const updatedUri = uri
            .replace('localhost', dockerServiceName)
            .replace(containerPort.toString(), port.toString());
          const seq = await connect({
            uri: updatedUri,
            proxySocks: {
              host: 'localhost',
              port: 1080,
              password: 'password',
              userId: 'username',
            },
          });
          await seq.close();

          expect(seq).toBeInstanceOf(Sequelize);
        });
      });

      it('should work in manual mode with nothing specified', async () => {
        const seq = await connect(uri);
        await seq.close();

        expect(seq).toBeInstanceOf(Sequelize);
      });

      it.each([['preferred'], ['disabled']])('should work when using sslMode %s', async sslMode => {
        const seq = await connect({ uri, sslMode: sslMode as SslMode });
        await seq.close();

        expect(seq).toBeInstanceOf(Sequelize);
      });
    },
  );

  describe.each([
    ['postgres' as Dialect, 'test', 'password', 'localhost', 5443],
    ['mariadb' as Dialect, 'root', 'password', 'localhost', 3809],
  ])('on %s database (no ssl support)', (dialect, username, password, host, port) => {
    const baseUri = `${dialect}://${username}:${password}@${host}:${port}`;
    const uri = `${baseUri}/test_connection`;

    beforeAll(async () => {
      await setupDatabaseWithTypes(baseUri, dialect, 'test_connection');
    });

    it.each([['required'], ['verify']])('should fail when using sslMode %s', async sslMode => {
      const fn = () => connect({ uri, sslMode: sslMode as SslMode });

      await expect(fn).rejects.toThrow(/ssl not enabled|does not support SSL connections/);
    });
  });

  describe.each([
    ['mysql' as Dialect, 'root', 'password', 'localhost', 3307],
    ['mssql' as Dialect, 'sa', 'yourStrong(!)Password', 'localhost', 1434],
  ])('on %s database (supports self-signed ssl)', (dialect, username, password, host, port) => {
    const baseUri = `${dialect}://${username}:${password}@${host}:${port}`;
    const uri = `${baseUri}/test_connection`;

    beforeAll(async () => {
      await setupDatabaseWithTypes(baseUri, dialect, 'test_connection');
    });

    it.each([['preferred'], ['required']])('should work when using sslMode %s', async sslMode => {
      const seq = await connect({ uri, sslMode: sslMode as SslMode });
      await seq.close();

      expect(seq).toBeInstanceOf(Sequelize);
    });

    it("should fail when using sslMode 'verify'", async () => {
      const fn = () => connect({ uri, sslMode: 'verify' });

      await expect(fn).rejects.toThrow(/self[- ]signed certificate/);
    });
  });
});
