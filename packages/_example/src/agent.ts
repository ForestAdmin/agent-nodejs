/* eslint-disable no-console */

import { ForestAdminHttpDriver, ForestAdminHttpDriverOptions } from '@forestadmin/agent';
import { DummyDataSource } from '@forestadmin/datasource-dummy';
import http from 'http';

export default async function start(
  serverPort: number,
  serverHost: string,
  options: ForestAdminHttpDriverOptions,
) {
  const dataSource = new DummyDataSource();
  const driver = new ForestAdminHttpDriver(dataSource, options);

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
