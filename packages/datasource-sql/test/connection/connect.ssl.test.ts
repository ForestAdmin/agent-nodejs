import type { SslMode } from '../../src/types';

import { Sequelize } from 'sequelize';

import connect from '../../src/connection';
import ConnectionOptions from '../../src/connection/connection-options';
import {
  MARIADB_DETAILS,
  MSSQL_DETAILS,
  MYSQL_DETAILS,
  POSTGRESQL_DETAILS,
} from '../_helpers/connection-details';
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

  describe.each([...POSTGRESQL_DETAILS, ...MYSQL_DETAILS, ...MSSQL_DETAILS, ...MARIADB_DETAILS])(
    'on $name database (supports unencrypted)',
    connectionDetails => {
      const uri = connectionDetails.url('test_connection_ssl');

      beforeAll(async () => {
        await createDatabaseIfNotExist(connectionDetails.url(), 'test_connection_ssl');
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

  describe.each([...POSTGRESQL_DETAILS, ...MARIADB_DETAILS])(
    'on $name database (no ssl support)',
    connectionDetails => {
      const uri = connectionDetails.url('test_connection_ssl_2');

      beforeAll(async () => {
        await createDatabaseIfNotExist(connectionDetails.url(), 'test_connection_ssl_2');
      });

      it.each([['required'], ['verify']])('should fail when using sslMode %s', async sslMode => {
        const fn = () => connect(new ConnectionOptions({ uri, sslMode: sslMode as SslMode }));

        await expect(fn).rejects.toThrow(/ssl not enabled|does not support SSL connections/);
      });
    },
  );

  describe.each([...MYSQL_DETAILS, ...MSSQL_DETAILS])(
    'on $name database (supports self-signed ssl)',
    connectionDetails => {
      const uri = connectionDetails.url(`test_connection_ssl`);

      beforeAll(async () => {
        await createDatabaseIfNotExist(connectionDetails.url(), 'test_connection_ssl');
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
    },
  );
});
