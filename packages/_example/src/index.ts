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
    authSecret: 'this_is_a_fake_auth_secret',
    agentUrl: 'http://localhost:3351',
    envSecret: '424f045d2b6117da1dd6ff67be13a8391984221ba6fa3fb128313555a1a2c396',
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
