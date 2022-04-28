import { Connection } from 'mongoose';
import { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';

import SequelizeDataSource from './datasource';

export { default as MongooseCollection } from './collection';
export { default as MongooseDatasource } from './datasource';

export function createMongooseDataSource(connection: Connection): DataSourceFactory {
  return async (logger: Logger) => new SequelizeDataSource(connection, logger);
}
