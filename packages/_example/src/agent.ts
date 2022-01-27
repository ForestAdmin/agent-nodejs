import http from 'http';

import { ForestAdminHttpDriver, ForestAdminHttpDriverOptions } from '@forestadmin/agent';

import dataSource from './datasource';
import loadExampleData from './datasource-data';

export default async function start(
  serverPort: number,
  serverHost: string,
  options: ForestAdminHttpDriverOptions,
) {
  const driver = new ForestAdminHttpDriver(dataSource, options);

  await dataSource.syncCollections();

  await loadExampleData(dataSource);

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
