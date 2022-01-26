import http from 'http';

import { ForestAdminHttpDriver, ForestAdminHttpDriverOptions } from '@forestadmin/agent';

import dataSource from './datasource';

export default async function start(
  serverPort: number,
  serverHost: string,
  options: ForestAdminHttpDriverOptions,
) {
  const driver = new ForestAdminHttpDriver(dataSource, options);

  await dataSource.syncCollections();

  const records = new Array(100).fill(null).map((_, index) => ({
    name: `item ${index.toString().padStart(3, '0')}`,
    value: 9000 + index,
  }));

  await dataSource.collections.find(({ name }) => name === 'items').create(records);

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
