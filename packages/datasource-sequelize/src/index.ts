import { DataSourceFactory } from '@forestadmin/datasource-toolkit';
import { Sequelize } from 'sequelize';
import SequelizeDataSource from './datasource';

export default async function makeSequelizeDataSource(
  sequelize: Sequelize,
): Promise<DataSourceFactory> {
  return () => new SequelizeDataSource(sequelize);
}

export { SequelizeDataSource };
export { default as SequelizeCollection } from './collection';
export { default as TypeConverter } from './utils/type-converter';
