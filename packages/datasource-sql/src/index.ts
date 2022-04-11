import { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';

import SqlDataSource from './datasource';

export type SqlDataSourceOptions = {
  connectionUri: string;
};

export default function createSqlDataSource(options: SqlDataSourceOptions): DataSourceFactory {
  return async (logger: Logger) => {
    const datasource = new SqlDataSource(logger, options.connectionUri);
    await datasource.build();

    return datasource;
  };
}
