/* eslint-disable */
import { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';
import { Model } from 'dynamoose/dist/Model';

import DynamooseDataSource from './datasource';

export function createDynamooseDataSource(models: Model<any>[]): DataSourceFactory {
  return async (logger: Logger) => new DynamooseDataSource(models, logger);
}

export { default as DynamooseDataSource } from './datasource';
