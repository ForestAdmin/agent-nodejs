import type { Sequelize } from 'sequelize';

import { DatabaseConnectError } from './errors';

/** Test connection. If this doesn't resolve after 10s, throw a timeout error */
export default async function testConnectionWithTimeOut(
  sequelize: Sequelize,
  databaseUri: string,
  timeout = 10000,
): Promise<void> {
  let timeoutId;

  const timeoutPromise = new Promise((resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new DatabaseConnectError('Connection to database timed out', databaseUri));
    }, timeout);
  });

  await Promise.race([
    sequelize.authenticate()?.finally(() => {
      clearTimeout(timeoutId);
    }),
    timeoutPromise,
  ]);
}
