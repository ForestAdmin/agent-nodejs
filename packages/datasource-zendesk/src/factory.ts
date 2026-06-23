import type { ZendeskClientProvider } from './client-options';
import type { DataSource, DataSourceFactory } from '@forestadmin/datasource-toolkit';

import { resolveZendeskClient } from './client-options';
import ZendeskDataSource from './datasource';

export type ZendeskDataSourceOptions = ZendeskClientProvider;

export function createZendeskDataSource(options: ZendeskDataSourceOptions): DataSourceFactory {
  return async (logger): Promise<DataSource> => {
    const client = resolveZendeskClient(options, logger);

    return ZendeskDataSource.create(client, logger);
  };
}
