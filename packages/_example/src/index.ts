/* eslint-disable no-console */

import { ForestAdminHttpDriver } from '@forestadmin/agent';
import { DummyDataSource } from '@forestadmin/datasource-dummy';
import http from 'http';

/** Start a server on port 3000 using the dummy datasource */
export default async function start() {
  const dataSource = new DummyDataSource();
  const driver = new ForestAdminHttpDriver(dataSource, {
    logger: console.log,
    prefix: 'forest',
    authSecret: 'this_is_a_fake_auth_secret',
    agentUrl: 'http://localhost:3351',
    envSecret: 'bd2cc0ef5b1a4f55821745ae01bae056d9c1da8b71a3f3e4c91e1e5f2b40b891',
    forestServerUrl: 'https://api.development.forestadmin.com',
  });

  await driver.start();

  const server = http.createServer(driver.handler);
  await new Promise<void>(resolve => {
    server.listen(3351, 'localhost', null, () => {
      resolve();
    });
  });

  return () => {
    server.close();
  };
}
