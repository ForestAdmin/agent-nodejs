import { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';

import SqlDataSource from './datasource';

export default function createSqlDataSource(connectionUri: string): DataSourceFactory {
  return async (logger: Logger) => {
    const datasource = new SqlDataSource(connectionUri, logger);
    await datasource.build();

    return datasource;
  };
}
