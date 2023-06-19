import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Sequelize } from 'sequelize';

import { SshConnectError } from '../../src';
import connect from '../../src/connection';
import ConnectionOptions from '../../src/connection/connection-options';
import setupDatabaseWithTypes from '../_helpers/setup-using-all-types';

describe('when there is only a ssh configuration', () => {
  it('should be able to connect at the db', async () => {
    const baseUri = 'postgres://test:password@localhost:5443';
    await setupDatabaseWithTypes(baseUri, 'postgres', 'test_connection');

    const options = new ConnectionOptions({
      uri: 'postgres://test:password@postgres:5432/test_connection',
      ssh: {
        host: 'localhost',
        port: 2222,
        username: 'forest',
        privateKey: readFileSync(resolve(__dirname, '../../ssh-config/id_rsa')),
      },
    });
    const seq = await connect(options);
    await seq.close();
    expect(seq).toBeInstanceOf(Sequelize);
  });

  describe('when the ssh has a wrong configuration', () => {
    it('should catch the error', async () => {
      const baseUri = 'mariadb://root:password@localhost:3809';
      await setupDatabaseWithTypes(baseUri, 'mariadb', 'test_connection');

      const options = new ConnectionOptions({
        uri: 'mariadb://root:password@mariadb:3306/test_connection',
        ssh: {
          host: 'localhost',
          port: 2222,
          username: 'BADUSER',
          privateKey: readFileSync(resolve(__dirname, '../../ssh-config/id_rsa')),
        },
      });
      await expect(() => connect(options)).rejects.toThrow(SshConnectError);
    });
  });

  describe('when the db has a wrong configuration', () => {
    it('should catch the error', async () => {
      const baseUri = 'mariadb://root:password@localhost:3809';
      await setupDatabaseWithTypes(baseUri, 'mariadb', 'test_connection');

      const options = new ConnectionOptions({
        uri: 'mariadb://root:password@BADHOST:3306/test_connection',
        ssh: {
          host: 'localhost',
          port: 2222,
          username: 'forest',
          privateKey: readFileSync(resolve(__dirname, '../../ssh-config/id_rsa')),
        },
      });
      await expect(() => connect(options)).rejects.toThrow(SshConnectError);
    });
  });
});
