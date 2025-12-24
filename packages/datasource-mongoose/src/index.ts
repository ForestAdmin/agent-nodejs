import type { MongooseOptions } from './types';
import type { DataSourceFactory } from '@forestadmin/datasource-toolkit';
import type { Connection, Mongoose } from 'mongoose';

import MongooseDatasource from './datasource';

export { default as MongooseCollection } from './collection';
export { default as MongooseDatasource } from './datasource';
export type { MongooseOptions };

export function createMongooseDataSource(
  connection: Connection | Mongoose,
  options: MongooseOptions = {},
): DataSourceFactory {
  return async logger => new MongooseDatasource(connection, options, logger);
}
