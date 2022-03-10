import http from 'http';

import { AgentOptions, ForestAdminHttpDriver } from '@forestadmin/agent';
import { BaseDataSource, Collection } from '@forestadmin/datasource-toolkit';

import prepareDummyDataSource from './datasources/dummy';
import prepareLiveDataSource from './datasources/live';
import prepareMssqlSequelizeDataSource from './datasources/sequelize/mssql';
import prepareMysqlSequelizeDataSource from './datasources/sequelize/mysql';
import prepareSequelizeDataSource from './datasources/sequelize/postgres';

export default async function start(serverPort: number, serverHost: string, options: AgentOptions) {
  const dataSources = await Promise.all([
    prepareDummyDataSource(),
    prepareLiveDataSource(),
    prepareMssqlSequelizeDataSource(),
    prepareMysqlSequelizeDataSource(),
    prepareSequelizeDataSource(),
  ]);

  const compositeDatasource = new BaseDataSource<Collection>();
  dataSources.forEach(datasource => {
    datasource.collections.forEach(collection => {
      compositeDatasource.addCollection(collection);
    });
  });

  const driver = new ForestAdminHttpDriver(compositeDatasource, options);

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
