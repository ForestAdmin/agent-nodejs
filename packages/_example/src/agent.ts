import http from 'http';

import { ForestAdminHttpDriver, ForestAdminHttpDriverOptions } from '@forestadmin/agent';

import dummyDataSource from './datasources/dummy-library';

import liveDataSource from './datasources/live-business';
import loadLiveDataSource from './datasources/live-business-data';
import sequelizeDataSource from './datasources/sequelize-example';

export default async function start(
  serverPort: number,
  serverHost: string,
  options: ForestAdminHttpDriverOptions,
) {
  const driver = new ForestAdminHttpDriver(
    [dummyDataSource, liveDataSource, sequelizeDataSource],
    options,
  );

  await liveDataSource.syncCollections();

  await loadLiveDataSource(liveDataSource);

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
