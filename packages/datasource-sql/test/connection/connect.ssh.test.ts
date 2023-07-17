import { Sequelize } from '@sequelize/core';
import { readFileSync } from 'fs';
import { resolve } from 'path';

import { DatabaseConnectError, SshConnectError } from '../../src';
import connect from '../../src/connection';
import ConnectionOptions from '../../src/connection/connection-options';
import createDatabaseIfNotExist from '../_helpers/create-database-if-not-exist';

describe('when there is only a ssh configuration', () => {
  const sshConfig = {
    host: 'localhost',
    port: 2222,
    username: 'forest',
    privateKey: readFileSync(resolve(__dirname, '../ssh-config/id_rsa')),
  };

  beforeAll(async () => {
    await createDatabaseIfNotExist('mariadb://root:password@localhost:3809', 'test_connection_ssh');
  });

  it('should be able to connect at the db', async () => {
    const options = new ConnectionOptions({
      uri: 'mariadb://root:password@mariadb:3306/test_connection_ssh',
      ssh: sshConfig,
    });
    const seq = await connect(options);
    await seq.close();
    expect(seq).toBeInstanceOf(Sequelize);
  });

  describe('when the ssh has a wrong configuration', () => {
    it('should throw a ssh error', async () => {
      const options = new ConnectionOptions({
        uri: 'mariadb://root:password@mariadb:3306/test_connection_ssh',
        ssh: { ...sshConfig, username: 'BADUSER' },
        connectionTimeoutInMs: 4000,
      });
      await expect(() => connect(options)).rejects.toThrow(SshConnectError);
    });
  });

  describe('when the db has a wrong configuration', () => {
    it('should throw a database error', async () => {
      const options = new ConnectionOptions({
        uri: 'mariadb://root:password@localhost:3306/test_connection_ssh',
        ssh: sshConfig,
      });
      await expect(() => connect(options)).rejects.toThrow(DatabaseConnectError);
    });
  });
});
