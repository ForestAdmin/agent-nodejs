import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Sequelize } from 'sequelize';

import { DatabaseConnectError, SshConnectError } from '../../src';
import connect from '../../src/connection';
import ConnectionOptions from '../../src/connection/connection-options';
import { MARIADB_DETAILS } from '../_helpers/connection-details';
import createDatabaseIfNotExist from '../_helpers/create-database-if-not-exist';

describe.each(MARIADB_DETAILS)('when there is only a ssh configuration', connectionDetails => {
  const sshConfig = {
    host: 'localhost',
    port: 2222,
    username: 'forest',
    privateKey: readFileSync(resolve(__dirname, '../ssh-config/id_rsa')),
  };

  beforeAll(async () => {
    await createDatabaseIfNotExist(connectionDetails.url(), 'test_connection_ssh');
  });

  it('should be able to connect at the db', async () => {
    const options = new ConnectionOptions({
      uri: connectionDetails.url('test_connection_ssh'),
      ssh: sshConfig,
    });
    const seq = await connect(options);
    await seq.close();
    expect(seq).toBeInstanceOf(Sequelize);
  });

  describe('when the ssh has a wrong configuration', () => {
    it('should throw a ssh error', async () => {
      const options = new ConnectionOptions({
        uri: connectionDetails.url('test_connection_ssh'),
        ssh: { ...sshConfig, username: 'BADUSER' },
        connectionTimeoutInMs: 4000,
      });
      await expect(() => connect(options)).rejects.toThrow(SshConnectError);
    });
  });

  describe('when the db has a wrong configuration', () => {
    it('should throw a database error', async () => {
      const options = new ConnectionOptions({
        uri: connectionDetails.url('test_connection_ssh'),
        ssh: sshConfig,
      });
      await expect(() => connect(options)).rejects.toThrow(DatabaseConnectError);
    });
  });
});
