import { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';

import { CollectionSchema } from './schema';
import FirebaseDataSource from './datasource';

export { default as FirebaseCollection } from './collection';
export { default as FirebaseDataSource } from './datasource';
export * from './schema';

export function createFirebaseDataSource(
  schema: Record<string, CollectionSchema>,
): DataSourceFactory {
  return async (logger?: Logger) => FirebaseDataSource.create({ schema, logger });
}
