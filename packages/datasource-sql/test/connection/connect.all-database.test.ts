import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Dialect } from 'sequelize';

import connect from '../../src/connection';
import ConnectionOptions from '../../src/connection/connection-options';
import { DatabaseConnectError } from '../../src/connection/errors';
import createDatabaseIfNotExist from '../_helpers/create-database-if-not-exist';

const proxySocks = { host: 'localhost', port: 1080, password: 'password', userId: 'username' };
const ssh = {
  host: 'ssh-server',
  port: 2222,
  username: 'forest',
  privateKey: readFileSync(resolve(__dirname, '../../ssh-config/id_rsa')),
};

describe('connect errors with all the databases', () => {
  describe.each([
    ['postgres' as Dialect, 'test', 'password', 'localhost', 5443, 5432, 'postgres'],
    ['mysql' as Dialect, 'root', 'password', 'localhost', 3307, 3306, 'mysql'],
    ['mssql' as Dialect, 'sa', 'yourStrong(!)Password', 'localhost', 1434, 1433, 'mssql'],
    ['mariadb' as Dialect, 'root', 'password', 'localhost', 3809, 3306, 'mariadb'],
  ])(
    'on %s database',
    (dialect, username, password, host, containerPort, port, dockerServiceName) => {
      const db = `test_connection`;

      beforeAll(async () => {
        await createDatabaseIfNotExist(
          `${dialect}://${username}:${password}@${host}:${containerPort}`,
          dialect,
          'test_connection',
        );
      });
      describe.each([
        ['password', `${dialect}://${username}:BADPASSWORD@${dockerServiceName}:${port}/${db}`],
        ['user', `${dialect}://BADUSER:${password}@${dockerServiceName}:${port}/${db}`],
        ['host', `${dialect}://${username}:${password}@BADHOST:${port}/${db}`],
        ['port', `${dialect}://${username}:${password}@${dockerServiceName}:9999/${db}`],
        ['database', `${dialect}://${username}:${password}@${dockerServiceName}:${port}/BADDB`],
      ])('when the %s is wrong', (errorText, uri) => {
        describe.each([
          ['with the proxy socks and ssh configuration', proxySocks, ssh],
          ['without the proxy socks and ssh configuration', undefined],
        ])('%s', (proxyText, proxySockValue, sshValue) => {
          it('should throw an DatabaseConnectError error', async () => {
            const options = new ConnectionOptions({
              uri,
              proxySocks: proxySockValue,
              ssh: sshValue,
            });

            await expect(() => connect(options)).rejects.toThrow(DatabaseConnectError);
          });
        });
      });
    },
  );
});
