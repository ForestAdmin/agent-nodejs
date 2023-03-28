import { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';
import { Sequelize } from 'sequelize';

import SequelizeDataSource from './datasource';

export { default as SequelizeCollection } from './collection';
export { default as SequelizeDataSource } from './datasource';
export { default as TypeConverter } from './utils/type-converter';

export function createSequelizeDataSource(
  connection: Sequelize,
  options?: { castUuidToString: boolean },
): DataSourceFactory {
  return async (logger: Logger) => new SequelizeDataSource(connection, logger, options);
}
