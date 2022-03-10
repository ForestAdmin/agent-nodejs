import http from 'http';

import {
  ActionCollectionDecorator,
  BaseDataSource,
  Collection,
  DataSourceDecorator,
  OperatorsEmulateCollectionDecorator,
  OperatorsReplaceCollectionDecorator,
  PublicationCollectionDecorator,
  RenameCollectionDecorator,
  SearchCollectionDecorator,
  SegmentCollectionDecorator,
  SortEmulateCollectionDecorator,
} from '@forestadmin/datasource-toolkit';
import { AgentOptions, ForestAdminHttpDriver } from '@forestadmin/agent';

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

  let compositeDatasource = new BaseDataSource<Collection>();

  dataSources.forEach(datasource => {
    datasource.collections.forEach(collection => {
      compositeDatasource.addCollection(collection);
    });
  });

  compositeDatasource = new DataSourceDecorator(
    compositeDatasource,
    OperatorsEmulateCollectionDecorator,
  );
  compositeDatasource = new DataSourceDecorator(
    compositeDatasource,
    OperatorsReplaceCollectionDecorator,
  );
  compositeDatasource = new DataSourceDecorator(
    compositeDatasource,
    SortEmulateCollectionDecorator,
  );
  compositeDatasource = new DataSourceDecorator(compositeDatasource, SegmentCollectionDecorator);
  compositeDatasource = new DataSourceDecorator(compositeDatasource, RenameCollectionDecorator);
  compositeDatasource = new DataSourceDecorator(
    compositeDatasource,
    PublicationCollectionDecorator,
  );
  compositeDatasource = new DataSourceDecorator(compositeDatasource, SearchCollectionDecorator);
  compositeDatasource = new DataSourceDecorator(compositeDatasource, ActionCollectionDecorator);

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
