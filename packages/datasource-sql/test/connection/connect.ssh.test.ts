import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Sequelize } from 'sequelize';

import { DatabaseConnectError, SshConnectError } from '../../src';
import connect from '../../src/connection';
import ConnectionOptions from '../../src/connection/connection-options';
import setupDatabaseWithTypes from '../_helpers/setup-using-all-types';

const sshConfig = {
  host: 'localhost',
  port: 2222,
  username: 'forest',
  privateKey: readFileSync(resolve(__dirname, '../../ssh-config/id_rsa')),
};

describe('when there is only a ssh configuration', () => {
  it('should be able to connect at the db', async () => {
    const baseUri = 'postgres://test:password@localhost:5443';
    await setupDatabaseWithTypes(baseUri, 'postgres', 'test_connection');

    const options = new ConnectionOptions({
      uri: 'postgres://test:password@postgres:5432/test_connection',
      ssh: sshConfig,
    });
    const seq = await connect(options);
    await seq.close();
    expect(seq).toBeInstanceOf(Sequelize);
  });

  describe('when the ssh has a wrong configuration', () => {
    it('should throw a ssh error', async () => {
      const baseUri = 'mariadb://root:password@localhost:3809';
      await setupDatabaseWithTypes(baseUri, 'mariadb', 'test_connection');

      const options = new ConnectionOptions({
        uri: 'mariadb://root:password@mariadb:3306/test_connection',
        ssh: { ...sshConfig, username: 'BADUSER' },
      });
      await expect(() => connect(options)).rejects.toThrow(SshConnectError);
    });
  });

  describe('when the db has a wrong configuration', () => {
    it('should throw a database error', async () => {
      const baseUri = 'mariadb://root:password@localhost:3809';
      await setupDatabaseWithTypes(baseUri, 'mariadb', 'test_connection');

      const options = new ConnectionOptions({
        uri: 'mariadb://root:password@BADHOST:3306/test_connection',
        ssh: sshConfig,
      });
      await expect(() => connect(options)).rejects.toThrow(DatabaseConnectError);
    });
  });
});
