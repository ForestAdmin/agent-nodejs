import { readFileSync } from 'fs';
import { resolve } from 'path';

import connect from '../../src/connection';
import ConnectionOptions from '../../src/connection/connection-options';
import { DatabaseConnectError } from '../../src/connection/errors';
import CONNECTION_DETAILS from '../_helpers/connection-details';
import createDatabaseIfNotExist from '../_helpers/create-database-if-not-exist';

const proxySocks = { host: 'localhost', port: 1083, password: 'password', userId: 'username' };
const ssh = {
  host: 'ssh-server',
  port: 2222,
  username: 'forest',
  privateKey: readFileSync(resolve(__dirname, '../ssh-config/id_rsa')),
};

describe('connect errors with all the databases', () => {
  describe.each(CONNECTION_DETAILS.filter(details => details.supports.authentication))(
    'on $name database',
    connectionDetails => {
      const db = `test_connection_all-databases`;

      beforeAll(async () => {
        await createDatabaseIfNotExist(connectionDetails.url(), db);
      });

      describe.each([
        ['password', 'BADPASSWORD'],
        ['username', 'BADUSER'],
        ['host', 'BADHOST'],
        ['port', 9999],
        ['database', 'BADDB'],
      ])('when the %s is wrong', (propertyName, wrongValue) => {
        describe.each([
          ['with the proxy socks and ssh configuration', proxySocks, ssh],
          ['without the proxy socks and ssh configuration', undefined, undefined],
        ])('%s', (proxyText, proxySockValue, sshValue) => {
          it('should throw an DatabaseConnectError error', async () => {
            const options = new ConnectionOptions({
              ...connectionDetails.options(db),
              [propertyName]: wrongValue,
              proxySocks: proxySockValue,
              ssh: sshValue,
              connectionTimeoutInMs: 2000,
            });

            await expect(() => connect(options)).rejects.toThrow(DatabaseConnectError);
          });
        });
      });
    },
  );
});
