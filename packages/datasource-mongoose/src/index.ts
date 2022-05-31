import { Connection } from 'mongoose';
import { DataSourceFactory } from '@forestadmin/datasource-toolkit';

import MongooseDatasource from './datasource';

export { default as MongooseCollection } from './collection';
export { default as MongooseDatasource } from './datasource';

export function createMongooseDataSource(connection: Connection): DataSourceFactory {
  return async () => new MongooseDatasource(connection);
}
