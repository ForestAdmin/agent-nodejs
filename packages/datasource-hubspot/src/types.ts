import { ReplicaDataSourceOptions } from '@forestadmin/datasource-replica';

export type HubSpotOptions = {
  cacheInto?: ReplicaDataSourceOptions['cacheInto'];
  accessToken: string;
  collections: Record<string, string[]>;
};
