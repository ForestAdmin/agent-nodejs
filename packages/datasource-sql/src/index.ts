import { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';

import SqlDataSource from './datasource';

// eslint-disable-next-line import/prefer-default-export
export function createSqlDataSource(connectionUri: string): DataSourceFactory {
  return async (logger: Logger) => {
    const datasource = new SqlDataSource(connectionUri, logger);
    await datasource.build();

    return datasource;
  };
}
