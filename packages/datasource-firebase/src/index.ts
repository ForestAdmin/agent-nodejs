import { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';

import FirebaseDataSource from './datasource';

export { default as FirebaseCollection } from './collection';
export { default as FirebaseDataSource } from './datasource';

export function createFirebaseDataSource(): DataSourceFactory {
  return async (logger: Logger) => new FirebaseDataSource(logger);
}
