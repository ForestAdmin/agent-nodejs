import { Sequelize } from 'sequelize';

import { DatabaseConnectError } from './errors';

export default async function testConnectionWithtimeOut(
  sequelize: Sequelize,
  databaseUri: string,
  timeout = 30000,
) {
  // Test connection. If this doesn't resolve after 30s, throw a timeout error
  const delay = ms =>
    new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  const timeoutPromise = delay(timeout).then(() =>
    Promise.reject(new DatabaseConnectError('Connection to database timed out', databaseUri)),
  );

  await Promise.race([sequelize.authenticate(), timeoutPromise]);
}
