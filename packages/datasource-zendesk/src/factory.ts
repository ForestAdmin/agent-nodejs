import type { ZendeskClient } from './client';
import type { ZendeskClientOptions } from './types';
import type { DataSource, DataSourceFactory } from '@forestadmin/datasource-toolkit';

import { createZendeskClient } from './client';
import ZendeskDataSource from './datasource';

export type ZendeskDataSourceOptions =
  | { client: ZendeskClient }
  | ({ client?: never } & ZendeskClientOptions);

export function createZendeskDataSource(options: ZendeskDataSourceOptions): DataSourceFactory {
  return async (logger): Promise<DataSource> => {
    const client =
      'client' in options && options.client
        ? options.client
        : createZendeskClient(options as ZendeskClientOptions, logger);

    return ZendeskDataSource.create(client, logger);
  };
}
