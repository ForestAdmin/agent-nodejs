import { Dialect, Sequelize } from 'sequelize';

import connect from '../../src/connection';
import ConnectionOptions from '../../src/connection/connection-options';
import { SslMode } from '../../src/types';
import createDatabaseIfNotExist from '../_helpers/create-database-if-not-exist';

describe('Connect', () => {
  describe('on database which do not support automatic ssl (sqlite)', () => {
    it('should work in manual mode with nothing specified', async () => {
      const seq = await connect(new ConnectionOptions('sqlite::memory:'));
      await seq.close();

      expect(seq).toBeInstanceOf(Sequelize);
    });

    it('should work but print a warning when setting ssl options', async () => {
      const logger = jest.fn();
      const seq = await connect(
        new ConnectionOptions({ uri: 'sqlite::memory:', sslMode: 'verify' }, logger),
      );
      await seq.close();

      expect(seq).toBeInstanceOf(Sequelize);
      expect(logger).toHaveBeenCalledWith(
        'Warn',
        'ignoring sslMode=verify (not supported for sqlite)',
      );
    });
  });

  describe.each([
    ['postgres' as Dialect, 'test', 'password', 'localhost', 5443],
    ['mysql' as Dialect, 'root', 'password', 'localhost', 3307],
    ['mssql' as Dialect, 'sa', 'yourStrong(!)Password', 'localhost', 1434],
    ['mariadb' as Dialect, 'root', 'password', 'localhost', 3809],
  ])(
    'on %s database (supports unencrypted)',
    (dialect, username, password, host, containerPort) => {
      const baseUri = `${dialect}://${username}:${password}@${host}:${containerPort}`;
      const uri = `${baseUri}/test_connection`;

      beforeAll(async () => {
        await createDatabaseIfNotExist(baseUri, 'test_connection');
      });

      it('should work in manual mode with nothing specified', async () => {
        const seq = await connect(new ConnectionOptions(uri));
        await seq.close();

        expect(seq).toBeInstanceOf(Sequelize);
      });

      it.each([['preferred'], ['disabled']])('should work when using sslMode %s', async sslMode => {
        const seq = await connect(new ConnectionOptions({ uri, sslMode: sslMode as SslMode }));
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
      await createDatabaseIfNotExist(baseUri, 'test_connection');
    });

    it.each([['required'], ['verify']])('should fail when using sslMode %s', async sslMode => {
      const fn = () => connect(new ConnectionOptions({ uri, sslMode: sslMode as SslMode }));

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
      await createDatabaseIfNotExist(baseUri, 'test_connection');
    });

    it.each([['preferred'], ['required']])('should work when using sslMode %s', async sslMode => {
      const seq = await connect(new ConnectionOptions({ uri, sslMode: sslMode as SslMode }));
      await seq.close();

      expect(seq).toBeInstanceOf(Sequelize);
    });

    it("should fail when using sslMode 'verify'", async () => {
      const fn = () => connect(new ConnectionOptions({ uri, sslMode: 'verify' }));

      await expect(fn).rejects.toThrow(/self[- ]signed certificate/);
    });
  });
});
