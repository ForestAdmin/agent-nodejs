import { CachedDataSourceOptions } from '@forestadmin/datasource-cached';

export type HubSpotOptions = {
  cacheInto?: CachedDataSourceOptions['cacheInto'];
  accessToken: string;
  collections: Record<string, string[]>;
};
