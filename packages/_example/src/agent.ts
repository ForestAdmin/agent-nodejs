/* eslint-disable no-console */

import { ForestAdminHttpDriver, ForestAdminHttpDriverOptions } from '@forestadmin/agent';
import { DummyDataSource } from '@forestadmin/datasource-dummy';
import {
  DataSource,
  DataSourceDecorator,
  OperatorsEmulateCollectionDecorator,
  OperatorsReplaceCollectionDecorator,
  PublicationCollectionDecorator,
  RenameCollectionDecorator,
  SearchCollectionDecorator,
  SegmentCollectionDecorator,
  SortEmulateCollectionDecorator,
} from '@forestadmin/datasource-toolkit';
import http from 'http';

export default async function start(
  serverPort: number,
  serverHost: string,
  options: ForestAdminHttpDriverOptions,
) {
  let dataSource: DataSource;
  dataSource = new DummyDataSource();
  dataSource = new DataSourceDecorator(dataSource, OperatorsEmulateCollectionDecorator);
  dataSource = new DataSourceDecorator(dataSource, OperatorsReplaceCollectionDecorator);
  dataSource = new DataSourceDecorator(dataSource, SortEmulateCollectionDecorator);
  dataSource = new DataSourceDecorator(dataSource, SegmentCollectionDecorator);
  dataSource = new DataSourceDecorator(dataSource, RenameCollectionDecorator);
  dataSource = new DataSourceDecorator(dataSource, PublicationCollectionDecorator);
  dataSource = new DataSourceDecorator(dataSource, SearchCollectionDecorator);

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
