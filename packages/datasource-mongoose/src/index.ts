import { DataSourceFactory } from '@forestadmin/datasource-toolkit';
import { Connection, Mongoose } from 'mongoose';

import MongooseDatasource from './datasource';
import { MongooseOptions } from './types';

export { default as MongooseCollection } from './collection';
export { default as MongooseDatasource } from './datasource';
export type { MongooseOptions };

export function createMongooseDataSource(
  connection: Connection | Mongoose,
  options: MongooseOptions = {},
): DataSourceFactory {
  return async logger => new MongooseDatasource(connection, options, logger);
}
