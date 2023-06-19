import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Sequelize } from 'sequelize';

import { DatabaseConnectError, SshConnectError } from '../../src';
import connect from '../../src/connection';
import ConnectionOptions from '../../src/connection/connection-options';
import setupDatabaseWithTypes from '../_helpers/setup-using-all-types';

const ssh = {
  host: 'ssh-server',
  port: 2222,
  username: 'forest',
  privateKey: readFileSync(resolve(__dirname, '../../ssh-config/id_rsa')),
};
const proxySocks = { host: 'localhost', port: 1080, password: 'password', userId: 'username' };

describe('when there is a ssh and proxy configuration', () => {
  it('should be able to connect at the db', async () => {
    const baseUri = 'mariadb://root:password@localhost:3809';
    await setupDatabaseWithTypes(baseUri, 'mariadb', 'test_connection');

    const options = new ConnectionOptions({
      uri: 'mariadb://root:password@mariadb:3306/test_connection',
      proxySocks,
      ssh,
    });
    const seq = await connect(options);
    await seq.close();
    expect(seq).toBeInstanceOf(Sequelize);
  });

  describe('when the db has a wrong configuration', () => {
    it('should throw the DatabaseConnectError', async () => {
      const baseUri = 'mariadb://root:password@localhost:3809';
      await setupDatabaseWithTypes(baseUri, 'mariadb', 'test_connection');

      const options = new ConnectionOptions({
        uri: 'mariadb://root:password@badhost:3306/test_connection',
        proxySocks,
        ssh,
      });
      await expect(() => connect(options)).rejects.toThrow(DatabaseConnectError);
    });
  });

  describe('when the ssh has a wrong configuration', () => {
    describe('when the host is wrong', () => {
      it('should throw the SshConnectError', async () => {
        const baseUri = 'mariadb://root:password@localhost:3809';
        await setupDatabaseWithTypes(baseUri, 'mariadb', 'test_connection');

        const options = new ConnectionOptions({
          uri: 'mariadb://root:password@mariadb:3306/test_connection',
          proxySocks,
          ssh: { ...ssh, host: 'BADHOST' },
        });
        await expect(() => connect(options)).rejects.toThrow(SshConnectError);
      });
    });

    describe('when the username is wrong', () => {
      it('should throw the SshConnectError', async () => {
        const baseUri = 'mariadb://root:password@localhost:3809';
        await setupDatabaseWithTypes(baseUri, 'mariadb', 'test_connection');

        const options = new ConnectionOptions({
          uri: 'mariadb://root:password@mariadb:3306/test_connection',
          ssh: { ...ssh, username: 'BADUSER' },
        });
        await expect(() => connect(options)).rejects.toThrow(SshConnectError);
      });
    });
  });

  describe('when a wrong configuration raises a connection timeout', () => {
    describe.each([
      ['with the proxy socks and ssh configuration', proxySocks, ssh],
      ['without the proxy socks configuration', undefined],
    ])('%s', (proxyText, proxySockValue, sshValue) => {
      it('should throw a DatabaseConnectError error', async () => {
        const options = new ConnectionOptions({
          uri: `mysql://test:password@postgres:5432/test_connection`,
          proxySocks: proxySockValue,
          ssh: sshValue,
        });

        await expect(() => connect(options)).rejects.toThrow(DatabaseConnectError);
      }, 15000);
    });
  });

  describe('when there are too many connection', () => {
    describe.each([
      ['with the proxy socks and ssh configuration', proxySocks, ssh],
      ['without the proxy socks configuration', undefined],
    ])('%s', (_, proxySockValue, sshValue) => {
      it('should throw a DatabaseConnectError error', async () => {
        expect.assertions(1);
        const maxConnections = 100;
        const connections: Sequelize[] = [];
        const options = new ConnectionOptions({
          uri: `postgres://test:password@postgres:5432/test_connection`,
          proxySocks: proxySockValue,
          ssh: sshValue,
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
});
