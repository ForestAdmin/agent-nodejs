import { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';
import { Sequelize } from 'sequelize/types';

import SequelizeDataSource from './datasource';

export { default as SequelizeCollection } from './collection';
export { default as SequelizeDataSource } from './datasource';
export { default as TypeConverter } from './utils/type-converter';

export type SequelizeDataSourceOptions = {
  connection: Sequelize;
};

export default function createSequelizeDataSource(
  options: SequelizeDataSourceOptions,
): DataSourceFactory {
  return async (logger: Logger) => new SequelizeDataSource(logger, options.connection);
}
