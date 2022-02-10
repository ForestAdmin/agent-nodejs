import { ForestAdminHttpDriver, ForestAdminHttpDriverOptions } from '@forestadmin/agent';
import http from 'http';

import prepareDummyDataSource from './datasources/dummy-library';
import prepareLiveDataSource from './datasources/live-business';
import prepareSequelizeDataSource from './datasources/sequelize-example';

export default async function start(
  serverPort: number,
  serverHost: string,
  options: ForestAdminHttpDriverOptions,
) {
  const dataSources = await Promise.all([
    prepareDummyDataSource(),
    prepareLiveDataSource(),
    prepareSequelizeDataSource(),
  ]);

  const driver = new ForestAdminHttpDriver(dataSources, options);

  await driver.start();

  const server = http.createServer(driver.handler);

  await new Promise<void>(resolve => {
    server.listen(serverPort, serverHost, null, () => {
      resolve();
    });
  });

  return () => {
    server.close();
  };
}
