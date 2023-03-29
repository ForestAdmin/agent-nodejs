import { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';
import { Sequelize } from 'sequelize';

import SequelizeDataSource from './datasource';

export { default as SequelizeCollection } from './collection';
export { default as SequelizeDataSource } from './datasource';
export { default as TypeConverter } from './utils/type-converter';

/**
 * This function is used to create a Sequelize data source factory.
 * @param connection - The sequelize connection.
 * @param options - The options to configure the data source.
 * @param options.castUuidToString - Cast UUID to string to avoid issue withe type checking.
 */
export function createSequelizeDataSource(
  connection: Sequelize,
  options?: { castUuidToString: boolean },
): DataSourceFactory {
  return async (logger: Logger) => new SequelizeDataSource(connection, logger, options);
}
