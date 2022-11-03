import { DataSourceFactory } from '@forestadmin/datasource-toolkit';
import { Connection } from 'mongoose';

import MongooseDatasource from './datasource';
import { MongooseOptions } from './types';

export { default as MongooseCollection } from './collection';
export { default as MongooseDatasource } from './datasource';

export function createMongooseDataSource(
  connection: Connection,
  options: MongooseOptions = {},
): DataSourceFactory {
  return async () => new MongooseDatasource(connection, options);
}
