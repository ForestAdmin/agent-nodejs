import type { SequelizeDatasourceOptions } from './types';
import type { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';
import type { Sequelize } from 'sequelize';

import SequelizeDataSource from './datasource';

export { default as SequelizeCollection } from './collection';
export { default as SequelizeDataSource } from './datasource';
export { default as TypeConverter } from './utils/type-converter';

export function createSequelizeDataSource(
  connection: Sequelize,
  options?: SequelizeDatasourceOptions,
): DataSourceFactory {
  return async (logger: Logger) => new SequelizeDataSource(connection, logger, options);
}
