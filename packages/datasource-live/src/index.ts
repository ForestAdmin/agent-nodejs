import { DataSourceFactory, DataSourceSchema, Logger } from '@forestadmin/datasource-toolkit';

import LiveDataSource from './datasource';

export type LiveDataSourceOptions = {
  seeder: (datasource: LiveDataSource) => Promise<void>;
};

export default function createLiveDataSource(
  dataSourceSchema: DataSourceSchema,
  options?: LiveDataSourceOptions,
): DataSourceFactory {
  return async (logger: Logger) => {
    const datasource = new LiveDataSource(logger, dataSourceSchema);
    await datasource.syncCollections();

    if (options?.seeder) await options.seeder(datasource);

    return datasource;
  };
}
