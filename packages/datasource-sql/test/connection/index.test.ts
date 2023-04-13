import { Dialect, Sequelize } from 'sequelize';

import { connect } from '../../src/connection';
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

  describe.each([
    ['postgres' as Dialect, 'test', 'password', 'localhost', 5443],
    ['mysql' as Dialect, 'root', 'password', 'localhost', 3307],
    ['mssql' as Dialect, 'sa', 'yourStrong(!)Password', 'localhost', 1434],
    ['mariadb' as Dialect, 'root', 'password', 'localhost', 3809],
  ])('on %s database (supports unencrypted)', (dialect, username, password, host, port) => {
    const baseUri = `${dialect}://${username}:${password}@${host}:${port}`;
    const uri = `${baseUri}/test_connection`;

    beforeAll(async () => {
      await setupDatabaseWithTypes(baseUri, dialect, 'test_connection');
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
  });

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

  describe('generic error handling (on postgres, but it is the same for the others)', () => {
    it('should throw when hostname is unknown and using preferred ssl', async () => {
      const fn = () => connect({ uri: 'postgres://dontexist123123', sslMode: 'preferred' });

      // Either 'ENOTFOUND' or 'EAI_AGAIN' depending on the dns lookup
      await expect(fn).rejects.toThrow('dontexist123123');
    });

    it('should throw when hostname is unknown', async () => {
      const fn = () => connect('postgres://dontexist123123');
      await expect(fn).rejects.toThrow('dontexist123123');
    });

    it('should throw when port is not reachable', async () => {
      const fn = () => connect('postgres://localhost:23123');
      await expect(fn).rejects.toThrow('Connection refused error: connect ECONNREFUSED');
    });

    it('should throw when username is wrong', async () => {
      const fn = () => connect('postgres://unknownUser@localhost:5443');

      await expect(fn).rejects.toThrow(
        'Connection error: password authentication failed for user "unknownUser"',
      );
    });

    it('should throw when password is wrong', async () => {
      const fn = () => connect('postgres://test:wrongpassword@localhost:5443');

      await expect(fn).rejects.toThrow(
        'Connection error: password authentication failed for user "test"',
      );
    });

    it('should throw when database is wrong', async () => {
      const fn = () => connect('postgres://test:password@localhost:5443/unknownDatabase');

      await expect(fn).rejects.toThrow(
        'Connection error: database "unknownDatabase" does not exist',
      );
    });
  });
});
