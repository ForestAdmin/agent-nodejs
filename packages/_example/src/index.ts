/* eslint-disable no-console */

import { ForestAdminHttpDriver } from '@forestadmin/agent';
import { DummyDataSource } from '@forestadmin/datasource-dummy';
import http from 'http';

/** Start a server on port 3000 using the dummy datasource */
export default async function start() {
  const dataSource = new DummyDataSource();
  const driver = new ForestAdminHttpDriver(dataSource, {
    logger: console.log,
    prefix: '/forest',
  });

  await driver.start();

  const server = http.createServer(driver.handler);
  await new Promise<void>(resolve => {
    server.listen(3000, '127.0.0.1', null, () => {
      resolve();
    });
  });

  return () => {
    server.close();
  };
}
