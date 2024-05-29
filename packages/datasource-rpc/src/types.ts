import type { CollectionSchema } from '@forestadmin/datasource-toolkit';

export type RpcSchema = {
  collections: Record<string, CollectionSchema>;
};

export type RpcDataSourceOptions = {
  uri: string;
  authSecret: string;
};
