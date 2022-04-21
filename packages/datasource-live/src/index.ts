import { DataSourceFactory, DataSourceSchema, Logger } from '@forestadmin/datasource-toolkit';

import LiveDataSource from './datasource';

export type LiveDataSourceOptions = {
  seeder: (datasource: LiveDataSource) => Promise<void>;
};

export default function createLiveDataSource(
  schema: DataSourceSchema,
  options?: LiveDataSourceOptions,
): DataSourceFactory {
  return async (logger: Logger) => {
    const datasource = new LiveDataSource(schema, logger);
    await datasource.syncCollections();

    if (options?.seeder) await options.seeder(datasource);

    return datasource;
  };
}
