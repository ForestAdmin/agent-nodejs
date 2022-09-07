import { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';

import { LiveSchema } from './types';
import LiveDataSource from './datasource';

export type LiveDataSourceOptions = {
  seeder: (datasource: LiveDataSource) => Promise<void>;
};

export function createLiveDataSource(
  schema: LiveSchema,
  options?: LiveDataSourceOptions,
): DataSourceFactory {
  return async (logger: Logger) => {
    const datasource = new LiveDataSource(schema, logger);
    await datasource.syncCollections();

    if (options?.seeder) await options.seeder(datasource);

    return datasource;
  };
}
