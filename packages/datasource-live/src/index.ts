import { DataSourceFactory, DataSourceSchema, Logger } from '@forestadmin/datasource-toolkit';

import LiveDataSource from './datasource';

export type LiveDataSourceOptions = {
  dataSourceSchema: DataSourceSchema;
  seeder: (datasource: LiveDataSource) => Promise<void>;
};

export default function createLiveDataSource(options: LiveDataSourceOptions): DataSourceFactory {
  return async (logger: Logger) => {
    const datasource = new LiveDataSource(logger, options.dataSourceSchema);
    await datasource.syncCollections();

    await options.seeder(datasource);

    return datasource;
  };
}
